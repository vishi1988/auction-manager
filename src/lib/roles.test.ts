import { describe, expect, it } from 'vitest';
import { areaOfPath, canOpen, canSetUpTournament } from './roles';

describe('scorer role', () => {
  it('opens only matches, results and the auction team page', () => {
    expect(canOpen('scorer', 'matches')).toBe(true);
    expect(canOpen('scorer', 'results')).toBe(true);
    for (const area of ['settings', 'teams', 'players', 'console'] as const) expect(canOpen('scorer', area)).toBe(false);
  });

  it('cannot change the format or make fixtures', () => {
    expect(canSetUpTournament('scorer')).toBe(false);
    expect(canSetUpTournament('data')).toBe(true);
    expect(canSetUpTournament('owner')).toBe(true);
  });

  it('finds the matches screen from its path', () => {
    expect(areaOfPath('/matches?tab=stats')).toBe('matches');
    expect(areaOfPath('/tournament')).toBe(null);
  });
});
