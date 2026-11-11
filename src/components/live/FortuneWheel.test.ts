import { describe, expect, it } from 'vitest';
import { DRAW_MS } from '../../lib/auction';
import type { Draw } from '../../types';
import { wheelAngle } from './FortuneWheel';

/** Which slice sits under the pointer at the top for a wheel turned by `angle`. */
function sliceAtPointer(angle: number, n: number) {
  const seg = 360 / n;
  // A slice that starts at a0 is now at a0 + angle; the pointer is at 0 degrees.
  const a = (((-angle % 360) + 360) % 360);
  return Math.floor(a / seg);
}

const draw = (teamIds: string[], winnerId: string): Draw => ({ amount: 1, teamIds, winnerId, startedAt: 1000 });

describe('lucky draw wheel', () => {
  it('stops on the winner for every team count and position', () => {
    for (let n = 2; n <= 8; n++) {
      const ids = Array.from({ length: n }, (_, i) => 't' + i);
      for (let w = 0; w < n; w++) {
        const d = draw(ids, ids[w]!);
        expect(sliceAtPointer(wheelAngle(d, d.startedAt + DRAW_MS), n)).toBe(w);
      }
    }
  });

  it('stays still before the start and after the end', () => {
    const d = draw(['a', 'b', 'c'], 'b');
    expect(wheelAngle(d, d.startedAt - 500)).toBe(0);
    expect(wheelAngle(d, d.startedAt + DRAW_MS + 5000)).toBe(wheelAngle(d, d.startedAt + DRAW_MS));
  });

  it('only turns forward', () => {
    const d = draw(['a', 'b', 'c', 'd'], 'd');
    let last = -1;
    for (let t = 0; t <= DRAW_MS; t += 100) {
      const a = wheelAngle(d, d.startedAt + t);
      expect(a).toBeGreaterThanOrEqual(last);
      last = a;
    }
  });
});
