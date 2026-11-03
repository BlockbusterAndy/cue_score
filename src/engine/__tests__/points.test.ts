import { describe, expect, it } from 'vitest';
import { pointsModule as mod } from '../modes/points';
import { freeModule } from '../modes/free';
import { active, foul, makeConfig, miss, pot, run } from './helpers';

const teams = (rules = {}) => mod.init(makeConfig('points', [['A1', 'A2'], ['B1', 'B2']], rules));

describe('points snooker', () => {
  it('rotates turns across teams: T1P1 → T2P1 → T1P2 → T2P2', () => {
    let s = teams();
    const seen = [active(s)];
    for (let i = 0; i < 4; i++) {
      s = run(s, [miss]);
      seen.push(active(s));
    }
    expect(seen).toEqual(['A1', 'B1', 'A2', 'B2', 'A1']);
  });

  it('pots any ball in any order with house values', () => {
    const s = run(teams(), [pot('black'), pot('red'), pot('yellow')]);
    expect(s.scores).toEqual([19, 0]);
    expect(s.currentBreak?.points).toBe(19);
  });

  it('greys potted balls but lets them be potted again if they come back on', () => {
    const s = run(teams(), [pot('black'), pot('red'), pot('yellow'), pot('pink'), pot('pink')]);
    expect(s.scores[0]).toBe(31);
    expect(mod.getLegalBalls(s)).toEqual(['green', 'brown', 'blue']);
    expect(mod.getStatus(s).pointsLeft).toBe(3 + 4 + 5);
  });

  it('new rack keeps the scores and puts the balls back', () => {
    let s = run(teams(), [pot('red'), pot('yellow'), pot('green'), pot('brown'), pot('blue'), pot('pink'), pot('black')]);
    expect(mod.getStatus(s).ballOn).toBe('Rack cleared');
    expect(mod.getStatus(s).pointsLeft).toBe(0);
    s = run(s, [{ type: 'newRack' }]);
    expect(s.scores).toEqual([37, 0]);
    expect(s.rack).toBe(2);
    expect(mod.getStatus(s).pointsLeft).toBe(37);
    expect(mod.isFrameOver(s)).toBe(false);
  });

  it('no rack: every potted ball goes back on its spot and stays available', () => {
    const all = ['red', 'yellow', 'green', 'brown', 'blue', 'pink', 'black'];
    const start = teams({ noRack: true });
    const s = run(start, [pot('red'), pot('red'), pot('black'), pot('black'), pot('black')]);
    expect(s.scores[0]).toBe(41);
    expect(s.stats.A1.pots).toEqual({ red: 2, black: 3 });
    expect(mod.getLegalBalls(s)).toEqual(all);
    expect(mod.getStatus(s).ballOnIds).toEqual(all);
    expect(mod.getStatus(s).pointsLeft).toBeNull();
  });

  it('subtracts the foul ball value from the fouler and allows negative scores', () => {
    let s = run(teams(), [foul('black')]);
    expect(s.scores).toEqual([-7, 0]);
    expect(active(s)).toBe('B1');
    s = run(s, [miss, foul('red')]);
    expect(s.scores).toEqual([-17, 0]);
    expect(s.stats.A1.fouls).toBe(1);
    expect(s.stats.A2.fouls).toBe(1);
    expect(mod.getStatus(s).lead).toEqual({ side: 1, points: 17 });
  });

  it('can award a fixed foul to the opponents instead', () => {
    const s = run(teams({ foul: { target: 'opponents', amount: 'fixed', fixedValue: 4 } }), [foul('black')]);
    expect(s.scores).toEqual([0, 4]);
  });

  it('no rack: never clears, and New rack is rejected', () => {
    const s = run(teams({ noRack: true }), [pot('red'), pot('yellow'), pot('green'), pot('brown'), pot('blue'), pot('pink'), pot('black'), pot('red')]);
    expect(s.scores).toEqual([47, 0]);
    expect(mod.getStatus(s).ballOn).toBe('Any ball');
    expect(mod.apply(s, { type: 'newRack' })).toBe(s);
    expect(mod.isFrameOver(s)).toBe(false);
  });

  it('respects edited ball values', () => {
    const cfg = makeConfig('points', [['A'], ['B']]);
    cfg.rules.balls = cfg.rules.balls.map((b) => (b.id === 'red' ? { ...b, value: 15 } : b));
    const s = run(mod.init(cfg), [pot('red')]);
    expect(s.scores[0]).toBe(15);
  });

  it('ends the frame at the target score', () => {
    const s = run(teams({ targetScore: 15 }), [pot('red'), pot('black')]);
    expect(mod.isFrameOver(s)).toBe(true);
    expect(s.winnerSide).toBe(0);
    expect(mod.apply(s, pot('pink'))).toBe(s);
  });

  it('tap any player to put them at the table', () => {
    const s = run(teams(), [{ type: 'setActive', playerId: 'B2' }]);
    expect(active(s)).toBe('B2');
    s.order.forEach((id) => expect(['A1', 'A2', 'B1', 'B2']).toContain(id));
  });

  it('works free-for-all with 3 players', () => {
    let s = mod.init(makeConfig('points', [['A'], ['B'], ['C']]));
    s = run(s, [pot('red'), miss, pot('black'), miss, foul('pink')]);
    expect(s.scores).toEqual([10, 7, -6]);
    expect(active(s)).toBe('A');
  });
});

describe('free scoring', () => {
  it('scores custom balls with no rules', () => {
    const cfg = makeConfig('free', [['A'], ['B']]);
    cfg.rules.balls = [
      { id: 'x', label: 'Spot', value: 3, color: '#f00' },
      { id: 'y', label: 'Stripe', value: 5, color: '#00f' },
    ];
    const s = run(freeModule.init(cfg), [pot('y'), pot('y'), pot('x', 2), foul('y')]);
    expect(s.scores).toEqual([16 - 5, 0]);
    expect(freeModule.getStatus(s).pointsLeft).toBeNull();
  });
});
