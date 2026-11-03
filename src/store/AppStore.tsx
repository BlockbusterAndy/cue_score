import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  deleteMatch as dbDeleteMatch,
  loadMatches,
  loadPlayers,
  loadPresets,
  saveMatch as dbSaveMatch,
  savePlayers,
  savePresets,
  uid,
  type MatchRecord,
  type Preset,
  type SavedPlayer,
} from './repo';

interface AppStore {
  ready: boolean;
  players: SavedPlayer[];
  presets: Preset[];
  matches: MatchRecord[];
  /** Adds new names, refreshes lastUsed, and returns saved players in the same order. */
  recordPlayers: (names: { id?: string; name: string }[]) => SavedPlayer[];
  removePlayer: (id: string) => void;
  savePreset: (p: Omit<Preset, 'id'>) => void;
  removePreset: (id: string) => void;
  putMatch: (m: MatchRecord) => void;
  removeMatch: (id: string) => void;
  /** Starts a new match with the same players, sides and rules. Returns its id. */
  rematch: (from: MatchRecord) => string;
}

const Ctx = createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [players, setPlayers] = useState<SavedPlayer[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);

  useEffect(() => {
    Promise.all([loadPlayers(), loadPresets(), loadMatches()]).then(([p, pr, m]) => {
      setPlayers(p);
      setPresets(pr);
      setMatches(m);
      setReady(true);
    });
    // Ask the browser not to evict our data under storage pressure.
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  const recordPlayers = useCallback(
    (names: { id?: string; name: string }[]) => {
      const now = Date.now();
      const next = [...players];
      const result = names.map(({ id, name }) => {
        const trimmed = name.trim();
        let p =
          (id && next.find((x) => x.id === id)) ||
          next.find((x) => x.name.toLowerCase() === trimmed.toLowerCase());
        if (!p) {
          p = { id: uid(), name: trimmed, lastUsed: now };
          next.push(p);
        } else {
          p = { ...p, lastUsed: now };
          next[next.findIndex((x) => x.id === p!.id)] = p;
        }
        return p;
      });
      next.sort((a, b) => b.lastUsed - a.lastUsed);
      setPlayers(next);
      savePlayers(next);
      return result;
    },
    [players],
  );

  const removePlayer = useCallback((id: string) => {
    setPlayers((prev) => {
      const next = prev.filter((p) => p.id !== id);
      savePlayers(next);
      return next;
    });
  }, []);

  const savePreset = useCallback((p: Omit<Preset, 'id'>) => {
    setPresets((prev) => {
      const next = [...prev.filter((x) => x.name !== p.name), { ...p, id: uid() }];
      savePresets(next);
      return next;
    });
  }, []);

  const removePreset = useCallback((id: string) => {
    setPresets((prev) => {
      const next = prev.filter((x) => x.id !== id);
      savePresets(next);
      return next;
    });
  }, []);

  const putMatch = useCallback((m: MatchRecord) => {
    dbSaveMatch(m);
    setMatches((prev) => [m, ...prev.filter((x) => x.id !== m.id)].sort((a, b) => b.updatedAt - a.updatedAt));
  }, []);

  const removeMatch = useCallback((id: string) => {
    dbDeleteMatch(id);
    setMatches((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const rematch = useCallback(
    (from: MatchRecord) => {
      const saved = recordPlayers(from.config.players);
      const idFor = new Map(from.config.players.map((p, i) => [p.id, saved[i].id]));
      const config = {
        ...from.config,
        players: saved.map((p) => ({ id: p.id, name: p.name })),
        sides: from.config.sides.map((s) => ({ ...s, playerIds: s.playerIds.map((id) => idFor.get(id) ?? id) })),
      };
      const now = Date.now();
      const id = uid();
      putMatch({ id, createdAt: now, updatedAt: now, config, actions: [], status: 'live' });
      return id;
    },
    [recordPlayers, putMatch],
  );

  const value = useMemo(
    () => ({ ready, players, presets, matches, recordPlayers, removePlayer, savePreset, removePreset, putMatch, removeMatch, rematch }),
    [ready, players, presets, matches, recordPlayers, removePlayer, savePreset, removePreset, putMatch, removeMatch, rematch],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): AppStore {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside provider');
  return v;
}
