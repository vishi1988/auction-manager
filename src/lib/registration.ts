import type { AppState, ExtraTshirt, Player, Registration } from '../types';

export const TSHIRT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

const digits = (s: string | undefined) => (s ?? '').replace(/\D/g, '');

export const sameMobile = (a: string | undefined, b: string | undefined) => !!digits(a) && digits(a) === digits(b);

/** A registered player joins on hold, in the last category, until the organiser reviews them. */
export function playerFromRegistration(s: AppState, f: Registration, id: string): Player {
  return {
    id,
    no: Math.max(100, ...s.players.map((p) => p.no)) + 1,
    name: f.name.trim(),
    age: f.age,
    mobile: digits(f.mobile),
    role: f.role,
    batting: f.batting,
    bowling: f.bowling,
    categoryId: s.categories[s.categories.length - 1]!.id,
    tag: '',
    jerseyName: f.jerseyName,
    jerseyNo: f.jerseyNo,
    tshirt: f.tshirt,
    extraTshirts: f.extraTshirts?.length ? f.extraTshirts : undefined,
    photo: f.photo || undefined,
    status: 'hold',
    teamId: null,
    price: null,
    previousTeamId: null,
    selfRegistered: true,
  };
}

/** "Self: L · Asha: Kids 28" — a player's extra T-shirts in one line. */
export function extrasSummary(extras: ExtraTshirt[] | undefined): string {
  return (extras ?? []).map((x) => (x.who === 'other' ? (x.name || 'Non-player') + ': ' : 'Self: ') + x.size).join(' · ');
}

export interface TshirtRow {
  'Player No': number;
  Player: string;
  Mobile: string;
  Team: string;
  'T-shirt for': string;
  Type: 'Player' | 'Extra (player)' | 'Extra (non-player)';
  Size: string;
  'Name on shirt': string;
  'Number on shirt': string;
}

/** Every T-shirt to order: each player's own, then their extras. */
export function tshirtRows(s: AppState): TshirtRow[] {
  const rows: TshirtRow[] = [];
  for (const p of [...s.players].sort((a, b) => a.no - b.no)) {
    const base = { 'Player No': p.no, Player: p.name, Mobile: p.mobile ?? '', Team: s.teams.find((t) => t.id === p.teamId)?.name ?? '' };
    if (p.tshirt) {
      rows.push({ ...base, 'T-shirt for': p.name, Type: 'Player', Size: p.tshirt, 'Name on shirt': p.jerseyName ?? '', 'Number on shirt': p.jerseyNo ?? '' });
    }
    for (const x of p.extraTshirts ?? []) {
      const own = x.who !== 'other';
      rows.push({
        ...base,
        'T-shirt for': own ? p.name : x.name || 'Non-player',
        Type: own ? 'Extra (player)' : 'Extra (non-player)',
        Size: x.size,
        'Name on shirt': x.jerseyName || (own ? p.jerseyName ?? '' : ''),
        'Number on shirt': x.jerseyNo || (own ? p.jerseyNo ?? '' : ''),
      });
    }
  }
  return rows;
}

/** How many of each size, standard sizes first. */
export function sizeCounts(rows: TshirtRow[]): { Size: string; Player: number; Extra: number; Total: number }[] {
  const map = new Map<string, { Size: string; Player: number; Extra: number; Total: number }>();
  for (const r of rows) {
    const key = r.Size.trim().toUpperCase();
    const c = map.get(key) ?? { Size: r.Size.trim(), Player: 0, Extra: 0, Total: 0 };
    if (r.Type === 'Player') c.Player++;
    else c.Extra++;
    c.Total++;
    map.set(key, c);
  }
  const rank = (size: string) => {
    const i = TSHIRT_SIZES.indexOf(size.toUpperCase());
    return i < 0 ? TSHIRT_SIZES.length : i;
  };
  return [...map.values()].sort((a, b) => rank(a.Size) - rank(b.Size) || a.Size.localeCompare(b.Size));
}
