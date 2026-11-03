import { activePlayer, addLog, applyCommon, clone, creditPot, endVisit, finish, initBase, sideOf } from '../common';
import type { BallDef, FrameAction, FrameState, KillerTable, RulesModule, Status } from '../types';

export const KILLER_BALL: BallDef = { id: 'any', label: 'Pot', value: 1, color: '#c8102e' };

function table(s: FrameState): KillerTable {
  if (s.table.kind !== 'killer') throw new Error('Not a killer frame');
  return s.table;
}

function alive(s: FrameState): string[] {
  const t = table(s);
  return s.config.players.map((p) => p.id).filter((id) => t.lives[id] > 0);
}

/** Miss or foul: lose a life; at zero lives you're out. */
function loseLife(state: FrameState, reason: string): FrameState {
  const s = clone(state);
  const t = table(s);
  const pid = activePlayer(s);
  const side = sideOf(s.config, pid);
  t.lives[pid] -= 1;
  if (reason === 'Foul') s.stats[pid].fouls += 1;
  addLog(s, {
    playerId: pid,
    side,
    kind: 'life',
    text: `${reason} — ${t.lives[pid]} ${t.lives[pid] === 1 ? 'life' : 'lives'} left`,
    deltas: {},
  });
  if (t.lives[pid] <= 0) {
    t.eliminated.push(pid);
    addLog(s, { playerId: pid, side, kind: 'info', text: 'Knocked out', deltas: {} });
  }
  const left = alive(s);
  if (left.length <= 1) {
    finish(s, 'lastStanding', left.length ? sideOf(s.config, left[0]) : null);
    return s;
  }
  endVisit(s, (id) => t.lives[id] <= 0);
  return s;
}

function apply(state: FrameState, action: FrameAction): FrameState {
  if (state.over) return state;
  if (action.type === 'setActive' && table(state).lives[action.playerId] <= 0) return state;
  if (action.type === 'concede') return state;
  const common = applyCommon(state, action);
  if (common) return common;
  switch (action.type) {
    case 'pot': {
      // Pot = keep your life and play again.
      const s = clone(state);
      creditPot(s, 'any', 1, 1, 'Pot');
      return s;
    }
    case 'foul':
      return loseLife(state, 'Foul');
    case 'endTurn':
      return loseLife(state, 'Miss');
    default:
      return state;
  }
}

function getStatus(s: FrameState): Status {
  const t = table(s);
  const pid = activePlayer(s);
  const n = alive(s).length;
  return {
    ballOn: s.over ? '—' : 'Any ball',
    ballOnIds: s.over ? [] : ['any'],
    pointsLeft: null,
    lead: null,
    snookersNeeded: s.scores.map(() => 0),
    message: s.over ? 'Last player standing' : `${n} left in · ${t.lives[pid]} ${t.lives[pid] === 1 ? 'life' : 'lives'} at the table`,
    freeBallAvailable: false,
  };
}

export const killerModule: RulesModule = {
  id: 'killer',
  init: (config, frameIndex = 0) =>
    initBase(config, frameIndex, {
      kind: 'killer',
      lives: Object.fromEntries(config.players.map((p) => [p.id, Math.max(1, config.rules.lives)])),
      eliminated: [],
    }),
  apply,
  getLegalBalls: (s) => (s.over ? [] : ['any']),
  getStatus,
  isFrameOver: (s) => s.over,
  getBalls: () => [KILLER_BALL],
};
