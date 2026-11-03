import { useMemo, useState } from 'react';
import { getModule, leaderSide, matchPlayerTotals, playerName, replay } from '../engine';
import { go } from '../hooks/device';
import { formatDate, modeMeta, resultText, sideLabel } from '../modes';
import { useStore } from '../store/AppStore';
import type { MatchRecord } from '../store/repo';
import { Ball, Btn, Card, copyText, TopBar, useToast } from '../ui/kit';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function Summary({ record }: { record: MatchRecord }) {
  const store = useStore();
  const m = useMemo(() => replay(record.config, record.actions), [record]);
  const c = m.config;
  const totals = matchPlayerTotals(m);
  const balls = Object.fromEntries(getModule(c.mode).getBalls(m.frame).map((b) => [b.id, b]));
  const { toast, toastNode } = useToast();
  const [armDelete, setArmDelete] = useState(false);

  const frames = [...m.results.map((r) => ({ ...r, live: false }))];
  if (!m.frame.over && m.frame.log.length)
    frames.push({ scores: m.frame.scores, winnerSide: null, endReason: null, stats: m.frame.stats, live: true });

  const winner =
    m.winnerSide ??
    (c.mode === 'killer' ? (m.results.at(-1)?.winnerSide ?? null) : c.bestOf > 1 ? leaderSide(m.frameWins) : leaderSide(frames.at(-1)?.scores ?? []));
  const killerOut = m.results.at(-1)?.eliminated ?? [];

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Match summary" subtitle={`${modeMeta(c.mode).name} · ${formatDate(record.createdAt)}`} onBack={() => go('')} />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-3 py-3">
        <Card className="text-center ring-2 !ring-gold/60">
          <p className="text-xs uppercase tracking-wide text-gold">
            {record.status === 'live' ? 'In progress' : record.status === 'abandoned' ? 'Abandoned' : m.over ? 'Winner' : 'Result'}
          </p>
          <h2 className="mt-1 text-3xl font-semibold">{winner != null ? sideLabel(c, winner) : 'All square'}</h2>
          {c.mode !== 'killer' && (
            <p className="font-score tabular mt-1 text-4xl font-bold">
              {c.bestOf > 1 ? m.frameWins.join(' – ') : (frames.at(-1)?.scores ?? m.frame.scores).join(' – ')}
            </p>
          )}
          {c.bestOf > 1 && <p className="text-sm text-cream/60">frames · best of {c.bestOf}</p>}
        </Card>

        {c.mode === 'killer' && killerOut.length > 0 && (
          <Card>
            <h3 className="mb-2 font-semibold">Knocked out</h3>
            <ol className="flex flex-col gap-1 text-sm">
              {killerOut.map((id, i) => (
                <li key={id}>
                  {i + 1}. {playerName(c, id)}
                </li>
              ))}
            </ol>
          </Card>
        )}

        {c.mode !== 'killer' && frames.length > 0 && (
          <Card>
            <h3 className="mb-2 font-semibold">{frames.length > 1 ? 'Frames' : 'Score'}</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-cream/60">
                  <th className="py-1 text-left font-normal">#</th>
                  {c.sides.map((s, i) => (
                    <th key={i} className="truncate py-1 text-right font-normal">
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {frames.map((f, k) => (
                  <tr key={k} className="border-t border-cream/10">
                    <td className="py-2 text-cream/60">
                      {k + 1}
                      {f.live && ' (live)'}
                    </td>
                    {f.scores.map((sc, i) => (
                      <td
                        key={i}
                        className={`font-score tabular py-2 text-right text-xl ${f.winnerSide === i ? 'font-bold text-gold' : ''} ${sc < 0 ? 'text-foul' : ''}`}
                      >
                        {sc}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        <Card>
          <h3 className="mb-2 font-semibold">Players</h3>
          <ul className="flex flex-col divide-y divide-cream/10">
            {c.players.map((p) => {
              const t = totals[p.id];
              return (
                <li key={p.id} className="py-2">
                  <div className="flex items-baseline gap-2">
                    <span className="flex-1 font-semibold">{p.name}</span>
                    {c.mode !== 'killer' && (
                      <>
                        <span className="text-xs text-cream/60">high break</span>
                        <span className="font-score tabular text-xl text-gold">{t.highBreak}</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-cream/60">
                    {c.mode === 'killer'
                      ? `${plural(t.pots.any ?? 0, 'pot')} · ${plural(t.visits, 'visit')}`
                      : `${t.points} pts potted · ${plural(t.fouls, 'foul')} (${t.foulPoints} pts) · ${plural(t.visits, 'visit')}`}
                  </p>
                  {c.mode !== 'killer' && Object.keys(t.pots).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-2" aria-label="Balls potted">
                      {Object.entries(t.pots).map(([id, n]) => (
                        <span key={id} className="flex items-center gap-1 text-sm">
                          <Ball ball={balls[id] ?? { color: '#999', value: 0 }} size={16} />
                          <span className="tabular">×{n}</span>
                          <span className="sr-only">{balls[id]?.label}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="flex-1" />
        <div className="pb-safe flex flex-col gap-2">
          <Btn
            variant="gold"
            className="h-14 w-full text-lg"
            onClick={async () => toast((await copyText(resultText(m, record.updatedAt))) ? 'Copied — paste it in WhatsApp' : 'Could not copy')}
          >
            Copy result for WhatsApp
          </Btn>
          {record.status === 'live' && (
            <Btn variant="primary" className="h-14 w-full" onClick={() => go(`match/${record.id}`)}>
              Back to the table
            </Btn>
          )}
          <Btn
            variant={armDelete ? 'foul' : 'ghost'}
            className="h-14 w-full"
            onClick={() => {
              if (!armDelete) {
                setArmDelete(true);
                setTimeout(() => setArmDelete(false), 3000);
                return;
              }
              store.removeMatch(record.id);
              go('', true);
            }}
          >
            {armDelete ? 'Tap again to delete' : 'Delete match'}
          </Btn>
        </div>
      </main>
      {toastNode}
    </div>
  );
}
