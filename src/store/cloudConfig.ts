// Where the cloud API lives. The Hostinger build sets VITE_API_BASE to '/api/'
// (see vite.config.ts); the plain local build leaves it empty, and then
// everything stays in this browser and nothing is sent anywhere.
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? '';

/** True when cloud sync is switched on (an API is set, and not the embed preview). */
export const CLOUD = import.meta.env.VITE_EMBED !== '1' && !!API_BASE;
