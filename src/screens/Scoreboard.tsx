import { useCallback, useEffect, useState } from 'react';
import {
  activePlayer,
  applyMatch,
  framesToWin,
  getModule,
  playerName,
  sideOf,
  type BallDef,
  type FrameState,
  type MatchAction,
  type MatchState,
} from '../engine';
import { go, haptic, useWakeLock } from '../hooks/device';
import { useMatch } from '../hooks/useMatch';
import { frameWord, modeMeta, sideLabel } from '../modes';
import { useStore } from '../store/AppStore';
import type { MatchRecord } from '../store/repo';
import { Ball, Btn, Sheet, signed, Stepper, TopBar } from '../ui/kit';

type SheetId = null | 'foul' | 'menu' | 'edit' | 'log' | 'reds';

export function Scoreboard({ record }: { record: MatchRecord }) {
  const { putMatch } = useStore();
  const m = useMatch(record, putMatch);
  const { match } = m;
  const frame = match.frame;
  const mod = getModule(frame.mode);
  const status = mod.getStatus(frame);
  const [sheet, setSheet] = useState<SheetId>(null);
  const [freeBall, setFreeBall] = useState(false);
  const [announce, setAnnounce] = useState('');
  const closeSheet = useCallback(() => setSheet(null), []);

  useWakeLock(!match.over);

  // Leave free-ball mode once it's no longer on offer.
  useEffect(() => {
    if (!status.freeBallAvailable) setFreeBall(false);
  }, [status.freeBallAvailable]);

  const config = match.config;
  const meta = modeMeta(config.mode);
  const pid = activePlayer(frame);
  const activeSide = sideOf(config, pid);

  const act = (a: MatchAction, kind: 'pot' | 'foul' | 'tap' = 'tap') => {
    if (!m.wouldAccept(a)) return;
    const next = applyMatch(match, a);
    m.act(a);
    haptic[kind]();
    setAnnounce(describe(next));
  };

  const undo = () => {
    if (!m.canUndo) return;
    m.undo();
    haptic.tap();
    setAnnounce('Undone');
  };

  const pointsDetail =
    config.mode !== 'points'
      ? []
      : [
          config.rules.noRack ? 'No rack' : `Rack ${frame.rack}`,
          config.rules.targetScore > 0 ? `First to ${config.rules.targetScore}` : null,
        ];
  const subtitle =
    config.mode === 'killer'
      ? `${config.players.length} players · ${config.rules.lives} lives`
      : config.mode === 'points'
        ? pointsDetail.filter(Boolean).join(' · ')
        : config.bestOf > 1
          ? `Frame ${match.frameIndex + 1} · Best of ${config.bestOf} · ${match.frameWins.join('–')}`
          : config.rules.targetScore > 0 && config.mode === 'free'
            ? `First to ${config.rules.targetScore}`
            : 'Single frame';

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        title={meta.name}
        subtitle={subtitle}
        onBack={() => go('')}
        right={
          <>
            <button
              type="button"
              onClick={() => setSheet('log')}
              className="h-12 rounded-full px-3 text-sm font-semibold hover:bg-white/10"
              aria-label="Show log of pots and fouls"
            >
              Log
            </button>
            <button
              type="button"
              onClick={() => setSheet('menu')}
              className="flex h-12 w-12 items-center justify-center rounded-full text-2xl hover:bg-white/10"
              aria-label="More actions"
            >
              ⋯
            </button>
          </>
        }
      />
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-3 pt-3">
        <SideCards match={match} onPick={(id) => act({ type: 'setActive', playerId: id })} />
        <StatusStrip frame={frame} />
        <BreakRow frame={frame} />
        <div className="flex-1" />

        {frame.over ? (
          <FrameOver match={match} onNext={() => act({ type: 'nextFrame' })} onUndo={undo} recordId={record.id} />
        ) : (
          <section aria-label="Scoring" className="pb-safe flex flex-col gap-3">
            {frame.table.kind === 'points' && status.ballOn === 'Rack cleared' && (
              <div className="flex items-center gap-2 rounded-2xl bg-gold/15 p-2 ring-1 ring-gold/40">
                <p className="flex-1 pl-2 text-sm">Rack cleared.</p>
                <Btn variant="gold" onClick={() => act({ type: 'newRack' })}>
                  New rack
                </Btn>
              </div>
            )}
            {status.freeBallAvailable && (
              <button
                type="button"
                aria-pressed={freeBall}
                onClick={() => setFreeBall((v) => !v)}
                className={`min-h-12 rounded-2xl px-4 text-sm font-semibold ring-1 ${
                  freeBall ? 'bg-gold text-wood-dark ring-gold' : 'bg-black/25 ring-gold/50 text-gold-soft'
                }`}
              >
                {freeBall ? 'Free ball on — tap the nominated colour' : 'Free ball? Tap to nominate'}
              </button>
            )}
            <BallPad
              frame={frame}
              freeBall={freeBall}
              onPot={(ball, count) => {
                act({ type: 'pot', ball, count, freeBall: freeBall || undefined }, 'pot');
                setFreeBall(false);
              }}
              onManyReds={() => setSheet('reds')}
            />
            <div className="grid grid-cols-4 gap-2">
              <Btn onClick={undo} disabled={!m.canUndo} className="h-16 px-1" aria-label="Undo last action">
                ↶ Undo
              </Btn>
              <Btn
                variant="foul"
                className="h-16"
                onClick={() =>
                  frame.mode === 'killer' ? act({ type: 'foul', ball: 'any' }, 'foul') : setSheet('foul')
                }
              >
                Foul
              </Btn>
              <Btn variant="primary" className="col-span-2 h-16 text-lg" onClick={() => act({ type: 'endTurn' })}>
                {frame.mode === 'killer' ? (
                  <span className="flex flex-col leading-tight">
                    Miss <span className="text-xs font-medium opacity-70">loses a life</span>
                  </span>
                ) : (
                  <span className="flex flex-col leading-tight">
                    End turn <span className="text-xs font-medium opacity-70">miss or safety</span>
                  </span>
                )}
              </Btn>
            </div>
          </section>
        )}
      </main>

      <FoulSheet open={sheet === 'foul'} onClose={closeSheet} match={match} onFoul={(a) => act(a, 'foul')} />
      <RedsSheet open={sheet === 'reds'} onClose={closeSheet} frame={frame} onPot={(n) => act({ type: 'pot', ball: 'red', count: n }, 'pot')} />
      <LogSheet open={sheet === 'log'} onClose={closeSheet} frame={frame} frameNo={match.frameIndex + 1} />
      <EditScoreSheet
        open={sheet === 'edit'}
        onClose={closeSheet}
        frame={frame}
        onSave={(deltas) => deltas.forEach((d, side) => d && act({ type: 'adjust', side, delta: d }))}
      />
      <MenuSheet
        open={sheet === 'menu'}
        onClose={closeSheet}
        frame={frame}
        activeSide={activeSide}
        onAction={(a) => {
          act(a);
          closeSheet();
        }}
        onEdit={() => setSheet('edit')}
        onAbandon={() => {
          putMatch({ ...m.record, status: 'abandoned', updatedAt: Date.now() });
          go('');
        }}
      />
    </div>
  );
}

function describe(m: MatchState): string {
  const f = m.frame;
  const last = f.log.at(-1);
  const who = playerName(m.config, activePlayer(f));
  const scores = m.config.sides.map((s, i) => `${s.name} ${f.scores[i]}`).join(', ');
  if (f.over) return `${frameWord(m.config.mode) === 'game' ? 'Game' : 'Frame'} over. ${scores}`;
  return `${last ? `${playerName(m.config, last.playerId)}: ${last.text}. ` : ''}${scores}. ${who} to play.`;
}

// ---------- Side cards ----------

function SideCards({ match, onPick }: { match: MatchState; onPick: (playerId: string) => void }) {
  const { config, frame } = match;
  const pid = activePlayer(frame);
  const activeSide = sideOf(config, pid);
  const many = config.sides.length > 2;
  const killer = frame.table.kind === 'killer' ? frame.table : null;
  const showFrames = config.bestOf > 1 && config.mode !== 'killer';

  return (
    <section aria-label="Scores" className={`grid gap-2 ${many ? (config.sides.length > 4 ? 'grid-cols-3' : 'grid-cols-2') : 'grid-cols-2'}`}>
      {config.sides.map((side, i) => {
        const isActive = i === activeSide && !frame.over;
        const score = frame.scores[i];
        const solo = side.playerIds.length === 1;
        const lives = killer ? killer.lives[side.playerIds[0]] : 0;
        const out = killer ? lives <= 0 : false;
        const won = frame.over && frame.winnerSide === i;
        return (
          <article
            key={i}
            aria-label={`${side.name}${isActive ? ', at the table' : ''}`}
            className={`relative flex flex-col rounded-3xl p-3 transition ${
              isActive
                ? 'bg-black/35 ring-[3px] ring-gold shadow-[0_0_24px_-4px] shadow-gold/60'
                : won
                  ? 'bg-black/30 ring-2 ring-gold/50'
                  : 'bg-black/20 ring-1 ring-cream/10'
            } ${out ? 'opacity-45' : ''}`}
          >
            <button
              type="button"
              disabled={!solo || frame.over || out}
              onClick={() => onPick(side.playerIds[0])}
              className="flex min-h-12 flex-col items-start text-left disabled:cursor-default"
              aria-label={solo ? `Put ${side.name} at the table` : undefined}
              tabIndex={solo ? 0 : -1}
            >
              <span className="flex w-full items-center gap-2">
                <span className={`truncate text-sm font-semibold uppercase tracking-wide ${isActive ? 'text-gold' : 'text-cream/80'}`}>
                  {side.name}
                </span>
                {showFrames && (
                  <span className="ml-auto rounded-full bg-cream/15 px-2 font-score text-sm tabular" aria-label={`${match.frameWins[i]} frames`}>
                    {match.frameWins[i]}
                  </span>
                )}
              </span>
              {killer ? (
                <span className="mt-1 flex flex-wrap items-center gap-1" aria-label={out ? 'Out' : `${lives} lives`}>
                  {out ? (
                    <span className="font-score text-4xl text-cream/60">OUT</span>
                  ) : (
                    Array.from({ length: config.rules.lives }, (_, k) => (
                      <span
                        key={k}
                        className={`h-5 w-5 rounded-full ${k < lives ? 'ball' : 'bg-black/40 ring-1 ring-cream/20'}`}
                        style={k < lives ? { ['--ball' as string]: '#c8102e' } : undefined}
                      />
                    ))
                  )}
                </span>
              ) : (
                <span
                  className={`font-score tabular leading-none font-bold ${many ? 'text-5xl' : 'text-7xl'} ${score < 0 ? 'text-foul' : ''}`}
                >
                  {score < 0 ? `−${Math.abs(score)}` : score}
                </span>
              )}
            </button>
            {!solo && (
              <ul className="mt-2 flex flex-col gap-1">
                {side.playerIds.map((id) => {
                  const here = id === pid && !frame.over;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => onPick(id)}
                        disabled={frame.over}
                        aria-label={`Put ${playerName(config, id)} at the table`}
                        aria-current={here ? 'true' : undefined}
                        className={`flex min-h-12 w-full items-center gap-2 rounded-xl px-2 text-left text-sm ${
                          here ? 'bg-gold/20 font-semibold text-gold-soft' : 'hover:bg-white/5'
                        }`}
                      >
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${here ? 'bg-gold' : 'bg-cream/20'}`} aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{playerName(config, id)}</span>
                        <span className={`font-score tabular text-base ${net(frame, id) < 0 ? 'text-foul' : 'text-cream/70'}`}>
                          {net(frame, id)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        );
      })}
    </section>
  );
}

/** A player's own contribution: pots, minus fouls when fouls are charged to the fouler. */
function net(frame: FrameState, id: string): number {
  const st = frame.stats[id];
  const chargesFouler = (frame.mode === 'points' || frame.mode === 'free') && frame.config.rules.foul.target === 'fouler';
  return st.points - (chargesFouler ? st.foulPoints : 0);
}

// ---------- Status ----------

function StatusStrip({ frame }: { frame: FrameState }) {
  const mod = getModule(frame.mode);
  const st = mod.getStatus(frame);
  const balls = mod.getBalls(frame);
  const onBalls = balls.filter((b) => st.ballOnIds.includes(b.id));
  const config = frame.config;
  return (
    <section aria-label="Frame status" className="rounded-2xl bg-black/25 px-3 py-2 ring-1 ring-cream/10">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-cream/60">Ball on</span>
          {frame.mode !== 'killer' && onBalls.length > 0 && onBalls.length <= 6 && (
            <span className="flex -space-x-1.5">
              {onBalls.map((b) => (
                <Ball key={b.id} ball={b} size={18} />
              ))}
            </span>
          )}
          <span className="truncate font-semibold text-gold">{st.ballOn}</span>
        </div>
        {st.pointsLeft != null && (
          <div className="text-right">
            <span className="text-xs uppercase tracking-wide text-cream/60">Left </span>
            <span className="font-score tabular text-xl font-semibold">{st.pointsLeft}</span>
          </div>
        )}
        {st.lead && frame.mode !== 'killer' && (
          <div className="text-right">
            <span className="text-xs uppercase tracking-wide text-cream/60">Lead </span>
            <span className="font-score tabular text-xl font-semibold">{st.lead.points}</span>
            <span className="sr-only"> to {sideLabel(config, st.lead.side)}</span>
          </div>
        )}
      </div>
      {st.message && <p className="mt-1 text-sm text-gold-soft">{st.message}</p>}
    </section>
  );
}

function BreakRow({ frame }: { frame: FrameState }) {
  const mod = getModule(frame.mode);
  const balls = Object.fromEntries(mod.getBalls(frame).map((b) => [b.id, b]));
  const br = frame.currentBreak;
  const last = frame.log.at(-1);
  return (
    <section aria-label="Current break" className="flex min-h-10 items-center gap-2 px-1">
      {br && br.balls.length > 0 ? (
        <>
          <span className="text-xs uppercase tracking-wide text-cream/60">Break</span>
          <span className="font-score tabular text-2xl font-bold text-gold">{br.points}</span>
          <span className="flex flex-wrap items-center gap-0.5 overflow-hidden" aria-label={`${br.balls.length} balls`}>
            {br.balls.slice(-18).map((id, i) => (
              <Ball key={i} ball={balls[id] ?? { color: '#999', value: 0 }} size={14} />
            ))}
          </span>
        </>
      ) : last ? (
        <p className="truncate text-sm text-cream/60">
          Last: {playerName(frame.config, last.playerId)} — {last.text}{' '}
          {Object.values(last.deltas).length > 0 && (
            <span className={Object.values(last.deltas)[0] < 0 ? 'text-foul' : 'text-cream/80'}>
              {Object.entries(last.deltas)
                .map(([, d]) => signed(d))
                .join(' / ')}
            </span>
          )}
        </p>
      ) : (
        <p className="text-sm text-cream/60">{playerName(frame.config, activePlayer(frame))} to break off.</p>
      )}
    </section>
  );
}

// ---------- Ball pad ----------

function BallPad({
  frame,
  freeBall,
  onPot,
  onManyReds,
}: {
  frame: FrameState;
  freeBall: boolean;
  onPot: (ball: string, count?: number) => void;
  onManyReds: () => void;
}) {
  const mod = getModule(frame.mode);
  const balls = mod.getBalls(frame);
  const legal = new Set(mod.getLegalBalls(frame));
  const t = frame.table;

  if (t.kind === 'killer') {
    return (
      <button
        type="button"
        onClick={() => onPot('any')}
        className="flex h-28 items-center justify-center gap-4 rounded-3xl bg-black/25 ring-1 ring-cream/15 active:scale-[0.98]"
      >
        <Ball ball={{ color: '#c8102e', value: 0 }} size={72} />
        <span className="text-left">
          <span className="block text-2xl font-semibold">Potted</span>
          <span className="text-sm text-cream/70">Keep your life, play again</span>
        </span>
      </button>
    );
  }

  const snooker = t.kind === 'snooker';
  const enabled = (b: BallDef) => {
    if (!snooker) return true; // points / free: any ball, any time
    if (freeBall) return b.id !== 'red' && !(t.phase === 'clearance' && b.id === ['yellow', 'green', 'brown', 'blue', 'pink', 'black'][t.clearIdx]);
    return legal.has(b.id);
  };
  // Snooker dims illegal balls. Points greys potted balls (still tappable) unless No rack is on.
  const dimmed = (b: BallDef) => (snooker ? !enabled(b) : t.kind === 'points' && !legal.has(b.id));
  const manyReds = snooker && !freeBall && t.phase === 'red' && t.redsLeft > 1;
  return (
    <div className="grid grid-cols-4 gap-2" role="group" aria-label="Pot a ball">
      {balls.map((b) => {
        const on = enabled(b);
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => onPot(b.id)}
            disabled={!on}
            aria-label={`Pot ${b.label}, ${b.value} point${b.value === 1 ? '' : 's'}${!snooker && dimmed(b) ? ' (already potted)' : ''}`}
            className="flex min-h-[5.5rem] flex-col items-center justify-center gap-1 rounded-2xl bg-black/20 py-2 ring-1 ring-cream/10 transition active:scale-95 active:bg-black/40 disabled:active:scale-100"
          >
            <Ball ball={b} size={54} off={dimmed(b)} showValue={t.kind !== 'snooker'} />
            <span className={`text-xs font-medium ${dimmed(b) ? 'text-cream/40' : 'text-cream/85'}`}>
              {b.label}
              {t.kind === 'snooker' && <span className="ml-1 font-score tabular text-cream/60">{b.value}</span>}
            </span>
          </button>
        );
      })}
      {manyReds && (
        <button
          type="button"
          onClick={onManyReds}
          aria-label="Several reds went in on one shot"
          className="flex min-h-[5.5rem] flex-col items-center justify-center gap-1 rounded-2xl bg-black/20 ring-1 ring-cream/10 active:scale-95"
        >
          <span className="flex -space-x-4">
            <Ball ball={{ color: '#c8102e', value: 1 }} size={34} />
            <Ball ball={{ color: '#c8102e', value: 1 }} size={34} />
          </span>
          <span className="text-xs font-medium text-cream/85">2+ reds</span>
        </button>
      )}
    </div>
  );
}

// ---------- Frame over ----------

function FrameOver({
  match,
  onNext,
  onUndo,
  recordId,
}: {
  match: MatchState;
  onNext: () => void;
  onUndo: () => void;
  recordId: string;
}) {
  const c = match.config;
  const f = match.frame;
  const w = f.winnerSide;
  const title =
    c.mode === 'killer'
      ? w != null
        ? `${sideLabel(c, w)} is the last one standing`
        : 'Game over'
      : w != null
        ? `${frameWord(c.mode) === 'game' ? 'Winner:' : 'Frame to'} ${sideLabel(c, w)}`
        : frameWord(c.mode) === 'game'
          ? 'All square'
          : 'Frame drawn';
  return (
    <section aria-label={`${frameWord(c.mode)} over`} className="pb-safe flex flex-col gap-3 rounded-3xl bg-black/30 p-4 ring-2 ring-gold/60">
      <p className="text-center text-sm uppercase tracking-wide text-gold">
        {f.endReason === 'conceded' ? 'Conceded' : frameWord(c.mode) === 'game' ? 'Game over' : 'Frame over'}
      </p>
      <h2 className="text-center text-2xl font-semibold">{title}</h2>
      {c.mode !== 'killer' && <p className="font-score tabular text-center text-4xl font-bold">{f.scores.join(' – ')}</p>}
      {match.over && c.bestOf > 1 && match.winnerSide != null && (
        <p className="text-center text-lg">
          {sideLabel(c, match.winnerSide)} win the match {match.frameWins.join('–')}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Btn onClick={onUndo} className="h-14" aria-label="Undo last action">
          ↶ Undo
        </Btn>
        {match.over ? (
          <Btn variant="gold" className="h-14" onClick={() => go(`summary/${recordId}`)}>
            Match summary
          </Btn>
        ) : (
          <Btn variant="gold" className="h-14" onClick={onNext}>
            Next frame
          </Btn>
        )}
      </div>
      {!match.over && (
        <p className="text-center text-xs text-cream/60">
          First to {framesToWin(c)} frames · {match.frameWins.join('–')}
        </p>
      )}
    </section>
  );
}

// ---------- Sheets ----------

function FoulSheet({
  open,
  onClose,
  match,
  onFoul,
}: {
  open: boolean;
  onClose: () => void;
  match: MatchState;
  onFoul: (a: MatchAction) => void;
}) {
  const frame = match.frame;
  const mod = getModule(frame.mode);
  const balls = mod.getBalls(frame);
  const t = frame.table;
  const [ball, setBall] = useState<string | null>(null);
  const [reds, setReds] = useState(0);
  const [override, setOverride] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setBall(t.kind === 'snooker' ? (mod.getLegalBalls(frame).length === 1 ? mod.getLegalBalls(frame)[0] : null) : null);
      setReds(0);
      setOverride(null);
    }
    // Reset only when the sheet opens.
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const action: MatchAction | null = ball
    ? { type: 'foul', ball, points: override ?? undefined, redsPotted: reds || undefined }
    : null;
  const preview = action ? applyMatch(match, action) : null;
  const entry = preview && preview !== match ? preview.frame.log.at(-1) : null;
  const fouler = playerName(match.config, activePlayer(frame));
  const effect = entry
    ? Object.entries(entry.deltas)
        .map(([side, d]) => `${signed(d)} ${sideLabel(match.config, Number(side))}`)
        .join(', ')
    : '';

  return (
    <Sheet open={open} onClose={onClose} title={`Foul by ${fouler}`}>
      <p className="mb-2 text-sm text-cream/70">Which ball was involved?</p>
      <div className="grid grid-cols-4 gap-2">
        {balls.map((b) => (
          <button
            key={b.id}
            type="button"
            aria-pressed={ball === b.id}
            onClick={() => setBall(b.id)}
            className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl py-2 ring-1 ${
              ball === b.id ? 'bg-foul/25 ring-2 ring-foul' : 'bg-black/20 ring-cream/10'
            }`}
          >
            <Ball ball={b} size={40} showValue={t.kind !== 'snooker'} />
            <span className="text-xs">{b.label}</span>
          </button>
        ))}
      </div>

      {t.kind === 'snooker' && (
        <div className="mt-4 flex flex-col gap-3">
          {t.redsLeft > 0 && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm">Reds that went in</span>
              <Stepper label="reds potted on the foul" value={reds} onChange={setReds} min={0} max={t.redsLeft} />
            </div>
          )}
          <div>
            <p className="mb-1 text-sm">Penalty</p>
            <div className="flex gap-1" role="radiogroup" aria-label="Penalty points">
              {[null, 4, 5, 6, 7].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  role="radio"
                  aria-checked={override === v}
                  onClick={() => setOverride(v)}
                  className={`min-h-12 flex-1 rounded-xl text-sm font-semibold ${
                    override === v ? 'bg-foul text-wood-dark' : 'bg-black/25 ring-1 ring-cream/15'
                  }`}
                >
                  {v ?? 'Auto'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <Btn
        variant="foul"
        className="mt-4 mb-2 h-16 w-full text-lg"
        disabled={!entry}
        onClick={() => {
          if (!action) return;
          onFoul(action);
          onClose();
        }}
      >
        {entry ? `Foul · ${effect}` : 'Pick a ball'}
      </Btn>
    </Sheet>
  );
}

function RedsSheet({
  open,
  onClose,
  frame,
  onPot,
}: {
  open: boolean;
  onClose: () => void;
  frame: FrameState;
  onPot: (n: number) => void;
}) {
  const left = frame.table.kind === 'snooker' ? frame.table.redsLeft : 0;
  const options = Array.from({ length: Math.max(0, Math.min(left, 8) - 1) }, (_, i) => i + 2);
  return (
    <Sheet open={open} onClose={onClose} title="How many reds went in?">
      <div className="mb-3 grid grid-cols-4 gap-2">
        {options.map((n) => (
          <Btn
            key={n}
            className="h-16 text-2xl"
            onClick={() => {
              onPot(n);
              onClose();
            }}
            aria-label={`${n} reds`}
          >
            <span className="font-score tabular">{n}</span>
          </Btn>
        ))}
      </div>
    </Sheet>
  );
}

function LogSheet({ open, onClose, frame, frameNo }: { open: boolean; onClose: () => void; frame: FrameState; frameNo: number }) {
  const balls = Object.fromEntries(getModule(frame.mode).getBalls(frame).map((b) => [b.id, b]));
  return (
    <Sheet open={open} onClose={onClose} title={`Frame ${frameNo} log`}>
      {frame.log.length === 0 ? (
        <p className="pb-4 text-cream/60">Nothing yet.</p>
      ) : (
        <ol className="mb-3 flex flex-col divide-y divide-cream/10" reversed>
          {[...frame.log].reverse().map((e) => {
            const deltas = Object.entries(e.deltas);
            return (
              <li key={e.n} className="flex items-center gap-3 py-2">
                <span className="w-6 text-right text-xs text-cream/40 tabular">{e.n}</span>
                {e.ball && balls[e.ball] ? (
                  <Ball ball={balls[e.ball]} size={20} />
                ) : (
                  <span className="h-5 w-5" aria-hidden />
                )}
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold">{playerName(frame.config, e.playerId)}</span>{' '}
                  <span className={e.kind === 'foul' ? 'text-foul' : 'text-cream/80'}>{e.text}</span>
                </span>
                <span className="font-score tabular text-right text-lg">
                  {deltas.map(([side, d]) => (
                    <span key={side} className={`block ${d < 0 ? 'text-foul' : 'text-cream'}`}>
                      {signed(d)}
                      {(frame.config.sides.length > 2 || e.kind === 'foul' || e.kind === 'adjust') && (
                        <span className="ml-1 font-sans text-xs text-cream/60">{frame.config.sides[Number(side)].name}</span>
                      )}
                    </span>
                  ))}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Sheet>
  );
}

function EditScoreSheet({
  open,
  onClose,
  frame,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  frame: FrameState;
  onSave: (deltas: number[]) => void;
}) {
  const [scores, setScores] = useState(frame.scores);
  useEffect(() => {
    if (open) setScores(frame.scores);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Sheet open={open} onClose={onClose} title="Edit score">
      <div className="flex flex-col gap-3">
        {frame.config.sides.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-semibold">{s.name}</span>
            <button
              type="button"
              className="h-12 w-12 rounded-xl bg-black/25 ring-1 ring-cream/20"
              onClick={() => setScores((v) => v.map((x, j) => (j === i ? x - 5 : x)))}
              aria-label={`${s.name} minus 5`}
            >
              −5
            </button>
            <Stepper label={`${s.name} score`} value={scores[i]} onChange={(n) => setScores((v) => v.map((x, j) => (j === i ? n : x)))} />
            <button
              type="button"
              className="h-12 w-12 rounded-xl bg-black/25 ring-1 ring-cream/20"
              onClick={() => setScores((v) => v.map((x, j) => (j === i ? x + 5 : x)))}
              aria-label={`${s.name} plus 5`}
            >
              +5
            </button>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-cream/60">Each change is logged and can be undone.</p>
      <Btn
        variant="gold"
        className="mt-3 mb-2 h-14 w-full"
        onClick={() => {
          onSave(scores.map((v, i) => v - frame.scores[i]));
          onClose();
        }}
      >
        Save
      </Btn>
    </Sheet>
  );
}

/** Two-tap confirm, instead of window.confirm. */
function ConfirmBtn({ label, confirmLabel, onConfirm }: { label: string; confirmLabel: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Btn
      variant={armed ? 'foul' : 'ghost'}
      className="h-14 w-full text-left"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {armed ? confirmLabel : label}
    </Btn>
  );
}

function MenuSheet({
  open,
  onClose,
  frame,
  activeSide,
  onAction,
  onEdit,
  onAbandon,
}: {
  open: boolean;
  onClose: () => void;
  frame: FrameState;
  activeSide: number;
  onAction: (a: MatchAction) => void;
  onEdit: () => void;
  onAbandon: () => void;
}) {
  const c = frame.config;
  return (
    <Sheet open={open} onClose={onClose} title="Match options">
      <div className="mb-3 flex flex-col gap-2">
        {!frame.over && frame.table.kind === 'points' && !c.rules.noRack && (
          <Btn className="h-14 w-full text-left" onClick={() => onAction({ type: 'newRack' })}>
            New rack <span className="text-sm font-normal text-cream/60">— keeps the scores</span>
          </Btn>
        )}
        {!frame.over && frame.mode !== 'killer' && (
          <Btn className="h-14 w-full text-left" onClick={onEdit}>
            Edit score
          </Btn>
        )}
        {!frame.over && (
          <ConfirmBtn
            label={`End ${frameWord(c.mode)}`}
            confirmLabel="Tap again to end it now"
            onConfirm={() => onAction({ type: 'endFrame' })}
          />
        )}
        {!frame.over &&
          c.sides.length === 2 &&
          frame.mode !== 'killer' &&
          // The side at the table is listed first: they're the usual ones to concede.
          [activeSide, 1 - activeSide].map((side) => (
            <ConfirmBtn
              key={side}
              label={`${c.sides[side].name} concede${c.sides[side].playerIds.length > 1 ? '' : 's'} the ${frameWord(c.mode)}`}
              confirmLabel="Tap again to concede"
              onConfirm={() => onAction({ type: 'concede', side })}
            />
          ))}
        <Btn className="h-14 w-full text-left" onClick={() => go(`rules/${c.mode}`)}>
          Rules for {modeMeta(c.mode).name}
        </Btn>
        <ConfirmBtn label="Abandon match" confirmLabel="Tap again to abandon" onConfirm={onAbandon} />
      </div>
    </Sheet>
  );
}
