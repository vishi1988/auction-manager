import { describe, expect, it } from 'vitest';
import type { AppState } from '../types';
import { createDummyState, migrateState } from './dummy';

describe('saved auctions from older versions', () => {
  it('turns the old "Stamp + burst" sold effect into Fireworks', () => {
    const s = createDummyState('cricket', { name: 'Old League' });
    (s.settings as unknown as { soldEffect: string }).soldEffect = 'burst';
    expect(migrateState(s as AppState).settings.soldEffect).toBe('fireworks');
  });

  it('keeps a sold effect the organiser chose', () => {
    const s = createDummyState('cricket', { name: 'New League' });
    s.settings.soldEffect = 'confetti';
    expect(migrateState(s).settings.soldEffect).toBe('confetti');
  });
});
