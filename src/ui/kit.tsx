import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { BallDef } from '../engine';

// ---------- Ball ----------

export function Ball({
  ball,
  size = 56,
  off = false,
  showValue = false,
  className = '',
}: {
  ball: Pick<BallDef, 'color' | 'value'>;
  size?: number;
  off?: boolean;
  showValue?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`ball inline-flex shrink-0 items-center justify-center ${off ? 'ball-off' : ''} ${className}`}
      style={{ width: size, height: size, ['--ball' as string]: ball.color }}
    >
      {showValue && (
        <span
          className="font-score tabular flex items-center justify-center rounded-full bg-cream/90 font-bold text-wood-dark"
          style={{ width: size * 0.42, height: size * 0.42, fontSize: size * 0.26 }}
        >
          {ball.value}
        </span>
      )}
    </span>
  );
}

// ---------- Buttons ----------

type Variant = 'primary' | 'gold' | 'foul' | 'ghost' | 'wood';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-cream text-wood-dark hover:bg-white',
  gold: 'bg-gold text-wood-dark hover:bg-gold-soft',
  foul: 'bg-foul text-wood-dark hover:brightness-110',
  ghost: 'bg-black/25 text-cream ring-1 ring-cream/20 hover:bg-black/35',
  wood: 'wood text-cream ring-1 ring-black/30',
};

export function Btn({
  variant = 'ghost',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...rest}
      className={`min-h-12 rounded-2xl px-4 font-semibold transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

// ---------- Bottom sheet (instead of modals) ----------

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>('button, input, select, [tabindex]');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="presentation">
      <div className="fade-enter absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-enter pb-safe relative mx-auto max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-baize-deep px-4 pt-3 shadow-2xl ring-1 ring-cream/15"
      >
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-cream/30" aria-hidden />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-cream/80 hover:bg-white/10"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Top bar ----------

export function TopBar({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <header className="wood pt-safe sticky top-0 z-30 shadow-lg shadow-black/40">
      <div className="mx-auto flex h-14 max-w-lg items-center gap-1 px-1">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex h-12 w-12 items-center justify-center rounded-full text-2xl hover:bg-white/10"
          >
            ‹
          </button>
        ) : (
          <span className="w-3" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg leading-tight font-semibold">{title}</h1>
          {subtitle && <p className="truncate text-xs text-cream/70">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}

// ---------- Stepper ----------

export function Stepper({
  label,
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button
        type="button"
        className="h-12 w-12 rounded-xl bg-black/25 text-2xl ring-1 ring-cream/20 disabled:opacity-30"
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
        aria-label={`Decrease ${label}`}
      >
        −
      </button>
      <output className="font-score tabular w-12 text-center text-2xl font-semibold" aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        className="h-12 w-12 rounded-xl bg-black/25 text-2xl ring-1 ring-cream/20 disabled:opacity-30"
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
        aria-label={`Increase ${label}`}
      >
        +
      </button>
    </div>
  );
}

// ---------- Segmented control ----------

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-2xl bg-black/25 p-1 ring-1 ring-cream/15">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={`min-h-11 flex-1 rounded-xl px-2 text-sm font-semibold transition disabled:opacity-30 ${
            o.value === value ? 'bg-gold text-wood-dark' : 'text-cream/85 hover:bg-white/10'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Toast ----------

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(t);
  }, [msg]);
  const node = (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] z-[60] flex justify-center px-4">
      {msg && (
        <div className="fade-enter rounded-full bg-cream px-4 py-2 text-sm font-semibold text-wood-dark shadow-lg">{msg}</div>
      )}
    </div>
  );
  return { toast: setMsg, toastNode: node };
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-black/25 p-4 ring-1 ring-cream/10 ${className}`}>{children}</div>;
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
