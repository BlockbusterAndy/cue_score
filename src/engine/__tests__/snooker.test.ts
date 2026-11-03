import { describe, expect, it } from 'vitest';
import { snookerModule as mod, shortSnookerModule } from '../modes/snooker';
import type { FrameAction } from '../types';
import { active, foul, makeConfig, miss, pot, run } from './helpers';

const singles = () => mod.init(makeConfig('snooker', [['Ann'], ['Bob']]));
const COLOURS = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];

describe('standard snooker', () => {
  it('starts with 147 on the table and red on', () => {
    const s = singles();
    const st = mod.getStatus(s);
    expect(st.pointsLeft).toBe(147);
    expect(st.ballOn).toBe('Red');
    expect(mod.getLegalBalls(s)).toEqual(['red']);
  });

  it('scores a 147 maximum break', () => {
    const actions: FrameAction[] = [];
    for (let i = 0; i < 15; i++) actions.push(pot('red'), pot('black'));
    for (const c of COLOURS) actions.push(pot(c));
    const s = run(singles(), actions);
    expect(s.scores).toEqual([147, 0]);
    expect(s.stats.Ann.highBreak).toBe(147);
    expect(s.stats.Ann.pots).toEqual({ red: 15, black: 16, yellow: 1, green: 1, brown: 1, blue: 1, pink: 1 });
    expect(mod.isFrameOver(s)).toBe(true);
    expect(s.winnerSide).toBe(0);
    expect(s.endReason).toBe('cleared');
  });

  it('tracks points left through a break', () => {
    let s = run(singles(), [pot('red')]);
    expect(mod.getStatus(s).pointsLeft).toBe(14 * 8 + 7 + 27);
    expect(mod.getStatus(s).ballOn).toBe('Any colour');
    s = run(s, [pot('blue')]);
    expect(mod.getStatus(s).pointsLeft).toBe(14 * 8 + 27);
    expect(s.currentBreak?.points).toBe(6);
    expect(s.currentBreak?.balls).toEqual(['red', 'blue']);
  });

  it('rejects illegal pots without changing state', () => {
    const s = singles();
    expect(mod.apply(s, pot('black'))).toBe(s);
    const s2 = run(s, [pot('red')]);
    expect(mod.apply(s2, pot('red'))).toBe(s2);
  });

  it('counts several reds potted in one shot', () => {
    const s = run(singles(), [pot('red', 3)]);
    expect(s.scores[0]).toBe(3);
    expect(s.table.kind === 'snooker' && s.table.redsLeft).toBe(12);
    expect(mod.getStatus(s).ballOn).toBe('Any colour');
    expect(mod.getStatus(s).pointsLeft).toBe(12 * 8 + 7 + 27);
    expect(s.stats.Ann.pots.red).toBe(3);
  });

  it('never takes more reds than remain', () => {
    const s = run(singles(), [pot('red', 99)]);
    expect(s.scores[0]).toBe(15);
    expect(s.table.kind === 'snooker' && s.table.redsLeft).toBe(0);
  });

  it('miss returns to reds, passes the turn and resets the break', () => {
    const s = run(singles(), [pot('red'), pot('black'), pot('red'), miss]);
    expect(active(s)).toBe('Bob');
    expect(s.currentBreak).toBeNull();
    expect(s.stats.Ann.highBreak).toBe(9);
    expect(mod.getStatus(s).ballOn).toBe('Red');
  });

  it('foul gives at least 4 to the opponent, or the higher ball value', () => {
    let s = run(singles(), [foul('red')]);
    expect(s.scores).toEqual([0, 4]);
    expect(active(s)).toBe('Bob');
    s = run(s, [foul('black')]);
    expect(s.scores).toEqual([7, 4]);
    s = run(s, [foul('pink')]);
    expect(s.scores).toEqual([7, 10]);
    expect(s.stats.Ann.fouls).toBe(2);
    expect(s.stats.Ann.foulPoints).toBe(10);
  });

  it('foul value uses the ball on during the clearance', () => {
    // Clear to the pink, then foul hitting the yellow: penalty is pink value (6).
    const actions: FrameAction[] = [pot('red', 15), pot('black')];
    for (const c of COLOURS.slice(0, 4)) actions.push(pot(c));
    const s = run(singles(), [...actions, foul('yellow')]);
    expect(s.scores[1]).toBe(6);
  });

  it('handles a foul when the last red goes in', () => {
    // Ann pots 14 reds in one go then the black, leaving one red.
    let s = run(singles(), [pot('red', 14), pot('black')]);
    expect(mod.getStatus(s).ballOn).toBe('Last red');
    s = run(s, [foul('red', { redsPotted: 1 })]);
    expect(s.scores).toEqual([21, 4]);
    expect(active(s)).toBe('Bob');
    expect(s.table.kind === 'snooker' && s.table.redsLeft).toBe(0);
    const st = mod.getStatus(s);
    expect(st.ballOn).toBe('Yellow');
    expect(st.pointsLeft).toBe(27);
    expect(mod.getLegalBalls(s)).toEqual(['yellow']);
  });

  it('after potting the last red, one colour then the clearance', () => {
    let s = run(singles(), [pot('red', 15)]);
    expect(mod.getStatus(s).pointsLeft).toBe(7 + 27);
    s = run(s, [miss]);
    expect(mod.getStatus(s).ballOn).toBe('Yellow');
    expect(mod.getStatus(s).pointsLeft).toBe(27);
  });

  it('re-spots the black when scores are level', () => {
    const short = shortSnookerModule;
    const cfg = makeConfig('short', [['Ann'], ['Bob']], { reds: 6 });
    let s = short.init(cfg);
    const actions: FrameAction[] = [];
    for (let i = 0; i < 6; i++) actions.push(pot('red'), pot('black'));
    for (const c of COLOURS.slice(0, 5)) actions.push(pot(c));
    // Ann 68, misses the black. Bob is given 61 then pots the black: 68-68.
    s = run(s, [...actions, miss, { type: 'adjust', side: 1, delta: 61 }, pot('black')]);
    expect(s.scores).toEqual([68, 68]);
    expect(short.isFrameOver(s)).toBe(false);
    const st = short.getStatus(s);
    expect(st.ballOn).toBe('Re-spotted black');
    expect(st.pointsLeft).toBe(7);
    expect(short.getLegalBalls(s)).toEqual(['black']);
    expect(active(s)).toBe('Ann');

    const won = run(s, [pot('black')]);
    expect(won.scores).toEqual([75, 68]);
    expect(won.winnerSide).toBe(0);

    const fouled = run(s, [foul('black')]);
    expect(fouled.scores).toEqual([68, 75]);
    expect(fouled.winnerSide).toBe(1);
    expect(short.isFrameOver(fouled)).toBe(true);
  });

  it('offers a free ball after a foul', () => {
    let s = run(singles(), [foul('red')]);
    expect(mod.getStatus(s).freeBallAvailable).toBe(true);
    s = run(s, [{ type: 'pot', ball: 'green', freeBall: true }]);
    expect(s.scores).toEqual([0, 5]);
    expect(mod.getStatus(s).ballOn).toBe('Any colour');
    expect(mod.getStatus(s).freeBallAvailable).toBe(false);
    // Reds and colours still all on the table.
    expect(s.table.kind === 'snooker' && s.table.redsLeft).toBe(15);
  });

  it('reports snookers needed', () => {
    const actions: FrameAction[] = [];
    for (let i = 0; i < 15; i++) actions.push(pot('red'), pot('black'));
    actions.push(pot('yellow'), miss);
    // 122-0 with 25 left: Bob is 97 short even if he clears → ceil(97/4) = 25 snookers.
    const s = run(singles(), actions);
    const st = mod.getStatus(s);
    expect(st.pointsLeft).toBe(25);
    expect(st.snookersNeeded).toEqual([0, 25]);
    expect(st.lead).toEqual({ side: 0, points: 122 });
    expect(st.message).toMatch(/Bob needs 25 snookers/);
  });

  it('short snooker uses the configured reds', () => {
    const s = shortSnookerModule.init(makeConfig('short', [['Ann'], ['Bob']], { reds: 10 }));
    expect(shortSnookerModule.getStatus(s).pointsLeft).toBe(10 * 8 + 27);
  });

  it('concede ends the frame for the other side', () => {
    const s = run(singles(), [pot('red'), { type: 'concede', side: 0 }]);
    expect(s.over).toBe(true);
    expect(s.winnerSide).toBe(1);
  });
});
