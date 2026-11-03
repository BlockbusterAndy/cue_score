import { describe, expect, it } from 'vitest';
import { applyMatch, initMatch, matchPlayerTotals, replay } from '../match';
import { buildOrder } from '../common';
import type { MatchAction } from '../types';
import { makeConfig, miss, pot } from './helpers';

describe('match', () => {
  it('undo = replay without the last action', () => {
    const cfg = makeConfig('points', [['A1', 'A2'], ['B1', 'B2']]);
    const actions: MatchAction[] = [pot('red'), pot('black'), miss, pot('pink')];
    const full = replay(cfg, actions);
    const undone = replay(cfg, actions.slice(0, -1));
    expect(full.frame.scores).toEqual([17, 6]);
    expect(undone.frame.scores).toEqual([17, 0]);
    expect(undone.frame.order[undone.frame.activeIdx]).toBe('B1');
  });

  it('plays a best-of-3 and rotates the break', () => {
    const cfg = makeConfig('points', [['A'], ['B']], {}, 3);
    let m = initMatch(cfg);
    expect(m.frame.order[m.frame.activeIdx]).toBe('A');
    m = applyMatch(m, pot('red'));
    m = applyMatch(m, { type: 'endFrame' });
    expect(m.frameWins).toEqual([1, 0]);
    expect(m.over).toBe(false);
    m = applyMatch(m, { type: 'nextFrame' });
    expect(m.frame.scores).toEqual([0, 0]);
    expect(m.frame.order[m.frame.activeIdx]).toBe('B');
    m = applyMatch(m, pot('black'));
    m = applyMatch(m, { type: 'endFrame' });
    m = applyMatch(m, { type: 'nextFrame' });
    m = applyMatch(m, pot('pink'));
    m = applyMatch(m, { type: 'concede', side: 1 });
    expect(m.frameWins).toEqual([2, 1]);
    expect(m.over).toBe(true);
    expect(m.winnerSide).toBe(0);
    expect(applyMatch(m, { type: 'nextFrame' })).toBe(m);
    expect(matchPlayerTotals(m).A.points).toBe(16);
  });

  it('rejected actions return the same match object', () => {
    const m = initMatch(makeConfig('snooker', [['A'], ['B']]));
    expect(applyMatch(m, pot('black'))).toBe(m);
    expect(applyMatch(m, { type: 'nextFrame' })).toBe(m);
  });

  it('builds a fair rotation for uneven teams', () => {
    const order = buildOrder([
      { name: 'T1', playerIds: ['a', 'b'] },
      { name: 'T2', playerIds: ['x', 'y', 'z'] },
    ]);
    expect(order).toEqual(['a', 'x', 'b', 'y', 'a', 'z', 'b', 'x', 'a', 'y', 'b', 'z']);
  });
});
