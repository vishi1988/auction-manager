// Where data is saved and how other screens hear about changes.
// The local backend keeps everything in this browser and syncs open tabs
// (console tab -> projector tab). A cloud backend (after login is added)
// will implement the same interface so phones can join over the internet.
import type { AppState, AuctionMeta, Organizer } from '../types';

export interface IndexData {
  organizer: Organizer;
  auctions: AuctionMeta[];
}

export type RemoteChange =
  | { kind: 'index'; index: IndexData }
  | { kind: 'auction'; id: string; state: AppState | null };

export interface SyncBackend {
  loadIndex(): IndexData | null;
  saveIndex(index: IndexData): void;
  loadAuction(id: string): AppState | null;
  saveAuction(id: string, state: AppState): void;
  removeAuction(id: string): void;
  /** Called when another tab/device changed something. Returns unsubscribe. */
  subscribe(onRemote: (change: RemoteChange) => void): () => void;
}

const PREFIX = 'auction-app:';
const INDEX_KEY = PREFIX + 'index';
const auctionKey = (id: string) => PREFIX + 'auction:' + id;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('Could not save', key, err);
    alert('Browser storage is full. Remove some player photos or old auctions.');
  }
}

export function createLocalBackend(): SyncBackend {
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(PREFIX + 'sync') : null;
  const post = (change: RemoteChange) => channel?.postMessage(change);
  return {
    loadIndex: () => read<IndexData>(INDEX_KEY),
    saveIndex(index) {
      write(INDEX_KEY, index);
      post({ kind: 'index', index });
    },
    loadAuction: (id) => read<AppState>(auctionKey(id)),
    saveAuction(id, state) {
      write(auctionKey(id), state);
      post({ kind: 'auction', id, state });
    },
    removeAuction(id) {
      localStorage.removeItem(auctionKey(id));
      post({ kind: 'auction', id, state: null });
    },
    subscribe(onRemote) {
      const onMessage = (e: MessageEvent<RemoteChange>) => onRemote(e.data);
      channel?.addEventListener('message', onMessage);
      return () => channel?.removeEventListener('message', onMessage);
    },
  };
}

/** Data saved by the first single-auction version of the app. */
export function takeLegacyState(): AppState | null {
  const key = 'cricket-auction-state';
  const legacy = read<AppState>(key);
  if (legacy) localStorage.removeItem(key);
  return legacy;
}
