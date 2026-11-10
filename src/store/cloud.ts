// Cloud copy of the auctions, in Firebase Firestore.
//
// There is no login screen: each browser signs in silently with an anonymous
// identity. The browser that created an auction is its owner and the only one
// that can change it; any device that has the auction's link can watch it.
//
// Layout in Firestore:
//   auctions/{id}                 { ownerId, name, updatedAt, data: JSON of the auction without images }
//   auctions/{id}/photos/{key}    { data: image }   one per player photo / team logo
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
} from 'firebase/firestore';
import { firebaseConfig } from '../firebase/config';
import type { AppState } from '../types';
import { diffPhotos, mergePhotos, splitPhotos, type PhotoMap } from './photos';

export interface RemoteAuction {
  ownerId: string;
  updatedAt: number;
  state: AppState;
}

export type CloudStatus =
  | { kind: 'connecting' }
  | { kind: 'on' }
  | { kind: 'error'; message: string };

export interface Cloud {
  /** This browser's identity, once signed in. */
  uid(): string | null;
  saveAuction(id: string, state: AppState, updatedAt: number): void;
  removeAuction(id: string): void;
  /** Calls back now and on every change. null = no such auction (or not readable). */
  watchAuction(id: string, onChange: (remote: RemoteAuction | null) => void): () => void;
  status(): CloudStatus;
  onStatus(listener: () => void): () => void;
}

function explain(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  if (code.includes('operation-not-allowed') || code.includes('admin-restricted-operation')) {
    return 'Anonymous sign-in is not enabled in the Firebase console.';
  }
  if (code.includes('api-key-not-valid') || code.includes('invalid-api-key')) {
    return 'The Firebase keys in src/firebase/config.ts are not valid.';
  }
  if (code.includes('network-request-failed') || code.includes('unavailable')) {
    return 'No internet right now. Changes will be sent when the connection is back.';
  }
  if (code.includes('permission-denied')) return 'The cloud refused the save (check the security rules are published).';
  if (code.includes('resource-exhausted')) return 'The free daily limit of the cloud project was reached.';
  return (err as Error)?.message || 'Could not reach the cloud.';
}

export function createCloud(): Cloud {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  // The local cache keeps the auction running when the internet drops at the
  // venue: saves queue up on this device and are sent when it comes back.
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  });

  let status: CloudStatus = { kind: 'connecting' };
  const listeners = new Set<() => void>();
  const setStatus = (next: CloudStatus) => {
    if (next.kind === status.kind && (next as { message?: string }).message === (status as { message?: string }).message) return;
    status = next;
    for (const l of listeners) l();
  };
  const fail = (err: unknown) => {
    console.warn('Cloud sync', err);
    setStatus({ kind: 'error', message: explain(err) });
  };

  const signedIn = new Promise<string>((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (!user) return;
      setStatus({ kind: 'on' });
      resolve(user.uid);
    });
  });
  signInAnonymously(auth).catch(fail);

  const auctionRef = (id: string) => doc(db, 'auctions', id);
  const photosRef = (id: string) => collection(db, 'auctions', id, 'photos');

  // Images already in the cloud, per auction, so a save only sends what changed.
  const sentPhotos = new Map<string, PhotoMap>();
  async function knownPhotos(id: string): Promise<PhotoMap> {
    let known = sentPhotos.get(id);
    if (!known) {
      known = {};
      try {
        for (const d of (await getDocs(photosRef(id))).docs) known[d.id] = d.get('data') as string;
      } catch {
        // Offline with nothing cached: send them all again, which is harmless.
      }
      sentPhotos.set(id, known);
    }
    return known;
  }

  // One save at a time, in order: the auction record must exist before its
  // photos are accepted by the security rules.
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = (job: (uid: string) => Promise<void>) => {
    queue = queue.then(() => signedIn).then(job).catch(fail);
  };
  // Writes resolve only when the server confirms, which never happens while
  // offline, so they are not awaited: Firestore sends them in the order issued.
  const send = (write: Promise<void>) => void write.then(() => setStatus({ kind: 'on' }), fail);

  return {
    uid: () => auth.currentUser?.uid ?? null,

    saveAuction(id, state, updatedAt) {
      const { lean, photos } = splitPhotos(state);
      enqueue(async (uid) => {
        send(setDoc(auctionRef(id), { ownerId: uid, name: lean.settings.name, updatedAt, data: JSON.stringify(lean) }));
        const { put, remove } = diffPhotos(await knownPhotos(id), photos);
        for (const [key, data] of Object.entries(put)) send(setDoc(doc(photosRef(id), key), { data }));
        for (const key of remove) send(deleteDoc(doc(photosRef(id), key)));
        sentPhotos.set(id, photos);
      });
    },

    removeAuction(id) {
      enqueue(async () => {
        // Photos first: the rules check the auction record to allow deleting them.
        for (const key of Object.keys(await knownPhotos(id))) send(deleteDoc(doc(photosRef(id), key)));
        send(deleteDoc(auctionRef(id)));
        sentPhotos.delete(id);
      });
    },

    watchAuction(id, onChange) {
      let record: { ownerId: string; updatedAt: number; lean: AppState } | null | undefined;
      let photos: PhotoMap | undefined;
      const publish = () => {
        if (record === undefined) return;
        if (record === null) return onChange(null);
        // Show the auction straight away; photos fill in when they arrive.
        onChange({ ownerId: record.ownerId, updatedAt: record.updatedAt, state: mergePhotos(record.lean, photos ?? {}) });
      };
      const stopRecord = onSnapshot(
        auctionRef(id),
        (snap) => {
          // Our own save, still on its way to the server: this device has it already.
          if (snap.metadata.hasPendingWrites) return;
          if (!snap.exists()) {
            // Offline with nothing cached is "not known yet", not "deleted".
            if (snap.metadata.fromCache) return;
            record = null;
          } else {
            try {
              record = {
                ownerId: snap.get('ownerId') as string,
                updatedAt: (snap.get('updatedAt') as number) ?? 0,
                lean: JSON.parse(snap.get('data') as string) as AppState,
              };
            } catch {
              record = null;
            }
          }
          publish();
        },
        (err) => {
          console.warn('Cloud sync', err);
          record = null;
          publish();
        },
      );
      const stopPhotos = onSnapshot(
        photosRef(id),
        (snap) => {
          const next: PhotoMap = {};
          for (const d of snap.docs) next[d.id] = d.get('data') as string;
          photos = next;
          publish();
        },
        (err) => console.warn('Cloud sync (photos)', err),
      );
      return () => {
        stopRecord();
        stopPhotos();
      };
    },

    status: () => status,
    onStatus(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
