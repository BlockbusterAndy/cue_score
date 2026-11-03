import {
  activePlayer,
  addLog,
  applyCommon,
  chargeFoul,
  clone,
  computeLead,
  creditPot,
  endVisit,
  finish,
  initBase,
  noSnookers,
  sideOf,
} from '../common';
import type { BallDef, FrameAction, FrameState, MatchConfig, PointsTable, RulesModule, Status } from '../types';

/*
 * Points Snooker (house rules): any ball, any order. One game, no frames: it ends when
 * someone reaches the target score or the players end it.
 *
 * Rack (default): a potted ball stays off and greys out until "New rack" (scores kept).
 *   It can still be tapped if it comes back on.
 * No rack: every potted ball goes straight back on its spot, so all balls are always on.
 */

function table(s: FrameState): PointsTable {
  if (s.table.kind !== 'points') throw new Error('Not a points frame');
  return s.table;
}

function balls(s: FrameState): BallDef[] {
  return s.config.rules.balls;
}

const noRack = (s: FrameState) => !!s.config.rules.noRack;

function freshRack(config: MatchConfig): Record<string, boolean> {
  return Object.fromEntries(config.rules.balls.map((b) => [b.id, false]));
}

function onTable(s: FrameState): BallDef[] {
  const t = table(s);
  return noRack(s) ? balls(s) : balls(s).filter((b) => !t.potted[b.id]);
}

export function checkTarget(s: FrameState): void {
  const target = s.config.rules.targetScore;
  if (target > 0 && s.scores.some((v) => v >= target)) finish(s, 'target');
}

export function foulPoints(s: FrameState, ballValue: number): number {
  const rule = s.config.rules.foul;
  return rule.amount === 'fixed' ? rule.fixedValue : ballValue;
}

function apply(state: FrameState, action: FrameAction): FrameState {
  if (state.over) return state;
  const common = applyCommon(state, action);
  if (common) return common;
  switch (action.type) {
    case 'pot': {
      // Any ball, any order. A potted ball can always be potted again (it came back on).
      const ball = balls(state).find((b) => b.id === action.ball);
      if (!ball) return state;
      const s = clone(state);
      creditPot(s, ball.id, ball.value, 1, ball.label);
      if (!noRack(s)) table(s).potted[ball.id] = true;
      checkTarget(s);
      return s;
    }
    case 'foul': {
      const ball = balls(state).find((b) => b.id === action.ball);
      if (!ball) return state;
      const pts = action.points ?? foulPoints(state, ball.value);
      if (!(pts > 0)) return state;
      const s = clone(state);
      chargeFoul(s, ball.id, pts, s.config.rules.foul.target, `Foul on ${ball.label}`);
      checkTarget(s);
      if (!s.over) endVisit(s);
      return s;
    }
    case 'endTurn': {
      const s = clone(state);
      endVisit(s);
      return s;
    }
    case 'newRack': {
      if (noRack(state)) return state;
      const s = clone(state);
      s.table = { kind: 'points', potted: freshRack(s.config) };
      s.rack += 1;
      s.currentBreak = null;
      addLog(s, {
        playerId: activePlayer(s),
        side: sideOf(s.config, activePlayer(s)),
        kind: 'info',
        text: `New rack (${s.rack})`,
        deltas: {},
      });
      return s;
    }
    default:
      return state;
  }
}

function getStatus(state: FrameState): Status {
  const on = onTable(state);
  const cleared = !noRack(state) && on.length === 0;
  const target = state.config.rules.targetScore;
  return {
    ballOn: state.over ? '—' : cleared ? 'Rack cleared' : 'Any ball',
    ballOnIds: state.over ? [] : on.map((b) => b.id),
    pointsLeft: state.over || noRack(state) ? null : on.reduce((sum, b) => sum + b.value, 0),
    lead: computeLead(state.scores),
    snookersNeeded: noSnookers(state),
    message: state.over
      ? 'Game over'
      : cleared
        ? 'Rack cleared — start a new rack or end the game'
        : target > 0
          ? `First to ${target}`
          : null,
    freeBallAvailable: false,
  };
}

export const pointsModule: RulesModule = {
  id: 'points',
  init: (config, frameIndex = 0) => initBase(config, frameIndex, { kind: 'points', potted: freshRack(config) }),
  apply,
  getLegalBalls: (s) => (s.over ? [] : onTable(s).map((b) => b.id)),
  getStatus,
  isFrameOver: (s) => s.over,
  getBalls: balls,
};
