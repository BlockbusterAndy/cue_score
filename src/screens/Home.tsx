import { useMemo } from 'react';
import { replay } from '../engine';
import { go } from '../hooks/device';
import { formatDate, matchHeadline, modeMeta } from '../modes';
import { useStore } from '../store/AppStore';
import type { MatchRecord } from '../store/repo';
import { Ball, Btn } from '../ui/kit';

export function Home() {
  const { matches, ready, rematch } = useStore();
  const live = matches.find((m) => m.status === 'live');
  const recent = matches.filter((m) => m !== live && m.actions.length > 0).slice(0, 15);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="wood pt-safe shadow-lg shadow-black/40">
        <div className="mx-auto flex h-16 max-w-lg items-center gap-3 px-4">
          <Ball ball={{ color: '#c8102e', value: 0 }} size={30} />
          <h1 className="font-score text-3xl font-bold tracking-wide">Cue Score</h1>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-3 py-4">
        {live && <ResumeCard record={live} />}

        <Btn variant={live ? 'primary' : 'gold'} className="h-16 w-full text-xl" onClick={() => go('new')}>
          + New match
        </Btn>

        {!live && recent[0] && (
          <Btn className="flex h-16 w-full flex-col items-center justify-center leading-tight" onClick={() => go(`match/${rematch(recent[0])}`)}>
            <span className="text-lg">Rematch</span>
            <span className="max-w-full truncate text-xs font-normal text-cream/70">
              {recent[0].config.sides.map((s) => s.name).join(' v ')} · {modeMeta(recent[0].config.mode).name}
            </span>
          </Btn>
        )}

        <section aria-label="Recent matches">
          <h2 className="mb-2 text-sm uppercase tracking-wide text-cream/60">Recent matches</h2>
          {!ready ? null : recent.length === 0 ? (
            <p className="rounded-2xl bg-black/20 p-4 text-sm text-cream/60">Finished matches show up here.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recent.map((r) => (
                <RecentRow key={r.id} record={r} />
              ))}
            </ul>
          )}
        </section>
        <div className="flex-1" />
        <nav aria-label="More" className="pb-safe grid grid-cols-2 gap-2">
          <Btn className="h-14" onClick={() => go('stats')}>
            Stats
          </Btn>
          <Btn className="h-14" onClick={() => go('rules')}>
            Rules
          </Btn>
        </nav>
      </main>
    </div>
  );
}

function ResumeCard({ record }: { record: MatchRecord }) {
  const m = useMemo(() => replay(record.config, record.actions), [record]);
  const c = record.config;
  return (
    <section aria-label="Match in progress" className="rounded-3xl bg-black/30 p-4 ring-2 ring-gold/70">
      <p className="text-xs uppercase tracking-wide text-gold">In progress · {modeMeta(c.mode).name}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        {c.sides.slice(0, 2).map((s, i) => (
          <div key={i} className={`min-w-0 flex-1 ${i === 1 ? 'text-right' : ''}`}>
            <p className="truncate text-sm text-cream/80">{s.name}</p>
            <p className={`font-score tabular text-5xl font-bold ${m.frame.scores[i] < 0 ? 'text-foul' : ''}`}>
              {c.mode === 'killer' ? '' : m.frame.scores[i]}
            </p>
          </div>
        ))}
      </div>
      {c.sides.length > 2 && <p className="text-sm text-cream/70">+{c.sides.length - 2} more</p>}
      {c.bestOf > 1 && (
        <p className="text-sm text-cream/70">
          Frame {m.frameIndex + 1} · frames {m.frameWins.join('–')}
        </p>
      )}
      <Btn variant="gold" className="mt-3 h-14 w-full text-lg" onClick={() => go(`match/${record.id}`)}>
        Resume
      </Btn>
    </section>
  );
}

function RecentRow({ record }: { record: MatchRecord }) {
  const m = useMemo(() => replay(record.config, record.actions), [record]);
  const c = record.config;
  return (
    <li>
      <button
        type="button"
        onClick={() => go(record.status === 'live' ? `match/${record.id}` : `summary/${record.id}`)}
        className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-black/20 px-4 py-2 text-left ring-1 ring-cream/10 hover:bg-black/30"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{c.sides.map((s) => s.name).join(' v ')}</span>
          <span className="block truncate text-xs text-cream/60">
            {modeMeta(c.mode).name} · {formatDate(record.updatedAt)}
            {record.status === 'abandoned' ? ' · abandoned' : record.status === 'live' ? ' · unfinished' : ''}
          </span>
        </span>
        <span className="font-score tabular text-right text-lg">{matchHeadline(m)}</span>
      </button>
    </li>
  );
}
