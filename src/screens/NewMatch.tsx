import { useMemo, useState } from 'react';
import type { BallDef, Format, MatchConfig, ModeId, RulesConfig } from '../engine';
import { go } from '../hooks/device';
import { FORMAT_LABEL, frameWord, modeMeta, MODES, rulesFor } from '../modes';
import { useStore } from '../store/AppStore';
import { uid, type Preset } from '../store/repo';
import { Ball, Btn, Card, Segmented, Sheet, Stepper, TopBar } from '../ui/kit';

type Step = 'mode' | 'players' | 'rules';
interface Slot {
  id?: string;
  name: string;
}

const STEPS: Step[] = ['mode', 'players', 'rules'];
const STEP_LABEL: Record<Step, string> = { mode: 'Game', players: 'Players', rules: 'Rules' };

function shape(format: Format, teamSizes: [number, number], ffaCount: number): number[] {
  if (format === 'singles') return [1, 1];
  if (format === 'teams') return teamSizes;
  return Array.from({ length: ffaCount }, () => 1);
}

/** Resize side/slot arrays to a new shape, keeping names already entered. */
function reshape(prev: Slot[][], sizes: number[]): Slot[][] {
  const pool = prev.flat().filter((s) => s.name.trim());
  const sameShape = prev.length === sizes.length;
  return sizes.map((n, i) =>
    Array.from({ length: n }, (_, j) => (sameShape ? prev[i]?.[j] : undefined) ?? (sameShape ? { name: '' } : pool.shift() ?? { name: '' })),
  );
}

export function NewMatch() {
  const store = useStore();
  const [step, setStep] = useState<Step>('mode');
  const [mode, setMode] = useState<ModeId>('points');
  const [format, setFormat] = useState<Format>('teams');
  const [teamSizes, setTeamSizes] = useState<[number, number]>([2, 2]);
  const [ffaCount, setFfaCount] = useState(3);
  /** The line-up from the last match of this mode and format, so nobody retypes names. */
  const lastLineup = (m: ModeId, f: Format): Slot[][] | null => {
    const last = store.matches.find((x) => x.config.mode === m && x.config.format === f);
    return last
      ? last.config.sides.map((s) =>
          s.playerIds.map((id) => ({ id, name: last.config.players.find((p) => p.id === id)?.name ?? '' })),
        )
      : null;
  };
  const [slots, setSlots] = useState<Slot[][]>(
    () => lastLineup('points', 'teams') ?? [[{ name: '' }, { name: '' }], [{ name: '' }, { name: '' }]],
  );
  const [teamNames, setTeamNames] = useState(['Team 1', 'Team 2']);
  const [focus, setFocus] = useState<[number, number]>([0, 0]);
  const [rules, setRules] = useState<RulesConfig>(() => rulesFor('points'));
  const [bestOf, setBestOf] = useState(1);
  const [presetName, setPresetName] = useState('');
  const [savedNote, setSavedNote] = useState('');

  const meta = modeMeta(mode);

  const applyShape = (f: Format, m: ModeId = mode, ts = teamSizes, n = ffaCount) => {
    const remembered = lastLineup(m, f);
    if (remembered) {
      if (f === 'teams') setTeamSizes([remembered[0].length, remembered[1].length]);
      if (f === 'ffa') setFfaCount(remembered.length);
      setSlots(remembered);
    } else setSlots((prev) => reshape(prev, shape(f, ts, n)));
    setFormat(f);
    setFocus([0, 0]);
  };

  const pickMode = (id: ModeId, preset?: Preset) => {
    setMode(id);
    setRules(preset ? structuredClone(preset.rules) : rulesFor(id));
    setBestOf(preset?.bestOf ?? 1);
    // Each mode opens in its usual format: Points → teams, Snooker → singles, Killer → free-for-all.
    const f = modeMeta(id).formats[0];
    const n = Math.max(ffaCount, modeMeta(id).minPlayers);
    setFfaCount(n);
    applyShape(f, id, teamSizes, n);
    setStep('players');
  };

  const flat = slots.flat();
  const names = flat.map((s) => s.name.trim().toLowerCase());
  const dupes = names.filter((n, i) => n && names.indexOf(n) !== i);
  const missing = flat.some((s) => !s.name.trim());
  const playersOk = !missing && dupes.length === 0 && flat.length >= meta.minPlayers;

  const quick = useMemo(
    () => store.players.filter((p) => !names.includes(p.name.toLowerCase())).slice(0, 12),
    [store.players, names.join('|')], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const setSlot = (side: number, idx: number, slot: Slot) =>
    setSlots((prev) => prev.map((s, i) => (i === side ? s.map((x, j) => (j === idx ? slot : x)) : s)));

  const quickPick = (p: { id: string; name: string }) => {
    let [side, idx] = focus;
    if (slots[side]?.[idx]?.name.trim()) {
      // Focused slot is taken: use the first empty one.
      outer: for (let i = 0; i < slots.length; i++)
        for (let j = 0; j < slots[i].length; j++)
          if (!slots[i][j].name.trim()) {
            side = i;
            idx = j;
            break outer;
          }
    }
    setSlot(side, idx, { id: p.id, name: p.name });
    // Advance focus to the next empty slot in turn order.
    const order: [number, number][] = [];
    const maxLen = Math.max(...slots.map((s) => s.length));
    for (let j = 0; j < maxLen; j++) for (let i = 0; i < slots.length; i++) if (j < slots[i].length) order.push([i, j]);
    const after = order.slice(order.findIndex(([a, b]) => a === side && b === idx) + 1);
    const next = after.find(([a, b]) => !slots[a][b].name.trim());
    if (next) setFocus(next);
  };

  const start = () => {
    const saved = store.recordPlayers(flat.map((s) => ({ id: s.id, name: s.name })));
    let k = 0;
    const sides = slots.map((side, i) => {
      const ids = side.map(() => saved[k++].id);
      const name =
        format === 'teams' ? teamNames[i].trim() || `Team ${i + 1}` : saved.find((p) => p.id === ids[0])!.name;
      return { name, playerIds: ids };
    });
    const config: MatchConfig = {
      mode,
      format,
      players: saved.map((p) => ({ id: p.id, name: p.name })),
      sides,
      // Points and Killer are one game; only snooker and free scoring have frames.
      bestOf: frameWord(mode) === 'game' ? 1 : bestOf,
      rules,
    };
    const now = Date.now();
    const id = uid();
    store.putMatch({ id, createdAt: now, updatedAt: now, config, actions: [], status: 'live' });
    go(`match/${id}`, true);
  };

  const stepIdx = STEPS.indexOf(step);

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        title="New match"
        subtitle={step === 'mode' ? 'Pick a game' : `${meta.name} · ${STEP_LABEL[step]}`}
        onBack={() => (stepIdx === 0 ? go('') : setStep(STEPS[stepIdx - 1]))}
      />
      <nav aria-label="Steps" className="mx-auto flex w-full max-w-lg gap-1 px-3 pt-3">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            disabled={i > stepIdx && !(i === 2 && playersOk)}
            onClick={() => setStep(s)}
            aria-current={s === step ? 'step' : undefined}
            className={`min-h-11 flex-1 rounded-xl text-sm font-semibold ${s === step ? 'bg-gold text-wood-dark' : 'bg-black/20 text-cream/70 disabled:opacity-40'}`}
          >
            {i + 1}. {STEP_LABEL[s]}
          </button>
        ))}
      </nav>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-3 py-3">
        {step === 'mode' && (
          <>
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => pickMode(m.id)}
                className={`flex min-h-20 items-center gap-3 rounded-3xl p-4 text-left ring-1 transition active:scale-[0.99] ${
                  m.id === mode ? 'bg-black/35 ring-2 ring-gold' : 'bg-black/20 ring-cream/10'
                }`}
              >
                <ModeIcon id={m.id} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {m.name}
                    {m.id === 'points' && <span className="ml-2 rounded-full bg-gold/25 px-2 py-0.5 text-xs text-gold-soft">Default</span>}
                  </span>
                  <span className="block text-sm text-cream/70">{m.blurb}</span>
                </span>
              </button>
            ))}
            {store.presets.length > 0 && (
              <section aria-label="Your presets" className="mt-2">
                <h2 className="mb-2 text-sm uppercase tracking-wide text-cream/60">Your presets</h2>
                <div className="flex flex-col gap-2">
                  {store.presets.map((p) => (
                    <div key={p.id} className="flex gap-2">
                      <Btn className="flex-1 text-left" onClick={() => pickMode(p.mode, p)}>
                        {p.name} <span className="text-sm font-normal text-cream/60">· {modeMeta(p.mode).name}</span>
                      </Btn>
                      <Btn aria-label={`Delete preset ${p.name}`} onClick={() => store.removePreset(p.id)} className="w-12 px-0">
                        ×
                      </Btn>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {step === 'players' && (
          <>
            {meta.formats.length > 1 && (
              <Segmented
                label="Format"
                value={format}
                options={meta.formats.map((f) => ({ value: f, label: FORMAT_LABEL[f] }))}
                onChange={(f) => applyShape(f)}
              />
            )}
            {format === 'ffa' && (
              <div className="flex items-center justify-between">
                <span>Players</span>
                <Stepper
                  label="number of players"
                  value={ffaCount}
                  min={Math.max(3, meta.minPlayers)}
                  max={meta.maxPlayers}
                  onChange={(n) => {
                    setFfaCount(n);
                    setSlots((prev) => reshape(prev, shape('ffa', teamSizes, n)));
                  }}
                />
              </div>
            )}

            <div className="flex flex-col gap-3">
              {slots.map((side, i) => (
                <Card key={i} className="p-3!">
                  {format === 'teams' && (
                    <div className="mb-2 flex items-center gap-2">
                      <input
                        aria-label={`Team ${i + 1} name`}
                        value={teamNames[i]}
                        onChange={(e) => setTeamNames((t) => t.map((x, j) => (j === i ? e.target.value : x)))}
                        className="min-h-12 min-w-0 flex-1 rounded-xl bg-transparent px-2 text-lg font-semibold ring-1 ring-cream/15 focus:ring-gold"
                      />
                      <Stepper
                        label={`players in team ${i + 1}`}
                        value={teamSizes[i]}
                        min={1}
                        max={4}
                        onChange={(n) => {
                          const ts: [number, number] = i === 0 ? [n, teamSizes[1]] : [teamSizes[0], n];
                          setTeamSizes(ts);
                          setSlots((prev) => reshape(prev, ts));
                        }}
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    {side.map((slot, j) => {
                      const isFocus = focus[0] === i && focus[1] === j;
                      const dupe = slot.name.trim() && dupes.includes(slot.name.trim().toLowerCase());
                      const label = format === 'teams' ? `Team ${i + 1}, player ${j + 1}` : `Player ${i + 1}`;
                      return (
                        <div key={j} className="flex items-center gap-2">
                          <span className="w-6 text-center text-sm text-cream/50" aria-hidden>
                            {format === 'teams' ? `${j + 1}` : `${i + 1}`}
                          </span>
                          <input
                            aria-label={label}
                            placeholder={label}
                            value={slot.name}
                            autoComplete="off"
                            enterKeyHint="next"
                            onFocus={() => setFocus([i, j])}
                            onChange={(e) => setSlot(i, j, { name: e.target.value })}
                            aria-invalid={dupe ? true : undefined}
                            className={`min-h-12 min-w-0 flex-1 rounded-xl bg-black/25 px-3 text-base ring-1 placeholder:text-cream/35 ${
                              dupe ? 'ring-foul' : isFocus ? 'ring-2 ring-gold' : 'ring-cream/15'
                            }`}
                          />
                          {slot.name && (
                            <button
                              type="button"
                              aria-label={`Clear ${label}`}
                              onClick={() => {
                                setSlot(i, j, { name: '' });
                                setFocus([i, j]);
                              }}
                              className="h-12 w-12 rounded-xl text-xl text-cream/60 hover:bg-white/10"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </div>

            {quick.length > 0 && (
              <section aria-label="Recent players">
                <h2 className="mb-2 text-sm uppercase tracking-wide text-cream/60">Tap to add</h2>
                <div className="flex flex-wrap gap-2">
                  {quick.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => quickPick(p)}
                      className="min-h-12 rounded-full bg-cream/10 px-4 text-sm font-semibold ring-1 ring-cream/20 hover:bg-cream/20"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </section>
            )}
            {dupes.length > 0 && <p className="text-sm text-foul">Each player can only be in one slot.</p>}
            <div className="flex-1" />
            <Btn variant="gold" className="mb-safe h-14 w-full text-lg" disabled={!playersOk} onClick={() => setStep('rules')}>
              Next: rules
            </Btn>
          </>
        )}

        {step === 'rules' && (
          <>
            <RulesEditor mode={mode} rules={rules} setRules={setRules} />
            {frameWord(mode) === 'frame' && (
              <Card>
                <h2 className="mb-2 font-semibold">Frames</h2>
                <Segmented
                  label="Best of"
                  value={bestOf}
                  options={[1, 3, 5, 7, 9].map((n) => ({ value: n, label: n === 1 ? '1 frame' : `Best of ${n}` }))}
                  onChange={setBestOf}
                />
              </Card>
            )}
            <Card>
              <h2 className="mb-2 font-semibold">Save these rules as a preset</h2>
              <div className="flex gap-2">
                <input
                  aria-label="Preset name"
                  placeholder="e.g. Friday club rules"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  className="min-h-12 min-w-0 flex-1 rounded-xl bg-black/25 px-3 ring-1 ring-cream/15 placeholder:text-cream/35"
                />
                <Btn
                  disabled={!presetName.trim()}
                  onClick={() => {
                    store.savePreset({ name: presetName.trim(), mode, rules, bestOf });
                    setSavedNote(`Saved “${presetName.trim()}”`);
                    setPresetName('');
                  }}
                >
                  Save
                </Btn>
              </div>
              {savedNote && (
                <p className="mt-2 text-sm text-gold-soft" aria-live="polite">
                  {savedNote}
                </p>
              )}
            </Card>
            <div className="flex-1" />
            <Btn variant="gold" className="mb-safe h-16 w-full text-xl" disabled={!playersOk} onClick={start}>
              Start {meta.name}
            </Btn>
          </>
        )}
      </main>
    </div>
  );
}

function ModeIcon({ id }: { id: ModeId }) {
  const colors: Record<ModeId, string[]> = {
    points: ['#c8102e', '#151515'],
    snooker: ['#c8102e', '#c8102e', '#f08aa8'],
    short: ['#c8102e', '#1f5fbf'],
    killer: ['#c8102e', '#f4f1e8'],
    free: ['#f5c518', '#1f8a3a', '#7a4a24'],
  };
  return (
    <span className="flex w-14 shrink-0 -space-x-3" aria-hidden>
      {colors[id].map((c, i) => (
        <Ball key={i} ball={{ color: c, value: 0 }} size={28} />
      ))}
    </span>
  );
}

const PALETTE = [
  { name: 'Red', color: '#c8102e' },
  { name: 'Yellow', color: '#f5c518' },
  { name: 'Green', color: '#1f8a3a' },
  { name: 'Brown', color: '#7a4a24' },
  { name: 'Blue', color: '#1f5fbf' },
  { name: 'Pink', color: '#f08aa8' },
  { name: 'Black', color: '#151515' },
  { name: 'White', color: '#f4f1e8' },
  { name: 'Purple', color: '#7b3fb8' },
  { name: 'Orange', color: '#f07c1a' },
];
const colourName = (c: string) => PALETTE.find((p) => p.color === c)?.name ?? 'Custom';

function RulesEditor({ mode, rules, setRules }: { mode: ModeId; rules: RulesConfig; setRules: (r: RulesConfig) => void }) {
  const set = (patch: Partial<RulesConfig>) => setRules({ ...rules, ...patch });
  const setBall = (i: number, patch: Partial<BallDef>) =>
    set({ balls: rules.balls.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const [picking, setPicking] = useState<number | null>(null);
  const pickingBall = picking == null ? null : rules.balls[picking];

  if (mode === 'snooker')
    return (
      <Card>
        <h2 className="font-semibold">Standard rules</h2>
        <p className="mt-1 text-sm text-cream/70">15 reds, red 1 to black 7, fouls at least 4 to your opponent.</p>
      </Card>
    );
  if (mode === 'short')
    return (
      <Card>
        <h2 className="mb-2 font-semibold">Reds</h2>
        <Segmented
          label="Number of reds"
          value={rules.reds}
          options={[10, 6].map((n) => ({ value: n, label: `${n} reds` }))}
          onChange={(reds) => set({ reds })}
        />
        <p className="mt-2 text-sm text-cream/70">Maximum break: {rules.reds * 8 + 27}</p>
      </Card>
    );
  if (mode === 'killer')
    return (
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Lives each</h2>
          <Stepper label="lives" value={rules.lives} min={1} max={10} onChange={(lives) => set({ lives })} />
        </div>
      </Card>
    );

  // Points and Free scoring
  return (
    <>
      {mode === 'points' && (
        <Card>
          <h2 className="mb-2 font-semibold">Potted balls</h2>
          <Segmented
            label="Potted balls"
            value={rules.noRack ? 'noRack' : 'rack'}
            options={[
              { value: 'rack', label: 'Rack' },
              { value: 'noRack', label: 'No rack' },
            ]}
            onChange={(v) => set({ noRack: v === 'noRack' })}
          />
          <p className="mt-2 text-sm text-cream/70">
            {rules.noRack
              ? 'Every potted ball goes straight back on its spot. All balls are always in play.'
              : 'Potted balls stay off until you start a new rack. Scores carry over.'}
          </p>
        </Card>
      )}
      <Card>
        <h2 className="mb-2 font-semibold">Ball values</h2>
        <ul className="flex flex-col gap-2">
          {rules.balls.map((b, i) => (
            <li key={b.id} className="flex items-center gap-2">
              {mode === 'free' ? (
                <button
                  type="button"
                  onClick={() => setPicking(i)}
                  aria-label={`Colour for ${b.label}: ${colourName(b.color)}. Change`}
                  className="flex h-12 w-12 items-center justify-center rounded-xl ring-1 ring-cream/15 hover:bg-white/10"
                >
                  <Ball ball={b} size={36} />
                </button>
              ) : (
                <Ball ball={b} size={36} />
              )}
              {mode === 'free' ? (
                <input
                  aria-label={`Name of ball ${i + 1}`}
                  value={b.label}
                  onChange={(e) => setBall(i, { label: e.target.value })}
                  className="min-h-12 min-w-0 flex-1 rounded-xl bg-black/25 px-3 ring-1 ring-cream/15"
                />
              ) : (
                <span className="flex-1">{b.label}</span>
              )}
              <Stepper label={`${b.label} value`} value={b.value} min={0} max={100} onChange={(value) => setBall(i, { value })} />
              {mode === 'free' && rules.balls.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove ${b.label}`}
                  onClick={() => set({ balls: rules.balls.filter((_, j) => j !== i) })}
                  className="h-12 w-10 rounded-xl text-xl text-cream/60 hover:bg-white/10"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
        {mode === 'free' && rules.balls.length < 12 && (
          <Btn
            className="mt-2 w-full"
            onClick={() =>
              set({
                balls: [
                  ...rules.balls,
                  { id: uid(), label: `Ball ${rules.balls.length + 1}`, value: 1, color: PALETTE[rules.balls.length % PALETTE.length].color },
                ],
              })
            }
          >
            + Add ball
          </Btn>
        )}
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">Fouls</h2>
        <div className="flex flex-col gap-2">
          <Segmented
            label="Who the foul counts against"
            value={rules.foul.target}
            options={[
              { value: 'fouler', label: 'Fouler loses points' },
              { value: 'opponents', label: 'Opponents get points' },
            ]}
            onChange={(target) => set({ foul: { ...rules.foul, target } })}
          />
          <Segmented
            label="Foul amount"
            value={rules.foul.amount}
            options={[
              { value: 'ballValue', label: 'Value of the ball' },
              { value: 'fixed', label: 'Fixed amount' },
            ]}
            onChange={(amount) => set({ foul: { ...rules.foul, amount } })}
          />
          {rules.foul.amount === 'fixed' && (
            <div className="flex items-center justify-between">
              <span>Points per foul</span>
              <Stepper
                label="points per foul"
                value={rules.foul.fixedValue}
                min={1}
                max={50}
                onChange={(fixedValue) => set({ foul: { ...rules.foul, fixedValue } })}
              />
            </div>
          )}
        </div>
      </Card>
      <Card>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Target score</h2>
            <p className="text-sm text-cream/70">{rules.targetScore
                ? `${mode === 'points' ? 'Game' : 'Frame'} ends at ${rules.targetScore}`
                : `None — end the ${frameWord(mode)} yourself`}</p>
          </div>
          <Stepper label="target score" value={rules.targetScore} min={0} max={1000} step={10} onChange={(targetScore) => set({ targetScore })} />
        </div>
      </Card>
      <Sheet open={pickingBall != null} onClose={() => setPicking(null)} title={`Colour for ${pickingBall?.label ?? ''}`}>
        <div className="mb-3 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Ball colour">
          {PALETTE.map((p) => (
            <button
              key={p.color}
              type="button"
              role="radio"
              aria-checked={pickingBall?.color === p.color}
              onClick={() => {
                if (picking != null) setBall(picking, { color: p.color });
                setPicking(null);
              }}
              className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl py-2 ring-1 ${
                pickingBall?.color === p.color ? 'bg-gold/20 ring-2 ring-gold' : 'bg-black/20 ring-cream/10'
              }`}
            >
              <Ball ball={{ color: p.color, value: 0 }} size={40} />
              <span className="text-xs">{p.name}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
