import { describe, expect, it } from 'vitest';
import { killerModule as mod } from '../modes/killer';
import { active, foul, makeConfig, miss, pot, run } from './helpers';

const game = (n: number, lives: number) =>
  mod.init(makeConfig('killer', Array.from({ length: n }, (_, i) => [`P${i + 1}`]), { lives }));

describe('killer', () => {
  it('a pot keeps your life and you play again', () => {
    const s = run(game(3, 3), [pot('any'), pot('any')]);
    expect(active(s)).toBe('P1');
    expect(s.table.kind === 'killer' && s.table.lives.P1).toBe(3);
  });

  it('a miss costs a life and passes the turn', () => {
    const s = run(game(3, 3), [miss]);
    expect(s.table.kind === 'killer' && s.table.lives.P1).toBe(2);
    expect(active(s)).toBe('P2');
  });

  it('knocks players out in order and the last one standing wins', () => {
    // 4 players, 2 lives each.
    let s = game(4, 2);
    s = run(s, [
      miss, // P1 → 1
      pot('any'), miss, // P2 → 1
      miss, // P3 → 1
      pot('any'), miss, // P4 → 1
      miss, // P1 → out
      pot('any'), pot('any'), miss, // P2 → out
      foul('any'), // P3 → out (foul also costs a life)
    ]);
    expect(s.table.kind === 'killer' && s.table.eliminated).toEqual(['P1', 'P2', 'P3']);
    expect(mod.isFrameOver(s)).toBe(true);
    expect(s.winnerSide).toBe(3);
  });

  it('skips knocked-out players in the rotation', () => {
    let s = run(game(3, 1), [miss]); // P1 out
    expect(active(s)).toBe('P2');
    s = run(s, [pot('any'), { type: 'endTurn' }]);
    expect(mod.isFrameOver(s)).toBe(true);
    expect(s.winnerSide).toBe(2);
  });

  it('cannot put a knocked-out player at the table', () => {
    const s = run(game(3, 1), [miss]);
    expect(mod.apply(s, { type: 'setActive', playerId: 'P1' })).toBe(s);
  });

  it('supports up to 10 players', () => {
    const s = game(10, 3);
    expect(s.order).toHaveLength(10);
  });
});
