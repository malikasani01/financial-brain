/**
 * Client-safe display constants and pure view-helpers for reminders. No server
 * imports live here, so both Server Components and Client Components can use it
 * (unlike lib/reminders.ts, which pulls in the session/DB layer).
 */
import type { ReminderPriority, ReminderRecurrence, ReminderTiming } from '@/lib/reminders';

/** The standard financial reminder categories (this is not a general notes app). */
export const REMINDER_CATEGORIES = [
  'Subscription',
  'Insurance',
  'Bill',
  'Debt',
  'Legal',
  'Account',
  'Goal',
  'Business',
  'Follow-up',
  'Other',
] as const;

export const REMINDER_PRIORITIES: { value: ReminderPriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export const REMINDER_REPEATS: { value: ReminderRecurrence; label: string }[] = [
  { value: 'NONE', label: 'Does not repeat' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'CUSTOM', label: 'Custom' },
];

type Tone = 'violet' | 'pos' | 'neg' | 'warn' | 'info' | 'neutral';

/**
 * Priority chip appearance. Per the brand rule: violet = normal action,
 * amber = elevated, coral = urgent. Low is muted; green is reserved for
 * completion, never priority.
 */
export const PRIORITY_META: Record<ReminderPriority, { label: string; tone: Tone }> = {
  LOW: { label: 'Low', tone: 'neutral' },
  NORMAL: { label: 'Normal', tone: 'violet' },
  HIGH: { label: 'High', tone: 'warn' },
  URGENT: { label: 'Urgent', tone: 'neg' },
};

/** Timing chip appearance for a reminder's due state. */
export const TIMING_META: Record<Exclude<ReminderTiming, 'none'>, { label: string; tone: Tone }> = {
  overdue: { label: 'Overdue', tone: 'neg' },
  today: { label: 'Due today', tone: 'warn' },
  upcoming: { label: 'Upcoming', tone: 'violet' },
};

/** Human month/day label for a due date, e.g. "Aug 5". Empty for null. */
export function shortDate(iso: string | null): string {
  if (!iso) return '';
  const [, m, d] = iso.split('-').map(Number);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${MONTHS[(m ?? 1) - 1]} ${d}`;
}

/** 12-hour clock label for a 'HH:MM[:SS]' time string, e.g. "2:30 PM". Empty for null. */
export function shortTime(t: string | null): string {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  let h = Number(hStr);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${mStr ?? '00'} ${ampm}`;
}
