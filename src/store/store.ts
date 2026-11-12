import { useSyncExternalStore } from 'react';
import { createDummyState, migrateState } from '../data/dummy';
import { resetAuction } from '../lib/auction';
import { playerFromRegistration, sameMobile } from '../lib/registration';
import type { AppState, AuctionMeta, Registration } from '../types';
import { createLocalBackend, takeLegacyState, type IndexData, type SyncBackend } from './backend';
import { FREE_MAX_TEAMS, getAuth, onUserChange, teamLimitReached } from './auth';
import type { Cloud, CloudStatus, RemoteAuction } from './cloud';
import { API_BASE, CLOUD } from './cloudConfig';

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
// is configured (the Hostinger build), each save of a synced auction is also
// sent to the server, and other devices can open the auction's link to watch it.

// The embed check is written out here so that build leaves the cloud code out.
const cloudReady: Promise<Cloud> | null =
  import.meta.env.VITE_EMBED !== '1' && CLOUD ? import('./cloud').then((m) => m.createCloud(API_BASE)) : null;

// ---------- owner tokens: the secret that lets this browser change its auctions ----------

const TOKEN_KEY = 'auction-app:owner-token';
const TOKENS_KEY = 'auction-app:owner-tokens';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function newToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** This browser's own token, used for auctions created here. */
function deviceToken(): string {
  let t = readJson<string | null>(TOKEN_KEY, null);
  if (!t || !/^[a-f0-9]{64}$/.test(t)) {
    t = newToken();
    localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
  }
  return t;
}

/** Tokens of auctions brought here from another device's backup. */
let tokens: Record<string, string> = readJson(TOKENS_KEY, {});

function tokenFor(id: string): string {
  return tokens[id] ?? deviceToken();
}

function setTokens(next: Record<string, string>) {
  tokens = next;
  try {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  } catch {
    // Storage full: the auction save itself already warned about it.
  }
}

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

let cloud: Cloud | null = null;

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

// ---------- sign-in: online saving needs a Google account ----------

const DIRTY_KEY = 'auction-app:unsent';
const LOCAL_ONLY_KEY = 'auction-app:local-only';
/** Auctions changed here while signed out: sent once someone signs in. */
let dirty: string[] = readJson(DIRTY_KEY, []);
/** Auctions that never go online on their own (the demo every new browser starts with). */
let localOnlyIds: string[] = readJson(LOCAL_ONLY_KEY, []);

function saveList(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Storage full: the auction save itself already warned about it.
  }
}

/**
 * After sign-in: send this browser's auctions to the account, and list the
 * account's auctions from other devices in My Auctions. An auction that is
 * already online is only sent when it was changed here while signed out, so a
 * stale copy never overwrites newer work from another device.
 */
async function syncAccount() {
  const c = await cloudReady?.catch(() => null);
  if (!c || !getAuth().user) return;
  c.retry();
  let remote: AuctionMeta[];
  try {
    remote = await c.listMine();
  } catch (err) {
    console.warn('Could not list online auctions', err);
    return;
  }
  const online = new Set(remote.map((a) => a.id));
  const unsent = new Set(dirty);
  for (const a of index.auctions) {
    if (localOnlyIds.includes(a.id)) continue;
    if (online.has(a.id) && !unsent.has(a.id)) continue;
    const s = backend.loadAuction(a.id);
    if (s) pushToCloud(a.id, s);
  }
  dirty = [];
  saveList(DIRTY_KEY, dirty);
  const missing = remote.filter((a) => !index.auctions.some((x) => x.id === a.id));
  if (missing.length) {
    updateIndex((d) => {
      d.auctions.push(...missing);
      d.auctions.sort((a, b) => b.createdAt - a.createdAt);
    });
  }
  refreshCloudInfo();
}

onUserChange((user) => {
  if (user) void syncAccount();
});

/** Sends this auction to the cloud and remembers that it lives there. */
function pushToCloud(id: string, s: AppState) {
  if (!cloudReady) return;
  if (!getAuth().user) {
    // Signed out: keep it here and send it after sign-in.
    if (!dirty.includes(id) && !localOnlyIds.includes(id)) {
      dirty = [...dirty, id];
      saveList(DIRTY_KEY, dirty);
    }
    return;
  }
  // Free accounts cannot put an auction with more than 2 teams online (the
  // server would refuse it). It stays on this device until the account is Pro.
  if (overFreeLimit(s) && !(id in synced)) return;
  const at = Date.now();
  const isNew = !(id in synced);
  setSynced({ ...synced, [id]: at });
  const token = tokenFor(id);
  void cloudReady.then((c) => c.saveAuction(id, s, at, token), () => {});
  if (isNew) refreshCloudInfo();
}

function dropFromCloud(id: string) {
  if (!(id in synced)) return;
  const rest = { ...synced };
  delete rest[id];
  setSynced(rest);
  const token = tokenFor(id);
  void cloudReady?.then((c) => c.removeAuction(id, token), () => {});
  refreshCloudInfo();
}

/** True when this auction has more teams than the signed-in free account may put online. */
export function overFreeLimit(s: AppState): boolean {
  return s.teams.length > FREE_MAX_TEAMS && teamLimitReached(FREE_MAX_TEAMS);
}

/**
 * Makes one auction reachable from other phones (the demo starts out only on
 * this browser, so its links show "not found" to everyone else). Needs sign-in.
 */
export function goOnline(id: string): boolean {
  if (!getAuth().user) return false;
  const s = backend.loadAuction(id);
  if (!s || overFreeLimit(s)) return false;
  localOnlyIds = localOnlyIds.filter((x) => x !== id);
  saveList(LOCAL_ONLY_KEY, localOnlyIds);
  pushToCloud(id, s);
  return true;
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
  else {
    localOnlyIds = [...localOnlyIds, id];
    saveList(LOCAL_ONLY_KEY, localOnlyIds);
  }
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
  /** The secret that lets a browser change each online auction; restoring it on another device moves that right there. */
  ownerTokens?: Record<string, string>;
}

/** Everything this organiser has: profile plus every auction. */
export function exportAccount(): AccountBackup {
  const auctions: Record<string, AppState> = {};
  const ownerTokens: Record<string, string> = {};
  for (const a of index.auctions) {
    const s = backend.loadAuction(a.id);
    if (s) auctions[a.id] = s;
    if (CLOUD) ownerTokens[a.id] = tokenFor(a.id);
  }
  return { kind: 'auction-account-backup', exportedAt: Date.now(), index, auctions, ...(CLOUD ? { ownerTokens } : {}) };
}

/** Adds the auctions from a backup (existing ones with the same id are replaced). */
export function importAccount(backup: AccountBackup): number {
  let n = 0;
  // Bring the owner tokens first, so the saves below are accepted by the server.
  const own = deviceToken();
  const brought = Object.fromEntries(
    Object.entries(backup.ownerTokens ?? {}).filter(([id, t]) => backup.auctions[id] && /^[a-f0-9]{64}$/.test(t) && t !== own),
  );
  if (Object.keys(brought).length) setTokens({ ...tokens, ...brought });
  for (const id of Object.keys(backup.ownerTokens ?? {})) {
    // An auction that was online on the old device is online here too.
    if (backup.auctions[id] && !(id in synced)) setSynced({ ...synced, [id]: 0 });
  }
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
  if (remote.mine) {
    // This browser runs the auction, so its copy wins unless the cloud has
    // something newer or this browser has lost its copy.
    if (state && remote.updatedAt <= (synced[id] ?? 0)) {
      // A change made here that never reached the server (closed while offline): send it now.
      if (remote.updatedAt < (synced[id] ?? 0) && !viewOnly) pushToCloud(id, state);
      return;
    }
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
      if (!cancelled) stop = c.watchAuction(id, tokenFor(id), (remote) => onRemote(id, remote), (forms) => addRegistrations(id, forms));
    },
    giveUp,
  );
  return () => {
    cancelled = true;
    clearTimeout(timer);
    stop?.();
  };
}

/** Adds the forms players sent from their phones to the open auction, on hold. True when done. */
function addRegistrations(id: string, forms: Registration[]): boolean {
  if (id !== currentId || viewOnly || !state) return false;
  update((s) => {
    for (const f of forms) {
      if (!f.id || s.players.some((p) => p.id === f.id)) continue;
      s.players.push(playerFromRegistration(s, f, f.id));
    }
  });
  return true;
}

export type RegistrationResult = 'ok' | 'already_registered' | 'closed' | 'offline' | 'failed';

/**
 * A player submits the registration form. On the organiser's own device the
 * player is added straight away; on anyone else's phone the form goes to the
 * server and the organiser's app picks it up.
 */
export async function submitRegistration(form: Registration): Promise<RegistrationResult> {
  if (!currentId || !state) return 'failed';
  if (!viewOnly) {
    if (state.players.some((p) => sameMobile(p.mobile, form.mobile))) return 'already_registered';
    update((s) => void s.players.push(playerFromRegistration(s, form, 'p_' + Math.random().toString(36).slice(2, 9))));
    return 'ok';
  }
  const c = await cloudReady?.catch(() => null);
  if (!c) return 'offline';
  try {
    await c.register(currentId, form);
    return 'ok';
  } catch (err) {
    const code = (err as Error).message;
    return code === 'already_registered' || code === 'closed' || code === 'offline' ? code : 'failed';
  }
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
