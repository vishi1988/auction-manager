// Where data is saved and how other screens hear about changes.
// The local backend keeps everything in this browser and syncs open tabs
// (console tab -> projector tab). A cloud backend (after login is added)
// will implement the same interface so phones can join over the internet.
import type { AppState, AuctionMeta, Organizer } from '../types';
import { dropPhotos, photoStorageOn, photosFor, rememberPhotos, storePhotos } from './photoCache';
import { mergePhotos, splitPhotos } from './photos';

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
    loadAuction(id) {
      const saved = read<AppState>(auctionKey(id));
      // Older saves still carry their photos inline; mergePhotos keeps those.
      const photos = saved && photosFor(id);
      return saved && photos ? mergePhotos(saved, photos) : saved;
    },
    saveAuction(id, state) {
      if (photoStorageOn()) {
        // Photos go to IndexedDB (room for sharp photos); the rest stays small in localStorage.
        const { lean, photos } = splitPhotos(state);
        storePhotos(id, photos);
        write(auctionKey(id), lean);
      } else {
        write(auctionKey(id), state);
      }
      post({ kind: 'auction', id, state });
    },
    removeAuction(id) {
      localStorage.removeItem(auctionKey(id));
      dropPhotos(id);
      post({ kind: 'auction', id, state: null });
    },
    subscribe(onRemote) {
      const onMessage = (e: MessageEvent<RemoteChange>) => {
        const change = e.data;
        // The tab that sent it has written the photos; keep this tab's copy in step.
        if (change.kind === 'auction' && change.state && photoStorageOn()) rememberPhotos(change.id, splitPhotos(change.state).photos);
        onRemote(change);
      };
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
