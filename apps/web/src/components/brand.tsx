import type { ReactNode } from 'react';
import { centsToDollars } from '@/lib/money';

/**
 * Financial Brain brand primitives. Violet is the primary accent; money colors
 * (pos/neg/warn/info) are reserved for money meaning only.
 */

/** The brand mark: violet rounded square, ink cutout, small positive-green dot. */
export function Logo({ size = 32, withWordmark = false }: { size?: number; withWordmark?: boolean }) {
  const mark = (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <rect width="100" height="100" rx="24" fill="#14131A" />
      <rect x="32" y="32" width="36" height="36" rx="11" fill="#6C4CFF" />
      <circle cx="44" cy="44" r="12" fill="#14131A" />
      <circle cx="65" cy="65" r="7" fill="#1FAE6B" />
    </svg>
  );
  if (!withWordmark) return mark;
  return (
    <span className="inline-flex items-center gap-2">
      {mark}
      <span className="text-lg font-extrabold tracking-tight text-ink900">Financial Brain</span>
    </span>
  );
}

/** Money value in Space Grotesk. `colorBySign` tints positive green / negative red. */
export function Money({
  cents,
  colorBySign = false,
  showPlus = false,
  className = '',
}: {
  cents: number;
  colorBySign?: boolean;
  showPlus?: boolean;
  className?: string;
}) {
  const color = colorBySign ? (cents > 0 ? 'text-pos' : cents < 0 ? 'text-neg' : 'text-ink900') : '';
  const sign = showPlus && cents > 0 ? '+' : '';
  return <span className={`font-num ${color} ${className}`}>{sign}{centsToDollars(cents)}</span>;
}

type Tone = 'violet' | 'pos' | 'neg' | 'warn' | 'info' | 'neutral';

const TONE_CLASS: Record<Tone, string> = {
  violet: 'bg-violet100 text-violet600',
  pos: 'bg-pos/10 text-pos',
  neg: 'bg-neg/10 text-neg',
  warn: 'bg-warn/15 text-[#9A6410]',
  info: 'bg-info/10 text-info',
  neutral: 'bg-line text-ink600',
};

/** Small status/label chip (10px radius). */
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-input px-2.5 py-1 text-xs font-bold ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}

const DOT_CLASS: Record<Tone, string> = {
  violet: 'bg-violet500',
  pos: 'bg-pos',
  neg: 'bg-neg',
  warn: 'bg-warn',
  info: 'bg-info',
  neutral: 'bg-line',
};

/** A small semantic dot (calendar signals, list markers). */
export function StatusDot({ tone, className = '' }: { tone: Tone; className?: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${DOT_CLASS[tone]} ${className}`} aria-hidden />;
}

/** Presentational pill segmented control (wrap each segment yourself as link/button). */
export function Segmented({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-line/60 p-1">{children}</div>
  );
}

export function SegmentItem({ active, children }: { active?: boolean; children: ReactNode }) {
  return (
    <span
      className={`rounded-full px-4 py-1.5 text-sm font-bold ${
        active ? 'bg-white text-violet600 shadow-card' : 'text-ink600'
      }`}
    >
      {children}
    </span>
  );
}
