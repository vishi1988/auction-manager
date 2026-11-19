// Photos are read from IndexedDB before the app starts, so every screen can
// load an auction with its photos straight away (see store/photoCache.ts).
import { photoCacheReady } from './store/photoCache';

void photoCacheReady.then(() => import('./boot'));
