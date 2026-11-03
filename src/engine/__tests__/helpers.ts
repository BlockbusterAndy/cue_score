import { defaultRules } from '../common';
import { getModule } from '../registry';
import type { FrameAction, FrameState, MatchConfig, ModeId, RulesConfig } from '../types';

export function makeConfig(
  mode: ModeId,
  sides: string[][],
  rules: Partial<RulesConfig> = {},
  bestOf = 1,
): MatchConfig {
  const players = sides.flat().map((name) => ({ id: name, name }));
  return {
    mode,
    format: sides.some((s) => s.length > 1) ? 'teams' : sides.length > 2 ? 'ffa' : 'singles',
    players,
    sides: sides.map((ids, i) => ({ name: ids.length > 1 ? `Team ${i + 1}` : ids[0], playerIds: ids })),
    bestOf,
    rules: { ...defaultRules(), ...rules },
  };
}

/** Applies actions and fails loudly if any is rejected. */
export function run(state: FrameState, actions: FrameAction[]): FrameState {
  const mod = getModule(state.mode);
  return actions.reduce((s, a, i) => {
    const next = mod.apply(s, a);
    if (next === s) throw new Error(`Action #${i} rejected: ${JSON.stringify(a)}`);
    return next;
  }, state);
}

export const pot = (ball: string, count?: number): FrameAction => ({ type: 'pot', ball, count });
export const foul = (ball: string, extra: Partial<Extract<FrameAction, { type: 'foul' }>> = {}): FrameAction => ({
  type: 'foul',
  ball,
  ...extra,
});
export const miss: FrameAction = { type: 'endTurn' };
export const active = (s: FrameState) => s.order[s.activeIdx];
