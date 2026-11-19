// Photos and logos are kept out of the main auction record in the cloud:
// Firestore allows 1 MB per record, and a bid should not re-send every photo.
import type { AppState } from '../types';

/** Photo id -> image data. Ids look like "player-p_abc", "team-t_xyz" or "sponsor-s_abc". */
export type PhotoMap = Record<string, string>;

const playerKey = (id: string) => 'player-' + id;
const teamKey = (id: string) => 'team-' + id;
const sponsorKey = (id: string) => 'sponsor-' + id;

/** Splits an auction into its data without images, and the images on their own. */
export function splitPhotos(state: AppState): { lean: AppState; photos: PhotoMap } {
  const photos: PhotoMap = {};
  const lean: AppState = {
    ...state,
    players: state.players.map((p) => {
      if (!p.photo) return p;
      photos[playerKey(p.id)] = p.photo;
      const { photo: _photo, ...rest } = p;
      return rest;
    }),
    teams: state.teams.map((t) => {
      if (!t.logo) return t;
      photos[teamKey(t.id)] = t.logo;
      const { logo: _logo, ...rest } = t;
      return rest;
    }),
    ...(state.sponsors
      ? {
          sponsors: state.sponsors.map((s) => {
            if (!s.logo) return s;
            photos[sponsorKey(s.id)] = s.logo;
            const { logo: _logo, ...rest } = s;
            return rest;
          }),
        }
      : {}),
  };
  return { lean, photos };
}

/** Puts the images back onto the players and teams they belong to. */
export function mergePhotos(lean: AppState, photos: PhotoMap): AppState {
  return {
    ...lean,
    players: lean.players.map((p) => (photos[playerKey(p.id)] ? { ...p, photo: photos[playerKey(p.id)] } : p)),
    teams: lean.teams.map((t) => (photos[teamKey(t.id)] ? { ...t, logo: photos[teamKey(t.id)] } : t)),
    ...(lean.sponsors ? { sponsors: lean.sponsors.map((s) => (photos[sponsorKey(s.id)] ? { ...s, logo: photos[sponsorKey(s.id)] } : s)) } : {}),
  };
}

/** What has to be written and removed in the cloud to go from `before` to `after`. */
export function diffPhotos(before: PhotoMap, after: PhotoMap): { put: PhotoMap; remove: string[] } {
  const put: PhotoMap = {};
  for (const [k, v] of Object.entries(after)) if (before[k] !== v) put[k] = v;
  return { put, remove: Object.keys(before).filter((k) => !(k in after)) };
}
