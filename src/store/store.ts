import { useSyncExternalStore } from 'react';
import { createDummyState, migrateState } from '../data/dummy';
import { resetAuction } from '../lib/auction';
import { uid } from '../lib/format';
import type { AppState, AuctionMeta } from '../types';
import { createLocalBackend, takeLegacyState, type IndexData, type SyncBackend } from './backend';

const backend: SyncBackend = createLocalBackend();

// ---------- index: organiser profile + list of auctions ----------

const indexListeners = new Set<() => void>();
let index: IndexData = backend.loadIndex() ?? {
  organizer: { name: '', organisation: '', mobile: '', city: '', email: '' },
  auctions: [],
};

function emitIndex() {
  for (const l of indexListeners) l();
}

function saveIndex(next: IndexData) {
  index = next;
  backend.saveIndex(index);
  emitIndex();
}

export function metaFor(id: string, s: AppState, createdAt = Date.now()): AuctionMeta {
  return {
    id,
    name: s.settings.name,
    sport: s.settings.sport,
    date: s.settings.date,
    venue: s.settings.venue,
    teams: s.teams.length,
    players: s.players.length,
    status: s.auction.status,
    createdAt,
    updatedAt: Date.now(),
  };
}

export const getIndex = () => index;

export function updateIndex(recipe: (draft: IndexData) => void) {
  const draft = structuredClone(index);
  recipe(draft);
  saveIndex(draft);
}

export function useIndex(): IndexData {
  return useSyncExternalStore((l) => (indexListeners.add(l), () => indexListeners.delete(l)), getIndex);
}

/** Saves a new auction and returns its id. */
export function createAuction(state: AppState): string {
  const id = uid('a');
  backend.saveAuction(id, state);
  updateIndex((d) => void d.auctions.unshift(metaFor(id, state)));
  return id;
}

export function duplicateAuction(id: string): string | null {
  const s = backend.loadAuction(id);
  if (!s) return null;
  const copy = migrateState(structuredClone(s));
  copy.settings.name = s.settings.name + ' (copy)';
  // Same teams, players and rules — but a fresh auction with no sales.
  resetAuction(copy);
  return createAuction(copy);
}

export function deleteAuction(id: string) {
  backend.removeAuction(id);
  updateIndex((d) => void (d.auctions = d.auctions.filter((a) => a.id !== id)));
}

export interface AccountBackup {
  kind: 'auction-account-backup';
  exportedAt: number;
  index: IndexData;
  auctions: Record<string, AppState>;
}

/** Everything this organiser has: profile plus every auction. */
export function exportAccount(): AccountBackup {
  const auctions: Record<string, AppState> = {};
  for (const a of index.auctions) {
    const s = backend.loadAuction(a.id);
    if (s) auctions[a.id] = s;
  }
  return { kind: 'auction-account-backup', exportedAt: Date.now(), index, auctions };
}

/** Adds the auctions from a backup (existing ones with the same id are replaced). */
export function importAccount(backup: AccountBackup): number {
  let n = 0;
  for (const [id, s] of Object.entries(backup.auctions)) {
    backend.saveAuction(id, migrateState(s));
    n++;
  }
  updateIndex((d) => {
    if (!d.organizer.name) d.organizer = backup.index.organizer;
    for (const meta of backup.index.auctions) {
      if (!backup.auctions[meta.id]) continue;
      d.auctions = d.auctions.filter((a) => a.id !== meta.id);
      d.auctions.push(meta);
    }
    d.auctions.sort((a, b) => b.createdAt - a.createdAt);
  });
  return n;
}

// First run: bring over data from the single-auction version, or add a demo auction.
if (!backend.loadIndex()) {
  const legacy = takeLegacyState();
  createAuction(legacy ? migrateState(legacy) : createDummyState('cricket', { name: 'Demo Premier League' }));
}

// ---------- the auction open in this tab ----------

const listeners = new Set<() => void>();
let currentId: string | null = null;
let state: AppState | null = null;

function emit() {
  for (const l of listeners) l();
}

backend.subscribe((change) => {
  if (change.kind === 'index') {
    index = change.index;
    emitIndex();
  } else if (change.id === currentId) {
    state = change.state ? migrateState(change.state) : null;
    emit();
  }
});

/**
 * Makes `id` the auction this tab works on. Returns false if it does not exist.
 * Safe to call during render: it only swaps data, it does not notify.
 */
export function openAuction(id: string): boolean {
  if (id !== currentId) {
    currentId = id;
    const saved = backend.loadAuction(id);
    state = saved ? migrateState(saved) : null;
  }
  return state !== null;
}

export const currentAuctionId = () => currentId;

export function getState(): AppState {
  if (!state) throw new Error('No auction is open');
  return state;
}

function persist(next: AppState) {
  state = next;
  backend.saveAuction(currentId!, state);
  const meta = index.auctions.find((a) => a.id === currentId);
  const fresh = metaFor(currentId!, state, meta?.createdAt);
  // Only rewrite the index when something shown on "My Auctions" changed.
  if (!meta || (['name', 'sport', 'date', 'venue', 'teams', 'players', 'status'] as const).some((k) => meta[k] !== fresh[k])) {
    updateIndex((d) => {
      const i = d.auctions.findIndex((a) => a.id === currentId);
      if (i >= 0) d.auctions[i] = fresh;
    });
  }
  emit();
}

/** Apply a change to the open auction. `recipe` edits a copy; the result is saved and broadcast. */
export function update(recipe: (draft: AppState) => void) {
  // Start from the latest saved copy, not this tab's possibly-older one, so a
  // bid made in another tab a moment ago is not overwritten.
  const saved = currentId ? backend.loadAuction(currentId) : null;
  const draft = saved ? migrateState(saved) : structuredClone(getState());
  recipe(draft);
  persist(draft);
}

export function replaceState(next: AppState) {
  persist(migrateState(next));
}

export function useAppState(): AppState {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), getState);
}
