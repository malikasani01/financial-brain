import { getSessionContext } from '@/lib/session';

export type ReminderPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type ReminderStatus = 'OPEN' | 'COMPLETED' | 'CANCELED';
export type ReminderRecurrence = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
export type ReminderEntityType = 'subscription' | 'obligation' | 'account' | 'goal' | 'business';

/** One lead-time notification preference. */
export type ReminderLead = 'AT_DUE' | 'ONE_DAY' | 'THREE_DAYS' | 'ONE_WEEK' | 'CUSTOM';
export interface ReminderNotificationPrefs {
  lead: ReminderLead[];
  customDays?: number;
}

export interface ReminderRow {
  id: string;
  title: string;
  description: string | null;
  transcription: string | null;
  due_date: string | null;
  due_time: string | null;
  timezone: string | null;
  category: string | null;
  priority: ReminderPriority;
  status: ReminderStatus;
  recurrence_rule: ReminderRecurrence;
  notification_preferences: ReminderNotificationPrefs | null;
  related_entity_type: ReminderEntityType | null;
  related_entity_id: string | null;
  completed_at: string | null;
}

const COLUMNS =
  'id,title,description,transcription,due_date,due_time,timezone,category,priority,status,recurrence_rule,notification_preferences,related_entity_type,related_entity_id,completed_at';

/**
 * Read the current user's reminders. Open reminders come first by soonest due
 * date (undated last), then completed/canceled by most recently touched.
 * Resilient to migration 0005 not being applied yet — returns [] rather than
 * throwing, so the rest of the app keeps working before the table exists.
 */
export async function listReminders(): Promise<ReminderRow[]> {
  const { supabase, userId } = await getSessionContext();
  const { data, error } = await supabase
    .from('reminders')
    .select(COLUMNS)
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return [];
  return (data ?? []) as ReminderRow[];
}

// --- Pure derivations (no I/O; overdue/due-soon are never stored) -----------

export type ReminderTiming = 'overdue' | 'today' | 'upcoming' | 'none';

/**
 * Where an OPEN reminder falls relative to today, from its due date alone.
 * Completed/canceled reminders always report 'none' — timing is only about
 * open work. Dates are 'YYYY-MM-DD' strings, safe to compare lexicographically.
 */
export function reminderTiming(r: Pick<ReminderRow, 'due_date' | 'status'>, today: string): ReminderTiming {
  if (r.status !== 'OPEN' || !r.due_date) return 'none';
  if (r.due_date < today) return 'overdue';
  if (r.due_date === today) return 'today';
  return 'upcoming';
}

/** True when an open reminder is due within the next `days` (default 3), inclusive. */
export function isDueSoon(
  r: Pick<ReminderRow, 'due_date' | 'status'>,
  today: string,
  days = 3,
): boolean {
  if (r.status !== 'OPEN' || !r.due_date) return false;
  if (r.due_date <= today) return false; // today/overdue handled separately
  const horizon = addDaysISO(today, days);
  return r.due_date <= horizon;
}

/** Add whole days to a 'YYYY-MM-DD' string via UTC to avoid timezone drift. */
function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days));
  return dt.toISOString().slice(0, 10);
}

export interface ReminderSections {
  overdue: ReminderRow[];
  today: ReminderRow[];
  upcoming: ReminderRow[];
  noDate: ReminderRow[];
  completed: ReminderRow[];
}

/**
 * Split reminders into the display sections. Open reminders land in
 * overdue/today/upcoming/noDate by due date; completed AND canceled land in
 * `completed` (canceled reminders are done work too, shown struck-through).
 */
export function groupReminders(reminders: ReminderRow[], today: string): ReminderSections {
  const s: ReminderSections = { overdue: [], today: [], upcoming: [], noDate: [], completed: [] };
  for (const r of reminders) {
    if (r.status !== 'OPEN') {
      s.completed.push(r);
      continue;
    }
    if (!r.due_date) {
      s.noDate.push(r);
      continue;
    }
    const timing = reminderTiming(r, today);
    if (timing === 'overdue') s.overdue.push(r);
    else if (timing === 'today') s.today.push(r);
    else s.upcoming.push(r);
  }
  return s;
}

/**
 * The reminders that need attention now — overdue and due-today open reminders
 * — used for the More-menu badge count.
 */
export function attentionCount(reminders: ReminderRow[], today: string): number {
  return reminders.filter((r) => {
    const t = reminderTiming(r, today);
    return t === 'overdue' || t === 'today';
  }).length;
}

/**
 * Top open reminders for the Home "Needs your attention" card: overdue first,
 * then due today, then high/urgent-priority upcoming — capped at `limit`.
 */
export function attentionReminders(reminders: ReminderRow[], today: string, limit = 3): ReminderRow[] {
  const rank = (r: ReminderRow): number => {
    const t = reminderTiming(r, today);
    if (t === 'overdue') return 0;
    if (t === 'today') return 1;
    if (t === 'upcoming' && (r.priority === 'HIGH' || r.priority === 'URGENT')) return 2;
    return 99;
  };
  return reminders
    .filter((r) => rank(r) < 99)
    .sort((a, b) => rank(a) - rank(b) || (a.due_date ?? '').localeCompare(b.due_date ?? ''))
    .slice(0, limit);
}
