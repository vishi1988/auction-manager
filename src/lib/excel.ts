import { sportOf, type Sport } from '../data/sports';
import type { AppState, Category, Player, Role, Tag } from '../types';
import { uid } from './format';
import { teamStats } from './rules';

export const TEMPLATE_COLUMNS = [
  'Player No', 'Name', 'Age', 'Mobile', 'Role', 'Batting', 'Bowling', 'Category', 'Tag',
  'Jersey Name', 'Jersey No', 'T-shirt', 'Base Price',
];

/** The Excel library is large, so it is only downloaded when a file is read or written. */
const loadXlsx = () => import('xlsx');

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

function pick(row: Record<string, unknown>, ...names: string[]): string {
  const wanted = names.map(norm);
  for (const [k, v] of Object.entries(row)) if (wanted.includes(norm(k))) return String(v ?? '').trim();
  return '';
}

function toRole(value: string, sport: Sport): Role {
  const v = norm(value);
  if (sport.id === 'cricket') {
    if (v.includes('keep') || v === 'wk') return 'Wicket-keeper';
    if (v.includes('all') || v === 'ar') return 'All-rounder';
    if (v.includes('bowl')) return 'Bowler';
    return 'Batsman';
  }
  return (
    sport.roles.find((r) => norm(r) === v) ??
    sport.roles.find((r) => v && (norm(r).startsWith(v) || v.startsWith(norm(r)))) ??
    (value.trim() || sport.roles[0]!)
  );
}

function toTag(value: string): Tag {
  const v = norm(value);
  if (v === 'owner') return 'Owner';
  if (v === 'captain') return 'Captain';
  if (v === 'vicecaptain') return 'Vice Captain';
  if (v === 'icon') return 'Icon';
  return '';
}

function toCategory(value: string, categories: Category[]): string {
  const v = norm(value);
  const found =
    categories.find((c) => norm(c.name) === v) ??
    categories.find((c) => norm(c.name).endsWith(v) && v.length > 0) ??
    categories[categories.length - 1]!;
  return found.id;
}

export interface ImportResult {
  players: Player[];
  skipped: number;
}

export async function readPlayersFile(file: File, state: AppState): Promise<ImportResult> {
  const XLSX = await loadXlsx();
  const wb = XLSX.read(await file.arrayBuffer());
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const sport = sportOf(state.settings.sport);
  let nextNo = Math.max(100, ...state.players.map((p) => p.no)) + 1;
  const players: Player[] = [];
  let skipped = 0;
  for (const row of rows) {
    const name = pick(row, 'Name', 'Player Name', 'Full Name');
    if (!name) {
      skipped++;
      continue;
    }
    const no = Number(pick(row, 'Player No', 'No', 'Number', 'Form No'));
    const age = Number(pick(row, 'Age'));
    const base = Number(pick(row, 'Base Price', 'Base', 'Base Value'));
    players.push({
      id: uid('p'),
      no: Number.isFinite(no) && no > 0 ? no : nextNo++,
      name,
      age: age > 0 ? age : undefined,
      mobile: pick(row, 'Mobile', 'Mobile No', 'Phone'),
      role: toRole(pick(row, 'Role', 'Playing Role', 'Type', 'Position'), sport),
      batting: sport.hasBatBowl ? pick(row, 'Batting', 'Batting Style') || 'Right hand' : '',
      bowling: sport.hasBatBowl ? pick(row, 'Bowling', 'Bowling Style') || '—' : '',
      categoryId: toCategory(pick(row, 'Category', 'Set'), state.categories),
      tag: toTag(pick(row, 'Tag')),
      jerseyName: pick(row, 'Jersey Name'),
      jerseyNo: pick(row, 'Jersey No', 'Jersey Number'),
      tshirt: pick(row, 'T-shirt', 'Tshirt', 'T-shirt Size'),
      photo: pick(row, 'Photo', 'Photo URL') || undefined,
      basePrice: base > 0 ? base : null,
      status: 'available',
      teamId: null,
      price: null,
      previousTeamId: null,
    });
  }
  return { players, skipped };
}

export function templateColumns(sport: Sport) {
  return sport.hasBatBowl ? TEMPLATE_COLUMNS : TEMPLATE_COLUMNS.filter((c) => c !== 'Batting' && c !== 'Bowling');
}

export async function downloadTemplate(sport: Sport) {
  const XLSX = await loadXlsx();
  const rows = sport.hasBatBowl
    ? [
        [101, 'Rohit Pawar', 24, '9800000000', 'Batsman', 'Right hand', '—', 'Marquee', 'Icon', 'PAWAR', 18, 'M', ''],
        [102, 'Akash More', 27, '', 'Bowler', 'Right hand', 'Right-arm fast', 'A', '', '', '', 'L', ''],
      ]
    : [
        [101, 'Rohit Pawar', 24, '9800000000', sport.roles[0], 'Marquee', 'Icon', 'PAWAR', 18, 'M', ''],
        [102, 'Akash More', 27, '', sport.roles[1] ?? sport.roles[0], 'A', '', '', '', 'L', ''],
      ];
  const ws = XLSX.utils.aoa_to_sheet([templateColumns(sport), ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Players');
  XLSX.writeFile(wb, 'players-template.xlsx');
}

export async function exportResults(state: AppState) {
  const XLSX = await loadXlsx();
  const cat = (id: string) => state.categories.find((c) => c.id === id)?.name ?? '';
  const how = (p: Player) =>
    p.status === 'retained' ? 'Retained' : ({ rtm: 'RTM', draw: 'Lucky draw' } as Record<string, string>)[state.log.find((l) => l.playerId === p.id)?.type ?? ''] ?? 'Auction';

  const squads = state.teams.flatMap((t) =>
    teamStats(state, t.id).squad.map((p) => ({
      Team: t.name, 'Player No': p.no, Name: p.name, Role: p.role, Category: cat(p.categoryId),
      Price: p.price ?? 0, 'Bought by': how(p),
    })),
  );
  const summary = state.teams.map((t) => {
    const st = teamStats(state, t.id);
    return { Team: t.name, Owner: t.owner, Players: st.count, Spent: st.spent, 'Purse left': st.purseLeft };
  });
  const unsold = state.players
    .filter((p) => p.status === 'unsold' || p.status === 'available')
    .map((p) => ({ 'Player No': p.no, Name: p.name, Role: p.role, Category: cat(p.categoryId), Status: p.status }));
  const log = state.log.map((l, i) => ({
    '#': i + 1,
    Time: new Date(l.at).toLocaleTimeString(),
    Round: l.round,
    Result: l.type.toUpperCase(),
    Player: state.players.find((p) => p.id === l.playerId)?.name ?? '',
    Team: state.teams.find((t) => t.id === l.teamId)?.name ?? '',
    Price: l.amount ?? '',
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(squads), 'Squads');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unsold), 'Not sold');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(log), 'Auction log');
  XLSX.writeFile(wb, state.settings.name.replace(/[^\w ]+/g, '') + ' - results.xlsx');
}
