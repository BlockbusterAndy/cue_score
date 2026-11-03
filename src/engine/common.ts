import type {
  BallDef,
  FrameAction,
  FrameState,
  LogEntry,
  MatchConfig,
  PlayerFrameStats,
  RulesConfig,
  SideConfig,
  TableState,
} from './types';

export const COLOUR_ORDER = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'] as const;

export const BALL_COLORS: Record<string, string> = {
  red: '#c8102e',
  yellow: '#f5c518',
  green: '#1f8a3a',
  brown: '#7a4a24',
  blue: '#1f5fbf',
  pink: '#f08aa8',
  black: '#151515',
  white: '#f4f1e8',
};

export const STANDARD_BALLS: BallDef[] = [
  { id: 'red', label: 'Red', value: 1, color: BALL_COLORS.red },
  { id: 'yellow', label: 'Yellow', value: 2, color: BALL_COLORS.yellow },
  { id: 'green', label: 'Green', value: 3, color: BALL_COLORS.green },
  { id: 'brown', label: 'Brown', value: 4, color: BALL_COLORS.brown },
  { id: 'blue', label: 'Blue', value: 5, color: BALL_COLORS.blue },
  { id: 'pink', label: 'Pink', value: 6, color: BALL_COLORS.pink },
  { id: 'black', label: 'Black', value: 7, color: BALL_COLORS.black },
];

export const POINTS_BALLS: BallDef[] = STANDARD_BALLS.map((b) =>
  b.id === 'red' ? { ...b, value: 10 } : { ...b },
);

export function defaultRules(): RulesConfig {
  return {
    reds: 15,
    balls: POINTS_BALLS.map((b) => ({ ...b })),
    foul: { target: 'fouler', amount: 'ballValue', fixedValue: 4 },
    lives: 3,
    targetScore: 0,
    noRack: false,
  };
}

export function clone<T>(v: T): T {
  return structuredClone(v);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Turn order alternates across sides: T1P1 → T2P1 → T1P2 → T2P2.
 * With uneven team sizes the cycle is long enough for everyone to rotate fairly.
 */
export function buildOrder(sides: SideConfig[]): string[] {
  const sizes = sides.map((s) => s.playerIds.length).filter((n) => n > 0);
  if (sizes.length === 0) return [];
  const rounds = sizes.reduce((a, b) => (a * b) / gcd(a, b));
  const order: string[] = [];
  for (let r = 0; r < rounds; r++) {
    for (const side of sides) {
      if (side.playerIds.length) order.push(side.playerIds[r % side.playerIds.length]);
    }
  }
  return order;
}

export function sideOf(config: MatchConfig, playerId: string): number {
  return config.sides.findIndex((s) => s.playerIds.includes(playerId));
}

export function playerName(config: MatchConfig, playerId: string): string {
  return config.players.find((p) => p.id === playerId)?.name ?? '?';
}

export function activePlayer(s: FrameState): string {
  return s.order[s.activeIdx];
}

export function emptyStats(): PlayerFrameStats {
  return { points: 0, fouls: 0, foulPoints: 0, visits: 0, highBreak: 0, pots: {} };
}

export function initBase(config: MatchConfig, frameIndex: number, table: TableState): FrameState {
  const order = buildOrder(config.sides);
  // Rotate who breaks off: frame k starts with the k-th side.
  const startSide = frameIndex % Math.max(1, config.sides.length);
  let activeIdx = order.findIndex((pid) => sideOf(config, pid) === startSide);
  if (activeIdx < 0) activeIdx = 0;
  const stats: Record<string, PlayerFrameStats> = {};
  for (const p of config.players) stats[p.id] = emptyStats();
  if (order.length) stats[order[activeIdx]].visits = 1;
  return {
    mode: config.mode,
    config,
    order,
    activeIdx,
    scores: config.sides.map(() => 0),
    stats,
    currentBreak: null,
    log: [],
    table,
    rack: 1,
    over: false,
    winnerSide: null,
    endReason: null,
  };
}

export function addLog(s: FrameState, entry: Omit<LogEntry, 'n'>): void {
  s.log.push({ n: s.log.length + 1, ...entry });
}

/** Mutates a draft: credits a pot to the active player and their break. */
export function creditPot(s: FrameState, ball: string, points: number, count = 1, label?: string): void {
  const pid = activePlayer(s);
  const side = sideOf(s.config, pid);
  s.scores[side] += points;
  const st = s.stats[pid];
  st.points += points;
  st.pots[ball] = (st.pots[ball] ?? 0) + count;
  if (!s.currentBreak || s.currentBreak.playerId !== pid) {
    s.currentBreak = { playerId: pid, balls: [], points: 0 };
  }
  for (let i = 0; i < count; i++) s.currentBreak.balls.push(ball);
  s.currentBreak.points += points;
  if (s.currentBreak.points > st.highBreak) st.highBreak = s.currentBreak.points;
  addLog(s, {
    playerId: pid,
    side,
    kind: 'pot',
    ball,
    text: label ?? (count > 1 ? `${count} × ${ball}` : ball),
    deltas: { [side]: points },
  });
}

/** Mutates a draft: applies foul points either against the fouler or to every opposing side. */
export function chargeFoul(
  s: FrameState,
  ball: string,
  points: number,
  target: 'fouler' | 'opponents',
  text: string,
): void {
  const pid = activePlayer(s);
  const side = sideOf(s.config, pid);
  const deltas: Record<number, number> = {};
  if (target === 'fouler') {
    s.scores[side] -= points;
    deltas[side] = -points;
  } else {
    s.scores.forEach((_, i) => {
      if (i !== side) {
        s.scores[i] += points;
        deltas[i] = points;
      }
    });
  }
  s.stats[pid].fouls += 1;
  s.stats[pid].foulPoints += points;
  addLog(s, { playerId: pid, side, kind: 'foul', ball, text, deltas });
}

/** Mutates a draft: logs a plain end of turn (miss or safety). */
export function logEndTurn(s: FrameState): void {
  const pid = activePlayer(s);
  addLog(s, { playerId: pid, side: sideOf(s.config, pid), kind: 'miss', text: 'End of turn', deltas: {} });
}

/** Mutates a draft: ends the current visit and moves to the next player who isn't skipped. */
export function endVisit(s: FrameState, skip: (pid: string) => boolean = () => false): void {
  s.currentBreak = null;
  const n = s.order.length;
  for (let step = 1; step <= n; step++) {
    const idx = (s.activeIdx + step) % n;
    if (!skip(s.order[idx])) {
      s.activeIdx = idx;
      s.stats[s.order[idx]].visits += 1;
      return;
    }
  }
}

/** Put a specific player at the table: picks their next slot in the rotation. */
export function setActive(s: FrameState, playerId: string): boolean {
  const n = s.order.length;
  if (s.order[s.activeIdx] === playerId) return false;
  for (let step = 1; step <= n; step++) {
    const idx = (s.activeIdx + step) % n;
    if (s.order[idx] === playerId) {
      s.currentBreak = null;
      s.activeIdx = idx;
      s.stats[playerId].visits += 1;
      return true;
    }
  }
  return false;
}

/** Index of the side with the single highest score, or null on a tie. */
export function leaderSide(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const max = Math.max(...scores);
  const leaders = scores.filter((v) => v === max);
  return leaders.length === 1 ? scores.indexOf(max) : null;
}

export function computeLead(scores: number[]): { side: number; points: number } | null {
  const side = leaderSide(scores);
  if (side === null) return null;
  const others = scores.filter((_, i) => i !== side);
  return { side, points: scores[side] - Math.max(...others) };
}

export function finish(s: FrameState, reason: NonNullable<FrameState['endReason']>, winner?: number | null): void {
  s.currentBreak = null;
  s.over = true;
  s.endReason = reason;
  s.winnerSide = winner === undefined ? leaderSide(s.scores) : winner;
}

/**
 * Actions every mode handles the same way. Returns the new state, the same state
 * when the action is rejected, or undefined when the mode must handle it.
 */
export function applyCommon(state: FrameState, action: FrameAction): FrameState | undefined {
  switch (action.type) {
    case 'setActive': {
      const s = clone(state);
      return setActive(s, action.playerId) ? s : state;
    }
    case 'adjust': {
      if (!Number.isFinite(action.delta) || action.delta === 0) return state;
      if (action.side < 0 || action.side >= state.scores.length) return state;
      const s = clone(state);
      s.scores[action.side] += action.delta;
      addLog(s, {
        playerId: activePlayer(s),
        side: action.side,
        kind: 'adjust',
        text: 'Score edited',
        deltas: { [action.side]: action.delta },
      });
      return s;
    }
    case 'endFrame': {
      const s = clone(state);
      finish(s, 'ended');
      return s;
    }
    case 'concede': {
      if (state.scores.length !== 2) return state;
      const s = clone(state);
      addLog(s, {
        playerId: activePlayer(s),
        side: action.side,
        kind: 'info',
        text: `${s.config.sides[action.side].name} conceded`,
        deltas: {},
      });
      finish(s, 'conceded', 1 - action.side);
      return s;
    }
    default:
      return undefined;
  }
}

export function noSnookers(state: FrameState): number[] {
  return state.scores.map(() => 0);
}
