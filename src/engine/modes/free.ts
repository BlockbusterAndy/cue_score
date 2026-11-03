import { applyCommon, chargeFoul, clone, computeLead, creditPot, endVisit, initBase, noSnookers } from '../common';
import type { FrameAction, FrameState, RulesModule } from '../types';
import { checkTarget, foulPoints } from './points';

/** Free scoring: custom balls and values, nothing enforced. */
function apply(state: FrameState, action: FrameAction): FrameState {
  if (state.over) return state;
  const common = applyCommon(state, action);
  if (common) return common;
  const balls = state.config.rules.balls;
  switch (action.type) {
    case 'pot': {
      const ball = balls.find((b) => b.id === action.ball);
      if (!ball) return state;
      const s = clone(state);
      const n = Math.max(1, Math.floor(action.count ?? 1));
      creditPot(s, ball.id, ball.value * n, n, n > 1 ? `${n} × ${ball.label}` : ball.label);
      checkTarget(s);
      return s;
    }
    case 'foul': {
      const ball = balls.find((b) => b.id === action.ball);
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
    default:
      return state;
  }
}

export const freeModule: RulesModule = {
  id: 'free',
  init: (config, frameIndex = 0) => initBase(config, frameIndex, { kind: 'free' }),
  apply,
  getLegalBalls: (s) => (s.over ? [] : s.config.rules.balls.map((b) => b.id)),
  getStatus: (s) => ({
    ballOn: s.over ? '—' : 'Any ball',
    ballOnIds: s.over ? [] : s.config.rules.balls.map((b) => b.id),
    pointsLeft: null,
    lead: computeLead(s.scores),
    snookersNeeded: noSnookers(s),
    message: s.over ? 'Frame over' : null,
    freeBallAvailable: false,
  }),
  isFrameOver: (s) => s.over,
  getBalls: (s) => s.config.rules.balls,
};
