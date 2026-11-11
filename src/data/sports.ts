// Sports an auction can be run for. Each sport brings its own player roles;
// cricket also records batting and bowling style.
export type SportId = 'cricket' | 'football' | 'kabaddi' | 'volleyball' | 'hockey' | 'basketball' | 'badminton' | 'other';

export interface Sport {
  id: SportId;
  name: string;
  roles: string[];
  /** Cricket shows batting/bowling columns and fields. */
  hasBatBowl: boolean;
}

export const SPORTS: Sport[] = [
  { id: 'cricket', name: 'Cricket', roles: ['Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper', 'Fielder'], hasBatBowl: true },
  { id: 'football', name: 'Football', roles: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'], hasBatBowl: false },
  { id: 'kabaddi', name: 'Kabaddi', roles: ['Raider', 'Defender', 'All-rounder'], hasBatBowl: false },
  { id: 'volleyball', name: 'Volleyball', roles: ['Setter', 'Attacker', 'Blocker', 'Libero', 'All-rounder'], hasBatBowl: false },
  { id: 'hockey', name: 'Hockey', roles: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'], hasBatBowl: false },
  { id: 'basketball', name: 'Basketball', roles: ['Guard', 'Forward', 'Center'], hasBatBowl: false },
  { id: 'badminton', name: 'Badminton', roles: ['Singles', 'Doubles', 'All-round'], hasBatBowl: false },
  { id: 'other', name: 'Other sport', roles: ['Player'], hasBatBowl: false },
];

export const sportOf = (id: string | undefined): Sport => SPORTS.find((s) => s.id === id) ?? SPORTS[0]!;
