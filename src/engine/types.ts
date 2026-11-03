// Pure rules-engine types. Nothing in src/engine may import React or touch the DOM.

export type ModeId = 'snooker' | 'short' | 'points' | 'killer' | 'free';
export type Format = 'singles' | 'teams' | 'ffa';
export type BallId = string;

export interface BallDef {
  id: BallId;
  label: string;
  value: number;
  /** CSS colour used to render the ball. */
  color: string;
}

export interface PlayerRef {
  id: string;
  name: string;
}

/** A side is a team, or a single player in singles / free-for-all. */
export interface SideConfig {
  name: string;
  playerIds: string[];
}

export type FoulTarget = 'fouler' | 'opponents';
export type FoulAmount = 'ballValue' | 'fixed';

export interface FoulRule {
  /** 'fouler' = subtract from the player who fouled; 'opponents' = add to every opposing side. */
  target: FoulTarget;
  amount: FoulAmount;
  fixedValue: number;
}

export interface RulesConfig {
  /** Standard / short snooker: number of reds (15, 10 or 6). */
  reds: number;
  /** Ball values for Points and Free modes. */
  balls: BallDef[];
  foul: FoulRule;
  /** Killer: starting lives. */
  lives: number;
  /** Points / Free: frame ends when a side reaches this score (0 = no target). */
  targetScore: number;
  /** Points: potted balls go straight back on their spot (no racks). Missing = false. */
  noRack?: boolean;
}

export interface MatchConfig {
  mode: ModeId;
  format: Format;
  players: PlayerRef[];
  sides: SideConfig[];
  bestOf: number;
  rules: RulesConfig;
}

// ---------- Actions ----------

export type FrameAction =
  | { type: 'pot'; ball: BallId; count?: number; freeBall?: boolean }
  | { type: 'foul'; ball: BallId; points?: number; redsPotted?: number }
  | { type: 'endTurn' }
  | { type: 'setActive'; playerId: string }
  | { type: 'adjust'; side: number; delta: number }
  | { type: 'newRack' }
  | { type: 'endFrame' }
  | { type: 'concede'; side: number };

export type MatchAction = FrameAction | { type: 'nextFrame' };

// ---------- Frame state ----------

export interface PlayerFrameStats {
  points: number; // points scored from pots
  fouls: number;
  foulPoints: number; // points given away
  visits: number;
  highBreak: number;
  pots: Record<BallId, number>;
}

export interface Break {
  playerId: string;
  balls: BallId[];
  points: number;
}

export interface LogEntry {
  n: number;
  playerId: string;
  side: number;
  kind: 'pot' | 'foul' | 'miss' | 'adjust' | 'info' | 'life';
  text: string;
  /** Score change per side, e.g. { 0: +7 } or { 1: -4 }. */
  deltas: Record<number, number>;
  ball?: BallId;
  /** Index of the match action that created this entry (set by the match reducer). */
  action?: number;
}

export interface SnookerTable {
  kind: 'snooker';
  reds: number;
  redsLeft: number;
  /** red = reds on; colour = any colour after a red; clearance = colours in order; respot = re-spotted black. */
  phase: 'red' | 'colour' | 'clearance' | 'respot';
  /** Index into the clearance order (0 = yellow … 5 = black). */
  clearIdx: number;
  freeBall: boolean;
}

export interface PointsTable {
  kind: 'points';
  /** Balls potted since the last rack (unused when noRack is on). */
  potted: Record<BallId, boolean>;
}

export interface KillerTable {
  kind: 'killer';
  lives: Record<string, number>;
  /** Player ids in the order they were knocked out. */
  eliminated: string[];
}

export interface FreeTable {
  kind: 'free';
}

export type TableState = SnookerTable | PointsTable | KillerTable | FreeTable;

export interface FrameState {
  mode: ModeId;
  config: MatchConfig;
  /** Turn order (player ids). May repeat players when team sizes differ. */
  order: string[];
  activeIdx: number;
  scores: number[];
  stats: Record<string, PlayerFrameStats>;
  currentBreak: Break | null;
  log: LogEntry[];
  table: TableState;
  /** Points: rack number, starting at 1. */
  rack: number;
  over: boolean;
  winnerSide: number | null;
  endReason: 'cleared' | 'conceded' | 'ended' | 'target' | 'lastStanding' | null;
}

export interface Status {
  /** Human-readable ball on, e.g. "Red", "Any colour", "Yellow". */
  ballOn: string;
  ballOnIds: BallId[];
  pointsLeft: number | null;
  /** Leading side and margin; null when level. */
  lead: { side: number; points: number } | null;
  /** Snookers required per side (0 when not needed). */
  snookersNeeded: number[];
  message: string | null;
  freeBallAvailable: boolean;
}

/** The shared interface every game mode implements. */
export interface RulesModule {
  id: ModeId;
  init(config: MatchConfig, frameIndex?: number): FrameState;
  apply(state: FrameState, action: FrameAction): FrameState;
  getLegalBalls(state: FrameState): BallId[];
  getStatus(state: FrameState): Status;
  isFrameOver(state: FrameState): boolean;
  /** Balls to draw as buttons, in display order. */
  getBalls(state: FrameState): BallDef[];
}
