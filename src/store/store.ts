import { useSyncExternalStore } from 'react';
import { createDummyState, migrateState } from '../data/dummy';
import { CLOUD } from '../firebase/config';
import { resetAuction } from '../lib/auction';
import type { AppState, AuctionMeta } from '../types';
import { createLocalBackend, takeLegacyState, type IndexData, type SyncBackend } from './backend';
import type { Cloud, CloudStatus, RemoteAuction } from './cloud';

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

// ---------- cloud copy (optional) ----------
//
// The browser stays the working copy, so every screen reads and writes
// instantly and keeps going without internet. When Firebase keys are filled in
// (src/firebase/config.ts), each save of a synced auction is also sent to the
// cloud, and other devices can open the auction's link to watch it.

// The embed check is written out here so that build drops Firebase completely.
const cloudReady: Promise<Cloud> | null =
  import.meta.env.VITE_EMBED !== '1' && CLOUD ? import('./cloud').then((m) => m.createCloud()) : null;
let cloud: Cloud | null = null;

const SYNCED_KEY = 'auction-app:synced';
/** Auctions this browser keeps in the cloud: id -> time of the last save sent. */
let synced: Record<string, number> = (() => {
  try {
    return JSON.parse(localStorage.getItem(SYNCED_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
})();

function setSynced(next: Record<string, number>) {
  synced = next;
  try {
    localStorage.setItem(SYNCED_KEY, JSON.stringify(synced));
  } catch {
    // Storage full: the auction save itself already warned about it.
  }
}

export interface CloudInfo {
  /** False when no Firebase keys are set: everything stays in this browser. */
  enabled: boolean;
  status: CloudStatus;
  /** Ids of the auctions that are saved in the cloud. */
  synced: string[];
}

const cloudListeners = new Set<() => void>();
let cloudInfo: CloudInfo = { enabled: CLOUD, status: { kind: 'connecting' }, synced: Object.keys(synced) };

function refreshCloudInfo(status: CloudStatus = cloud?.status() ?? cloudInfo.status) {
  cloudInfo = { enabled: CLOUD, status, synced: Object.keys(synced) };
  for (const l of cloudListeners) l();
}

cloudReady?.then(
  (c) => {
    cloud = c;
    c.onStatus(() => refreshCloudInfo());
    refreshCloudInfo();
  },
  (err) => {
    console.warn('Cloud sync could not start', err);
    refreshCloudInfo({ kind: 'error', message: 'Cloud sync could not start. Check the internet connection and reload.' });
  },
);

export function useCloudInfo(): CloudInfo {
  return useSyncExternalStore((l) => (cloudListeners.add(l), () => cloudListeners.delete(l)), () => cloudInfo);
}

/** Sends this auction to the cloud and remembers that it lives there. */
function pushToCloud(id: string, s: AppState) {
  if (!cloudReady) return;
  const at = Date.now();
  const isNew = !(id in synced);
  setSynced({ ...synced, [id]: at });
  void cloudReady.then((c) => c.saveAuction(id, s, at), () => {});
  if (isNew) refreshCloudInfo();
}

function dropFromCloud(id: string) {
  if (!(id in synced)) return;
  const rest = { ...synced };
  delete rest[id];
  setSynced(rest);
  void cloudReady?.then((c) => c.removeAuction(id), () => {});
  refreshCloudInfo();
}

/** Puts every auction that is only in this browser into the cloud. Returns how many. */
export function uploadLocalAuctions(): number {
  let n = 0;
  for (const a of index.auctions) {
    if (a.id in synced) continue;
    const s = backend.loadAuction(a.id);
    if (!s) continue;
    pushToCloud(a.id, s);
    n++;
  }
  return n;
}

/** Long random id: with cloud sync, knowing the id is what lets a device watch the auction. */
function newAuctionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return 'a_' + Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}

// ---------- creating, copying, deleting, backing up ----------

/**
 * Saves a new auction and returns its id. `localOnly` keeps it out of the
 * cloud (used for the demo auction every new browser starts with).
 */
export function createAuction(state: AppState, localOnly = false): string {
  const id = newAuctionId();
  backend.saveAuction(id, state);
  updateIndex((d) => void d.auctions.unshift(metaFor(id, state)));
  if (!localOnly) pushToCloud(id, state);
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
  dropFromCloud(id);
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
    const restored = migrateState(s);
    backend.saveAuction(id, restored);
    // An auction that is already in the cloud must not fall behind this browser.
    if (id in synced) pushToCloud(id, restored);
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
  if (legacy) createAuction(migrateState(legacy));
  else createAuction(createDummyState('cricket', { name: 'Demo Premier League' }), true);
}

// ---------- the auction open in this tab ----------

const listeners = new Set<() => void>();
let currentId: string | null = null;
let state: AppState | null = null;
/** True when the open auction belongs to another device: this one can only watch. */
let viewOnly = false;
/** True once the cloud has said the open auction does not exist. */
let notInCloud = false;

function emit() {
  for (const l of listeners) l();
}

backend.subscribe((change) => {
  if (change.kind === 'index') {
    index = change.index;
    emitIndex();
  } else if (change.id === currentId && !viewOnly) {
    state = change.state ? migrateState(change.state) : null;
    emit();
  }
});

/**
 * Makes `id` the auction this tab works on. Returns false if it is not saved
 * in this browser (with cloud sync it may still arrive: see useAuctionStatus).
 * Safe to call during render: it only swaps data, it does not notify.
 */
export function openAuction(id: string): boolean {
  if (id !== currentId) {
    currentId = id;
    const saved = backend.loadAuction(id);
    state = saved ? migrateState(saved) : null;
    viewOnly = false;
    notInCloud = false;
  }
  return state !== null;
}

function onRemote(id: string, remote: RemoteAuction | null) {
  if (id !== currentId) return;
  if (!remote) {
    // Not in the cloud. Whatever is already on screen stays usable.
    if (!state) {
      notInCloud = true;
      emit();
    }
    return;
  }
  if (remote.ownerId === cloud?.uid()) {
    // This browser runs the auction, so its copy wins unless the cloud has
    // something newer or this browser has lost its copy.
    if (state && remote.updatedAt <= (synced[id] ?? 0)) return;
    viewOnly = false;
    state = migrateState(remote.state);
    setSynced({ ...synced, [id]: remote.updatedAt });
    backend.saveAuction(id, state);
    if (!index.auctions.some((a) => a.id === id)) {
      const restored = state;
      updateIndex((d) => void d.auctions.unshift(metaFor(id, restored)));
      refreshCloudInfo();
    }
  } else {
    // Someone else's auction: keep it in memory only and never write to it.
    if (state && !viewOnly) return;
    viewOnly = true;
    state = migrateState(remote.state);
  }
  notInCloud = false;
  emit();
}

/**
 * Listens to the cloud copy of an auction while its pages are open.
 * Returns the function that stops listening.
 */
export function watchAuction(id: string): () => void {
  if (!cloudReady) return () => {};
  let stop: (() => void) | null = null;
  let cancelled = false;
  const giveUp = () => {
    if (cancelled || id !== currentId || state) return;
    notInCloud = true;
    emit();
  };
  // No answer (offline, or the cloud is unreachable): stop the spinner. If the
  // auction does arrive later it still opens.
  const timer = setTimeout(giveUp, 12000);
  void cloudReady.then(
    (c) => {
      if (!cancelled) stop = c.watchAuction(id, (remote) => onRemote(id, remote));
    },
    giveUp,
  );
  return () => {
    cancelled = true;
    clearTimeout(timer);
    stop?.();
  };
}

export type AuctionStatus = 'ready' | 'view-only' | 'loading' | 'missing';

function auctionStatus(): AuctionStatus {
  if (state) return viewOnly ? 'view-only' : 'ready';
  return cloudReady && !notInCloud ? 'loading' : 'missing';
}

/** Whether the open auction can be shown yet; re-renders when that changes. */
export function useAuctionStatus(): AuctionStatus {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), auctionStatus);
}

export const currentAuctionId = () => currentId;

export function getState(): AppState {
  if (!state) throw new Error('No auction is open');
  return state;
}

function persist(next: AppState) {
  const id = currentId!;
  state = next;
  backend.saveAuction(id, state);
  if (id in synced) pushToCloud(id, state);
  const meta = index.auctions.find((a) => a.id === id);
  const fresh = metaFor(id, state, meta?.createdAt);
  // Only rewrite the index when something shown on "My Auctions" changed.
  if (!meta || (['name', 'sport', 'date', 'venue', 'teams', 'players', 'status'] as const).some((k) => meta[k] !== fresh[k])) {
    updateIndex((d) => {
      const i = d.auctions.findIndex((a) => a.id === id);
      if (i >= 0) d.auctions[i] = fresh;
    });
  }
  emit();
}

/** Apply a change to the open auction. `recipe` edits a copy; the result is saved and broadcast. */
export function update(recipe: (draft: AppState) => void) {
  // Watching another device's auction: only that device can change it.
  if (viewOnly) return;
  // Start from the latest saved copy, not this tab's possibly-older one, so a
  // bid made in another tab a moment ago is not overwritten.
  const saved = currentId ? backend.loadAuction(currentId) : null;
  const draft = saved ? migrateState(saved) : structuredClone(getState());
  recipe(draft);
  persist(draft);
}

export function replaceState(next: AppState) {
  if (viewOnly) return;
  persist(migrateState(next));
}

export function useAppState(): AppState {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), getState);
}
