import type { MatchAction, MatchConfig, ModeId, RulesConfig } from '../engine';
import { kvDel, kvGet, kvList, kvSet } from './db';

export interface SavedPlayer {
  id: string;
  name: string;
  lastUsed: number;
}

export interface MatchRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  config: MatchConfig;
  actions: MatchAction[];
  status: 'live' | 'finished' | 'abandoned';
}

export interface Preset {
  id: string;
  name: string;
  mode: ModeId;
  rules: RulesConfig;
  bestOf: number;
}

export function uid(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const loadPlayers = async () => (await kvGet<SavedPlayer[]>('players')) ?? [];
export const savePlayers = (p: SavedPlayer[]) => kvSet('players', p);

export const loadPresets = async () => (await kvGet<Preset[]>('presets')) ?? [];
export const savePresets = (p: Preset[]) => kvSet('presets', p);

export const loadMatches = async () =>
  (await kvList<MatchRecord>('match:')).sort((a, b) => b.updatedAt - a.updatedAt);
export const saveMatch = (m: MatchRecord) => kvSet(`match:${m.id}`, m);
export const deleteMatch = (id: string) => kvDel(`match:${id}`);
