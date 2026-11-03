import {
  addLog,
  activePlayer,
  applyCommon,
  chargeFoul,
  clone,
  COLOUR_ORDER,
  computeLead,
  creditPot,
  endVisit,
  finish,
  initBase,
  logEndTurn,
  sideOf,
  STANDARD_BALLS,
} from '../common';
import type { BallId, FrameAction, FrameState, MatchConfig, RulesModule, SnookerTable, Status } from '../types';

const VALUE: Record<string, number> = Object.fromEntries(STANDARD_BALLS.map((b) => [b.id, b.value]));
const LABEL: Record<string, string> = Object.fromEntries(STANDARD_BALLS.map((b) => [b.id, b.label]));
const COLOURS: readonly string[] = COLOUR_ORDER;

function table(s: FrameState): SnookerTable {
  if (s.table.kind !== 'snooker') throw new Error('Not a snooker frame');
  return s.table;
}

/** Value of the ball on, used for foul and snooker maths. 0 when any colour is on. */
function ballOnValue(t: SnookerTable): number {
  switch (t.phase) {
    case 'red':
      return 1;
    case 'colour':
      return 0;
    case 'clearance':
      return VALUE[COLOURS[t.clearIdx]];
    case 'respot':
      return 7;
  }
}

export function pointsLeft(t: SnookerTable): number {
  switch (t.phase) {
    case 'red':
      return t.redsLeft * 8 + 27;
    case 'colour':
      return t.redsLeft * 8 + 7 + 27;
    case 'clearance':
      return COLOURS.slice(t.clearIdx).reduce((sum, c) => sum + VALUE[c], 0);
    case 'respot':
      return 7;
  }
}

/** After a visit ends (miss or foul) the "any colour" state collapses back to reds or the clearance. */
function settleAfterVisit(t: SnookerTable): void {
  if (t.phase === 'colour' || (t.phase === 'red' && t.redsLeft === 0)) {
    if (t.redsLeft > 0) t.phase = 'red';
    else {
      t.phase = 'clearance';
      t.clearIdx = 0;
    }
  }
}

function legal(t: SnookerTable): BallId[] {
  switch (t.phase) {
    case 'red':
      return ['red'];
    case 'colour':
      return [...COLOURS];
    case 'clearance':
      return [COLOURS[t.clearIdx]];
    case 'respot':
      return ['black'];
  }
}

function init(config: MatchConfig, frameIndex = 0): FrameState {
  const reds = config.mode === 'snooker' ? 15 : config.rules.reds;
  return initBase(config, frameIndex, {
    kind: 'snooker',
    reds,
    redsLeft: reds,
    phase: 'red',
    clearIdx: 0,
    freeBall: false,
  });
}

function blackPotted(s: FrameState): void {
  const t = table(s);
  const top = Math.max(...s.scores);
  const tied = s.scores.filter((v) => v === top).length > 1;
  if (tied) {
    t.phase = 'respot';
    addLog(s, {
      playerId: activePlayer(s),
      side: sideOf(s.config, activePlayer(s)),
      kind: 'info',
      text: 'Scores level — black re-spotted',
      deltas: {},
    });
    endVisit(s);
  } else {
    finish(s, 'cleared');
  }
}

function pot(state: FrameState, ball: BallId, count = 1, freeBall = false): FrameState {
  const t0 = table(state);
  const isColour = COLOURS.includes(ball);

  // Free ball: a nominated colour played as the ball on.
  if (freeBall) {
    if (!t0.freeBall || !isColour) return state;
    if (t0.phase === 'red') {
      const s = clone(state);
      creditPot(s, ball, 1, 1, `Free ball (${LABEL[ball]} as red)`);
      const t = table(s);
      t.freeBall = false;
      t.phase = 'colour';
      return s;
    }
    if (t0.phase === 'clearance' && ball !== COLOURS[t0.clearIdx]) {
      const s = clone(state);
      const on = COLOURS[t0.clearIdx];
      creditPot(s, ball, VALUE[on], 1, `Free ball (${LABEL[ball]} as ${LABEL[on]})`);
      table(s).freeBall = false;
      return s;
    }
    return state;
  }

  switch (t0.phase) {
    case 'red': {
      if (ball !== 'red') return state;
      const n = Math.max(1, Math.min(Math.floor(count), t0.redsLeft));
      const s = clone(state);
      creditPot(s, 'red', n, n, n > 1 ? `${n} reds` : 'Red');
      const t = table(s);
      t.redsLeft -= n;
      t.phase = 'colour';
      t.freeBall = false;
      return s;
    }
    case 'colour': {
      if (!isColour) return state;
      const s = clone(state);
      creditPot(s, ball, VALUE[ball], 1, LABEL[ball]);
      const t = table(s);
      t.freeBall = false;
      if (t.redsLeft > 0) t.phase = 'red';
      else {
        t.phase = 'clearance';
        t.clearIdx = 0;
      }
      return s;
    }
    case 'clearance': {
      if (ball !== COLOURS[t0.clearIdx]) return state;
      const s = clone(state);
      creditPot(s, ball, VALUE[ball], 1, LABEL[ball]);
      const t = table(s);
      t.freeBall = false;
      t.clearIdx += 1;
      if (t.clearIdx >= COLOURS.length) blackPotted(s);
      return s;
    }
    case 'respot': {
      if (ball !== 'black') return state;
      const s = clone(state);
      creditPot(s, 'black', 7, 1, 'Re-spotted black');
      finish(s, 'cleared');
      return s;
    }
  }
}

function foul(state: FrameState, action: Extract<FrameAction, { type: 'foul' }>): FrameState {
  const t0 = table(state);
  const involved = VALUE[action.ball];
  if (involved === undefined) return state;
  const pts = action.points ?? Math.max(4, ballOnValue(t0), involved);
  if (!(pts > 0)) return state;
  const s = clone(state);
  const t = table(s);
  const redsIn = Math.max(0, Math.min(Math.floor(action.redsPotted ?? 0), t.redsLeft));
  t.redsLeft -= redsIn;
  const extra = redsIn ? `, ${redsIn} red${redsIn > 1 ? 's' : ''} down` : '';
  chargeFoul(s, action.ball, pts, 'opponents', `Foul on ${LABEL[action.ball]}${extra}`);

  if (t.phase === 'respot') {
    finish(s, 'cleared');
    return s;
  }
  settleAfterVisit(t);
  t.freeBall = true;
  endVisit(s);
  return s;
}

function apply(state: FrameState, action: FrameAction): FrameState {
  if (state.over) return state;
  const common = applyCommon(state, action);
  if (common) return common;
  switch (action.type) {
    case 'pot':
      return pot(state, action.ball, action.count, action.freeBall);
    case 'foul':
      return foul(state, action);
    case 'endTurn': {
      const s = clone(state);
      logEndTurn(s);
      const t = table(s);
      settleAfterVisit(t);
      t.freeBall = false;
      endVisit(s);
      return s;
    }
    default:
      return state;
  }
}

function getStatus(state: FrameState): Status {
  const t = table(state);
  const left = pointsLeft(t);
  const snookerUnit = Math.max(4, ballOnValue(t));
  const top = Math.max(...state.scores);
  const snookersNeeded = state.scores.map((sc) => {
    const deficit = top - sc;
    return deficit > left ? Math.ceil((deficit - left) / snookerUnit) : 0;
  });
  let ballOn: string;
  switch (t.phase) {
    case 'red':
      ballOn = t.redsLeft === 1 ? 'Last red' : 'Red';
      break;
    case 'colour':
      ballOn = 'Any colour';
      break;
    case 'clearance':
      ballOn = LABEL[COLOURS[t.clearIdx]];
      break;
    case 'respot':
      ballOn = 'Re-spotted black';
      break;
  }
  const activeSide = sideOf(state.config, activePlayer(state));
  let message: string | null = null;
  if (state.over) message = 'Frame over';
  else if (t.phase === 'respot') message = 'Scores level — next score wins';
  else if (snookersNeeded[activeSide] > 0) {
    const n = snookersNeeded[activeSide];
    message = `${state.config.sides[activeSide].name} need${state.config.sides[activeSide].playerIds.length > 1 ? '' : 's'} ${n} snooker${n > 1 ? 's' : ''}`;
  }
  return {
    ballOn: state.over ? '—' : ballOn,
    ballOnIds: state.over ? [] : legal(t),
    pointsLeft: state.over ? 0 : left,
    lead: computeLead(state.scores),
    snookersNeeded,
    message,
    freeBallAvailable: !state.over && t.freeBall && (t.phase === 'red' || t.phase === 'clearance'),
  };
}

function makeModule(id: 'snooker' | 'short'): RulesModule {
  return {
    id,
    init,
    apply,
    getLegalBalls: (s) => (s.over ? [] : legal(table(s))),
    getStatus,
    isFrameOver: (s) => s.over,
    getBalls: () => STANDARD_BALLS,
  };
}

export const snookerModule = makeModule('snooker');
export const shortSnookerModule = makeModule('short');
