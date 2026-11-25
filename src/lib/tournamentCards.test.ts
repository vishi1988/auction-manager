import { describe, expect, it } from 'vitest';
import { createDummyState } from '../data/dummy';
import { statLine } from './tournamentCards';

describe('stat line on share pictures', () => {
  it('writes cricket numbers the usual way', () => {
    const s = createDummyState('cricket');
    expect(statLine(s, { runs: 52, balls: 24 })).toBe('52* (24)');
    expect(statLine(s, { runs: 52, balls: 24, out: 1, ballsBowled: 15, runsGiven: 18, wickets: 3, catches: 2 })).toBe('52 (24) · 3/18 (2.3) · 2 ct');
  });

  it('lists other sports by stat name', () => {
    const s = createDummyState('football');
    expect(statLine(s, { goals: 2, assists: 1 })).toBe('2 Goals · 1 Assists');
    expect(statLine(s, { cleanSheet: 1 })).toBe('Clean sheet');
  });
});
