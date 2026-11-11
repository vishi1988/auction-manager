// Google sign-in for the online app (khiladiauction.com/app/).
//
// Saving auctions online needs a signed-in Google account; the auctions then
// belong to that account and open on any device. The sign-in itself is a
// cookie that only the API can read, so nothing secret is kept in the page.
// Without sign-in (or without internet) the app keeps working in this browser.
import { useSyncExternalStore } from 'react';
import { API_BASE, CLOUD } from './cloudConfig';

export interface User {
  id: number;
  email: string;
  name: string;
  picture: string;
}

export interface AuthState {
  /** False in the local and preview builds: there is no sign-in there. */
  enabled: boolean;
  /** True once the server has said who is signed in (or we know we are offline). */
  checked: boolean;
  /** Google client id for the sign-in button; empty until the server is set up. */
  clientId: string;
  user: User | null;
  busy: boolean;
  error: string | null;
}

const USER_KEY = 'auction-app:user';

function cachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function cacheUser(user: User | null) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    // Private window or full storage: only the offline start is affected.
  }
}

let auth: AuthState = { enabled: CLOUD, checked: !CLOUD, clientId: '', user: null, busy: false, error: null };
const listeners = new Set<() => void>();
const userListeners = new Set<(user: User | null) => void>();

function set(patch: Partial<AuthState>) {
  const before = auth.user?.id ?? null;
  auth = { ...auth, ...patch };
  for (const l of listeners) l();
  if ((auth.user?.id ?? null) !== before) for (const l of userListeners) l(auth.user);
}

const base = API_BASE.replace(/\/?$/, '/');

async function call(path: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw Object.assign(new Error(String(json.error ?? 'http_' + res.status)), { status: res.status });
  return json;
}

/** Asks the server who is signed in. Offline, the last known user is kept so saving resumes later. */
export async function refreshSession(): Promise<void> {
  try {
    const res = await call('session.php');
    const user = (res.user as User | null) ?? null;
    cacheUser(user);
    set({ checked: true, clientId: String(res.clientId ?? ''), user });
  } catch (err) {
    const status = (err as { status?: number }).status;
    // A server answer (e.g. not set up yet) means "not signed in"; no answer means offline.
    set({ checked: true, user: status ? null : cachedUser() });
  }
}

const reasons: Record<string, string> = {
  google_not_configured: 'Google sign-in is not set up on the server yet.',
  google_unreachable: 'Could not reach Google to check the sign-in. Please try again.',
  email_not_verified: 'This Google account has no verified email address.',
  db_unavailable: 'The server database is not set up yet.',
  not_configured: 'The server database is not set up yet.',
};

/** Called with the credential from Google's sign-in button. */
export async function signInWithGoogle(credential: string): Promise<void> {
  set({ busy: true, error: null });
  try {
    const res = await call('login.php', { credential });
    const user = res.user as User;
    cacheUser(user);
    set({ busy: false, user });
  } catch (err) {
    const code = (err as Error).message;
    set({ busy: false, error: reasons[code] ?? ((err as { status?: number }).status ? 'Sign-in was refused (' + code + ').' : 'No internet right now. Please try again.') });
  }
}

export async function signOut(): Promise<void> {
  set({ busy: true, error: null });
  try {
    await call('session.php?action=logout', {});
  } catch {
    // Offline: the cookie stays until it expires, but this browser forgets the user now.
  }
  cacheUser(null);
  window.google?.accounts.id.disableAutoSelect();
  set({ busy: false, user: null });
}

export const getAuth = () => auth;

export function useAuth(): AuthState {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), getAuth);
}

/** Runs `fn` whenever someone signs in or out. Returns the function that stops it. */
export function onUserChange(fn: (user: User | null) => void): () => void {
  userListeners.add(fn);
  return () => userListeners.delete(fn);
}

if (CLOUD) void refreshSession();

// ---------- Google's sign-in button (Google Identity Services) ----------

interface GoogleIdApi {
  initialize(options: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: 'popup'; auto_select?: boolean; use_fedcm_for_button?: boolean }): void;
  renderButton(el: HTMLElement, options: Record<string, string | number>): void;
  disableAutoSelect(): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

let gisScript: Promise<GoogleIdApi> | null = null;
let initializedFor = '';

/** Loads Google's sign-in script once and sets it up for our client id. */
export function loadGoogleSignIn(clientId: string): Promise<GoogleIdApi> {
  gisScript ??= new Promise<GoogleIdApi>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => (window.google ? resolve(window.google.accounts.id) : reject(new Error('no google')));
    s.onerror = () => {
      gisScript = null;
      reject(new Error('Google sign-in could not load'));
    };
    document.head.appendChild(s);
  });
  return gisScript.then((id) => {
    if (initializedFor !== clientId) {
      id.initialize({ client_id: clientId, callback: (r) => void signInWithGoogle(r.credential), ux_mode: 'popup', use_fedcm_for_button: true });
      initializedFor = clientId;
    }
    return id;
  });
}
