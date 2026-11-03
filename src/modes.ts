import {
  defaultRules,
  framesToWin,
  getModule,
  matchPlayerTotals,
  playerName,
  POINTS_BALLS,
  STANDARD_BALLS,
  type Format,
  type MatchConfig,
  type MatchState,
  type ModeId,
  type RulesConfig,
} from './engine';

export interface ModeMeta {
  id: ModeId;
  name: string;
  blurb: string;
  formats: Format[];
  minPlayers: number;
  maxPlayers: number;
}

export const MODES: ModeMeta[] = [
  {
    id: 'points',
    name: 'Points Snooker',
    blurb: 'House rules. One red worth 10, any ball in any order, fouls cost you.',
    formats: ['teams', 'singles', 'ffa'],
    minPlayers: 2,
    maxPlayers: 10,
  },
  {
    id: 'snooker',
    name: 'Snooker',
    blurb: '15 reds. Red, colour, red… then the colours in order.',
    formats: ['singles', 'teams'],
    minPlayers: 2,
    maxPlayers: 8,
  },
  {
    id: 'short',
    name: 'Short Snooker',
    blurb: 'Full rules with 10 or 6 reds for a quicker frame.',
    formats: ['singles', 'teams'],
    minPlayers: 2,
    maxPlayers: 8,
  },
  {
    id: 'killer',
    name: 'Killer',
    blurb: 'Everyone has lives. Pot to stay in, miss and lose one. Last one standing wins.',
    formats: ['ffa'],
    minPlayers: 3,
    maxPlayers: 10,
  },
  {
    id: 'free',
    name: 'Free Scoring',
    blurb: 'Your own balls and values. No rules enforced.',
    formats: ['singles', 'teams', 'ffa'],
    minPlayers: 2,
    maxPlayers: 10,
  },
];

export const modeMeta = (id: ModeId) => MODES.find((m) => m.id === id)!;

export const FORMAT_LABEL: Record<Format, string> = {
  singles: 'Singles',
  teams: 'Teams',
  ffa: 'Free-for-all',
};

export function rulesFor(mode: ModeId): RulesConfig {
  const r = defaultRules();
  if (mode === 'snooker') r.reds = 15;
  if (mode === 'short') r.reds = 10;
  if (mode === 'snooker' || mode === 'short') r.balls = STANDARD_BALLS.map((b) => ({ ...b }));
  if (mode === 'points') r.balls = POINTS_BALLS.map((b) => ({ ...b }));
  if (mode === 'free')
    r.balls = [
      { id: 'b1', label: 'Ball 1', value: 1, color: '#c8102e' },
      { id: 'b2', label: 'Ball 2', value: 2, color: '#f5c518' },
      { id: 'b3', label: 'Ball 3', value: 3, color: '#1f5fbf' },
      { id: 'b4', label: 'Ball 4', value: 5, color: '#151515' },
    ];
  return r;
}

/** Points and Killer are single games; snooker and free scoring are played in frames. */
export function frameWord(mode: ModeId): 'frame' | 'game' {
  return mode === 'points' || mode === 'killer' ? 'game' : 'frame';
}

export function sideLabel(config: MatchConfig, side: number): string {
  return config.sides[side]?.name ?? '?';
}

export function sidePlayers(config: MatchConfig, side: number): string {
  return config.sides[side].playerIds.map((id) => playerName(config, id)).join(' & ');
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Plain-text result for pasting into WhatsApp. */
export function resultText(m: MatchState, when: number): string {
  const c = m.config;
  const lines: string[] = [];
  lines.push(`🎱 ${modeMeta(c.mode).name} — ${formatDate(when)}`);
  const names = c.sides.map((s, i) => (s.playerIds.length > 1 ? `${s.name} (${sidePlayers(c, i)})` : s.name));
  if (c.mode === 'killer') {
    const last = m.results.at(-1);
    if (last?.winnerSide != null) lines.push(`🏆 ${names[last.winnerSide]} is the last one standing`);
    if (last?.eliminated?.length)
      lines.push(`Out in order: ${last.eliminated.map((id) => playerName(c, id)).join(', ')}`);
  } else {
    if (c.bestOf > 1 || m.results.length > 1) {
      lines.push(names.map((n, i) => `${n} ${m.frameWins[i]}`).join(' – '));
      if (m.over && m.winnerSide != null) lines.push(`🏆 ${names[m.winnerSide]} win${c.sides[m.winnerSide].playerIds.length > 1 ? '' : 's'} the match`);
    }
    const frames = [...m.results.map((r) => r.scores)];
    if (!m.frame.over && m.frame.log.length) frames.push(m.frame.scores);
    frames.forEach((scores, i) => {
      const prefix = frames.length > 1 || c.bestOf > 1 ? `Frame ${i + 1}: ` : '';
      lines.push(prefix + c.sides.map((s, j) => `${s.name} ${scores[j]}`).join(' – '));
    });
    if (m.results.length === 1 && c.bestOf === 1 && m.results[0].winnerSide != null)
      lines.push(`🏆 ${names[m.results[0].winnerSide]}`);
  }
  const totals = matchPlayerTotals(m);
  const hb = c.players
    .filter((p) => totals[p.id].highBreak > 0)
    .sort((a, b) => totals[b.id].highBreak - totals[a.id].highBreak)
    .map((p) => `${p.name} ${totals[p.id].highBreak}`);
  if (hb.length && c.mode !== 'killer') lines.push(`High breaks: ${hb.join(', ')}`);
  return lines.join('\n');
}

export function matchHeadline(m: MatchState): string {
  const c = m.config;
  if (c.mode === 'killer' || c.bestOf === 1) {
    const s = m.frame.over && m.results.length ? m.results.at(-1)!.scores : m.frame.scores;
    if (c.mode === 'killer') {
      const w = m.results.at(-1)?.winnerSide;
      return w != null ? `${sideLabel(c, w)} won` : `${c.players.length} players`;
    }
    return s.join(' – ');
  }
  return `${m.frameWins.join(' – ')} in frames · first to ${framesToWin(c)}`;
}

export { getModule };
