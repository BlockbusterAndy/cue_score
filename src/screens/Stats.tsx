import { useMemo } from 'react';
import { matchPlayerTotals, replay } from '../engine';
import { go } from '../hooks/device';
import { useStore } from '../store/AppStore';
import { Card, TopBar } from '../ui/kit';

interface Row {
  id: string;
  name: string;
  played: number;
  won: number;
  highBreak: number;
  points: number;
  visits: number;
  fouls: number;
}

export function Stats() {
  const { matches, players } = useStore();
  const rows = useMemo(() => {
    const map = new Map<string, Row>();
    for (const rec of matches) {
      if (rec.status !== 'finished') continue;
      const m = replay(rec.config, rec.actions);
      const totals = matchPlayerTotals(m);
      const winner = m.winnerSide;
      rec.config.sides.forEach((side, i) => {
        for (const id of side.playerIds) {
          const name = players.find((p) => p.id === id)?.name ?? rec.config.players.find((p) => p.id === id)?.name ?? '?';
          const r = map.get(id) ?? { id, name, played: 0, won: 0, highBreak: 0, points: 0, visits: 0, fouls: 0 };
          const t = totals[id];
          r.played += 1;
          if (winner === i) r.won += 1;
          if (rec.config.mode !== 'killer') {
            r.highBreak = Math.max(r.highBreak, t.highBreak);
            r.points += t.points;
            r.visits += t.visits;
          }
          r.fouls += t.fouls;
          map.set(id, r);
        }
      });
    }
    return [...map.values()].sort((a, b) => b.played - a.played || b.won / b.played - a.won / a.played);
  }, [matches, players]);

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Stats" subtitle="Finished matches, all modes" onBack={() => go('')} />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-3 py-3">
        {rows.length === 0 ? (
          <Card>
            <p className="text-cream/70">Finish a match and the numbers start here.</p>
          </Card>
        ) : (
          rows.map((r) => (
            <Card key={r.id} className="!p-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="truncate text-lg font-semibold">{r.name}</h2>
                <span className="font-score tabular text-2xl font-bold text-gold">
                  {Math.round((r.won / r.played) * 100)}%
                  <span className="sr-only"> wins</span>
                </span>
              </div>
              <dl className="mt-1 grid grid-cols-4 gap-2 text-center">
                <Stat label="Played" value={r.played} />
                <Stat label="Won" value={r.won} />
                <Stat label="High break" value={r.highBreak} />
                <Stat label="Pts / visit" value={r.visits ? (r.points / r.visits).toFixed(1) : '–'} />
                <Stat label="Fouls" value={r.fouls} />
                <Stat label="Points" value={r.points} />
              </dl>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-black/20 py-1">
      <dt className="text-[11px] uppercase tracking-wide text-cream/55">{label}</dt>
      <dd className="font-score tabular text-xl font-semibold">{value}</dd>
    </div>
  );
}
