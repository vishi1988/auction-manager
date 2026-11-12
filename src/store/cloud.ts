// Cloud copy of the auctions, on our own server (PHP + MySQL on Hostinger).
//
// There is no login screen. Each auction has an owner token: a long random
// secret kept in the browser that created it (and in its backup file). Only
// requests carrying that token can change the auction; anyone with the
// auction's link can read it, which is how the live screen works on a
// projector laptop or a phone.
//
// Screens that watch an auction ask the server about once a second whether it
// changed; the server answers "nothing new" cheaply until it has.
import type { AppState, AuctionMeta, Registration } from '../types';
import { diffPhotos, mergePhotos, splitPhotos, type PhotoMap } from './photos';

export interface RemoteAuction {
  /** True when the token sent with the request is this auction's owner token. */
  mine: boolean;
  updatedAt: number;
  state: AppState;
}

/** A bid an owner tapped on their phone, waiting for the organiser's app. */
export interface PendingBid {
  id: string;
  teamId: string;
  kind: 'bid' | 'join';
  seen: number | null;
}

/** What the organiser's app did with a bid; sent back so the owner's phone can say so. */
export interface BidOutcome {
  id: string;
  ok: boolean;
  tie?: boolean;
  reason?: string;
}

export type CloudStatus =
  | { kind: 'connecting' }
  | { kind: 'on' }
  | { kind: 'error'; message: string };

export interface Cloud {
  saveAuction(id: string, state: AppState, updatedAt: number, token: string): void;
  /** Sends saves that waited for a sign-in. */
  retry(): void;
  /** The signed-in user's auctions on the server (for My Auctions on a new device). */
  listMine(): Promise<AuctionMeta[]>;
  removeAuction(id: string, token: string): void;
  /**
   * Calls back on the first answer and on every change. null = no such auction.
   * On the organiser's own auction, `onRegistrations` gets the forms players have
   * sent; it returns true once they are added, and the server then forgets them.
   */
  watchAuction(
    id: string,
    token: string | null,
    onChange: (remote: RemoteAuction | null) => void,
    onRegistrations?: (forms: Registration[]) => boolean,
    onBids?: (bids: PendingBid[]) => BidOutcome[] | null,
  ): () => void;
  /** Sends a player's registration form. Rejects with the server's reason ('already_registered', 'closed', …). */
  register(id: string, form: Registration): Promise<void>;
  /** Is this team's private link good? */
  checkOwnerKey(id: string, teamId: string, key: string): Promise<boolean>;
  /** A team owner taps BID: waits (up to ~10 s) until the organiser's app has answered. */
  ownerBid(id: string, teamId: string, key: string, kind: 'bid' | 'join', seen: number | null): Promise<BidOutcome>;
  status(): CloudStatus;
  onStatus(listener: () => void): () => void;
}

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

function explain(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.code === 'login_required') return 'Sign in with Google to keep saving online. Your changes are kept on this device.';
    if (err.code === 'not_owner') return 'This auction belongs to another account, so changes from here are not saved.';
    if (err.code === 'db_unavailable' || err.code === 'not_configured') return 'The server database is not set up yet (api/config.php).';
    if (err.code === 'too_large') return 'This auction is too big to save online. Use smaller player photos.';
    return 'The server refused the save (' + err.code + ').';
  }
  return 'No internet right now. Changes are kept on this device and sent when the connection is back.';
}

export function createCloud(apiBase: string): Cloud {
  const base = apiBase.replace(/\/?$/, '/');

  let status: CloudStatus = { kind: 'connecting' };
  const listeners = new Set<() => void>();
  const setStatus = (next: CloudStatus) => {
    const msg = (s: CloudStatus) => (s.kind === 'error' ? s.message : '');
    if (next.kind === status.kind && msg(next) === msg(status)) return;
    status = next;
    for (const l of listeners) l();
  };

  async function request(path: string, init: { method?: string; token?: string | null; body?: unknown } = {}) {
    const res = await fetch(base + path, {
      method: init.method ?? 'GET',
      headers: {
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(init.token ? { 'X-Owner-Token': init.token } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (res.status === 204) return null;
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new HttpError(res.status, (body as { error?: string }).error ?? 'http_' + res.status);
    return body as Record<string, unknown>;
  }

  // ---------- saving ----------

  interface Pending { state: AppState; updatedAt: number; token: string }
  /** Latest unsent state per auction: a burst of bids becomes one save. */
  const pending = new Map<string, Pending>();
  /** Photos the server already has, per auction, so only changes are sent. */
  const sentPhotos = new Map<string, PhotoMap>();
  let flushing = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryDelay = 2000;

  async function knownPhotos(id: string): Promise<PhotoMap> {
    let known = sentPhotos.get(id);
    if (!known) {
      try {
        known = ((await request('photos.php?id=' + id))?.photos as PhotoMap) ?? {};
      } catch (err) {
        if (!(err instanceof HttpError && err.status === 404)) throw err;
        known = {};
      }
      sentPhotos.set(id, known);
    }
    return known;
  }

  async function flush() {
    if (flushing) return;
    flushing = true;
    try {
      while (pending.size) {
        const [id, job] = pending.entries().next().value as [string, Pending];
        const { lean, photos } = splitPhotos(job.state);
        try {
          await request('auction.php?id=' + id, { method: 'POST', token: job.token, body: { name: lean.settings.name, updatedAt: job.updatedAt, data: lean } });
          const { put, remove } = diffPhotos(await knownPhotos(id), photos);
          if (Object.keys(put).length || remove.length) {
            // Several small requests rather than one huge one, so big squads with photos still fit.
            const keys = Object.keys(put);
            for (let i = 0; i < keys.length || (i === 0 && remove.length); i += 20) {
              const chunk = Object.fromEntries(keys.slice(i, i + 20).map((k) => [k, put[k]!]));
              await request('photos.php?id=' + id, { method: 'POST', token: job.token, body: { put: chunk, remove: i === 0 ? remove : [] } });
            }
            sentPhotos.set(id, photos);
          }
          // Drop it unless a newer save arrived while this one was on its way.
          if (pending.get(id) === job) pending.delete(id);
          retryDelay = 2000;
          setStatus({ kind: 'on' });
        } catch (err) {
          console.warn('Cloud save', err);
          setStatus({ kind: 'error', message: explain(err) });
          if (err instanceof HttpError && err.status === 401) {
            // Signed out (or the sign-in expired): keep everything and wait for retry().
            return;
          }
          if (err instanceof HttpError && err.status !== 500 && err.status !== 503) {
            // Refused for good (not the owner, bad data): retrying would not help.
            if (pending.get(id) === job) pending.delete(id);
            continue;
          }
          // Offline or the server is busy: try again a little later.
          retryTimer ??= setTimeout(() => {
            retryTimer = null;
            void flush();
          }, retryDelay);
          retryDelay = Math.min(30000, retryDelay * 2);
          return;
        }
      }
    } finally {
      flushing = false;
    }
  }

  window.addEventListener('online', () => void flush());

  // ---------- watching ----------

  function watchAuction(
    id: string,
    token: string | null,
    onChange: (remote: RemoteAuction | null) => void,
    onRegistrations?: (forms: Registration[]) => boolean,
    onBids?: (bids: PendingBid[]) => BidOutcome[] | null,
  ) {
    let stopped = false;
    let bidTimer: ReturnType<typeof setTimeout> | null = null;
    let bidsRunning = false;
    let version = 0;
    let photosVersion = -1;
    let photos: PhotoMap = {};
    let timer: ReturnType<typeof setTimeout> | null = null;
    let mine = false;

    // Bids from owners' phones need an answer within a second or two, so the
    // organiser's browser checks for them often (a cheap request) while it is on screen.
    const pollBids = async () => {
      if (stopped || !mine || !onBids) {
        bidsRunning = false;
        return;
      }
      if (document.visibilityState === 'visible') {
        try {
          const items = ((await request('bid.php?id=' + id, { token }))?.items as PendingBid[] | undefined) ?? [];
          if (items.length && !stopped) {
            const results = onBids(items);
            if (results) await request(`bid.php?id=${id}&action=done`, { method: 'POST', token, body: { results } });
          }
        } catch {
          // Offline or busy: the next check tries again. Unconfirmed bids return to the queue by themselves.
        }
      }
      if (!stopped) bidTimer = setTimeout(pollBids, 1000);
    };

    const schedule = () => {
      if (stopped) return;
      // The organiser's own browser already has everything, so it checks rarely.
      // Projectors and phones check every second while they are on screen.
      const ms = mine ? 15000 : document.visibilityState === 'visible' ? 1000 : 5000;
      timer = setTimeout(poll, ms);
    };

    const poll = async () => {
      try {
        const res = await request(`auction.php?id=${id}${version ? '&since=' + version : ''}`, { token });
        if (stopped) return;
        setStatus({ kind: 'on' });
        if (res) {
          version = res.version as number;
          mine = res.mine as boolean;
          if (mine && onBids && !bidsRunning) {
            bidsRunning = true;
            void pollBids();
          }
          if (res.photosVersion !== photosVersion) {
            const p = await request('photos.php?id=' + id).catch(() => null);
            if (p) {
              photos = (p.photos as PhotoMap) ?? {};
              photosVersion = res.photosVersion as number;
            }
          }
          if (!stopped) onChange({ mine, updatedAt: res.updatedAt as number, state: mergePhotos(res.data as AppState, photos) });
        }
        if (mine && onRegistrations && !stopped) {
          const forms = ((await request('register.php?id=' + id, { token }).catch(() => null))?.items as Registration[] | undefined) ?? [];
          if (forms.length && !stopped && onRegistrations(forms)) {
            // Not confirmed (offline)? They come again next time, and adding them twice is harmless.
            await request(`register.php?id=${id}&action=done`, { method: 'POST', token, body: { ids: forms.map((f) => f.id) } }).catch(() => null);
          }
        }
      } catch (err) {
        if (stopped) return;
        if (err instanceof HttpError && err.status === 404) {
          version = 0;
          onChange(null);
        } else if (!(err instanceof HttpError)) {
          setStatus({ kind: 'error', message: explain(err) });
        }
      }
      schedule();
    };

    const onVisible = () => {
      if (document.visibilityState !== 'visible' || stopped) return;
      if (timer) clearTimeout(timer);
      void poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (bidTimer) clearTimeout(bidTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }

  // A first, quiet check so the status line can say "Cloud sync on".
  void request('ping.php').then(
    () => setStatus({ kind: 'on' }),
    (err) => setStatus({ kind: 'error', message: explain(err) }),
  );

  return {
    saveAuction(id, state, updatedAt, token) {
      pending.set(id, { state, updatedAt, token });
      void flush();
    },
    retry() {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      retryDelay = 2000;
      void flush();
    },
    async listMine() {
      const res = await request('my-auctions.php');
      return ((res?.auctions as AuctionMeta[] | undefined) ?? []).filter((a) => typeof a.id === 'string');
    },
    removeAuction(id, token) {
      pending.delete(id);
      sentPhotos.delete(id);
      void request(`auction.php?id=${id}&action=delete`, { method: 'POST', token }).catch((err) => console.warn('Cloud delete', err));
    },
    watchAuction,
    async register(id, form) {
      try {
        await request('register.php?id=' + id, { method: 'POST', body: { player: form } });
      } catch (err) {
        throw new Error(err instanceof HttpError ? err.code : 'offline');
      }
    },
    async checkOwnerKey(id, teamId, key) {
      try {
        await request(`bid.php?id=${id}&team=${encodeURIComponent(teamId)}&key=${encodeURIComponent(key)}`);
        return true;
      } catch (err) {
        if (err instanceof HttpError) return false;
        throw err;
      }
    },
    async ownerBid(id, teamId, key, kind, seen) {
      let sent: Record<string, unknown> | null;
      try {
        sent = await request('bid.php?id=' + id, { method: 'POST', body: { teamId, key, kind, seen } });
      } catch (err) {
        if (err instanceof HttpError) {
          return { id: '', ok: false, reason: err.code === 'too_many' ? 'Slow down — your last bid is still being checked' : err.code === 'closed' ? 'Owner bidding is turned off by the organiser' : 'Could not send the bid (' + err.code + ')' };
        }
        return { id: '', ok: false, reason: 'No internet. The bid was not sent' };
      }
      const bidId = String(sent?.id ?? '');
      // The organiser's app answers within a second or two.
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 500));
        try {
          const res = await request(`bid.php?id=${id}&team=${encodeURIComponent(teamId)}&key=${encodeURIComponent(key)}&bid=${bidId}`);
          if (res?.status === 'done') return { id: bidId, ok: !!res.ok, tie: !!res.tie, reason: String(res.reason ?? '') };
          if (res?.status === 'gone') break;
        } catch {
          // Brief network trouble: keep waiting.
        }
      }
      return { id: bidId, ok: false, reason: 'No answer from the auction desk. Check the screen and try again' };
    },
    status: () => status,
    onStatus(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
