import { MODULES as REGISTRY } from './registry';
import type { FrameState, MatchAction, MatchConfig, PlayerFrameStats } from './types';

export interface FrameResult {
  scores: number[];
  winnerSide: number | null;
  endReason: FrameState['endReason'];
  stats: Record<string, PlayerFrameStats>;
  eliminated?: string[];
}

export interface MatchState {
  config: MatchConfig;
  frameIndex: number;
  frame: FrameState;
  results: FrameResult[];
  frameWins: number[];
  over: boolean;
  winnerSide: number | null;
}

export function framesToWin(config: MatchConfig): number {
  return Math.floor(Math.max(1, config.bestOf) / 2) + 1;
}

export function initMatch(config: MatchConfig): MatchState {
  return {
    config,
    frameIndex: 0,
    frame: REGISTRY[config.mode].init(config, 0),
    results: [],
    frameWins: config.sides.map(() => 0),
    over: false,
    winnerSide: null,
  };
}

/**
 * Pure match reducer. Returns the same object when an action is rejected.
 * `index` is the action's position in the match's action list; log entries the
 * action creates are tagged with it so a single entry can later be removed.
 */
export function applyMatch(state: MatchState, action: MatchAction, index?: number): MatchState {
  if (action.type === 'nextFrame') {
    if (!state.frame.over || state.over) return state;
    const frameIndex = state.frameIndex + 1;
    return { ...state, frameIndex, frame: REGISTRY[state.config.mode].init(state.config, frameIndex) };
  }
  if (state.over) return state;
  const mod = REGISTRY[state.config.mode];
  let frame = mod.apply(state.frame, action);
  if (frame === state.frame) return state;
  if (index !== undefined) {
    const prev = state.frame.log.length;
    frame = { ...frame, log: [...frame.log.slice(0, prev), ...frame.log.slice(prev).map((e) => ({ ...e, action: index }))] };
  }
  const next: MatchState = { ...state, frame };
  if (mod.isFrameOver(frame)) {
    const result: FrameResult = {
      scores: [...frame.scores],
      winnerSide: frame.winnerSide,
      endReason: frame.endReason,
      stats: frame.stats,
      eliminated: frame.table.kind === 'killer' ? [...frame.table.eliminated] : undefined,
    };
    next.results = [...state.results, result];
    next.frameWins = state.frameWins.map((w, i) => (i === frame.winnerSide ? w + 1 : w));
    const need = framesToWin(state.config);
    const champ = next.frameWins.findIndex((w) => w >= need);
    if (champ >= 0) {
      next.over = true;
      next.winnerSide = champ;
    }
  }
  return next;
}

export function replay(config: MatchConfig, actions: MatchAction[]): MatchState {
  return actions.reduce((s, a, i) => applyMatch(s, a, i), initMatch(config));
}

/**
 * Removes one action from anywhere in the match and replays the rest.
 * Later actions that no longer fit the rules (e.g. a colour after a deleted red)
 * are dropped too; `dropped` says how many.
 */
export function removeAction(
  config: MatchConfig,
  actions: MatchAction[],
  index: number,
): { actions: MatchAction[]; match: MatchState; dropped: number } {
  let match = initMatch(config);
  const kept: MatchAction[] = [];
  let dropped = 0;
  actions.forEach((a, i) => {
    if (i === index) return;
    const next = applyMatch(match, a, kept.length);
    if (next === match) {
      dropped++;
      return;
    }
    kept.push(a);
    match = next;
  });
  return { actions: kept, match, dropped };
}

/** Per-player totals across all frames played so far (finished frames + current). */
export function matchPlayerTotals(m: MatchState): Record<string, PlayerFrameStats> {
  const frames = m.frame.over ? m.results.map((r) => r.stats) : [...m.results.map((r) => r.stats), m.frame.stats];
  const totals: Record<string, PlayerFrameStats> = {};
  for (const p of m.config.players) {
    const t: PlayerFrameStats = { points: 0, fouls: 0, foulPoints: 0, visits: 0, highBreak: 0, pots: {} };
    for (const f of frames) {
      const s = f[p.id];
      if (!s) continue;
      t.points += s.points;
      t.fouls += s.fouls;
      t.foulPoints += s.foulPoints;
      t.visits += s.visits;
      t.highBreak = Math.max(t.highBreak, s.highBreak);
      for (const [b, n] of Object.entries(s.pots)) t.pots[b] = (t.pots[b] ?? 0) + n;
    }
    totals[p.id] = t;
  }
  return totals;
}
