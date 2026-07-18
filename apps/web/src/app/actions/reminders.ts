'use server';

import { revalidatePath } from 'next/cache';
import { addDays, addMonths } from '@fb/engine';
import { extractReminder, type ExtractedReminder, type ReminderCandidate } from '@fb/ai';
import { recalculateFinancials } from '@fb/data';
import { getSessionContext } from '@/lib/session';
import { listOwn } from '@/lib/db';
import { textOrNull } from '@/lib/money';
import type { ReminderRecurrence } from '@/lib/reminders';

/**
 * Reminders are a pure application-layer feature: creating, editing, completing
 * or deleting a reminder never touches balances or the engine. (The one place a
 * reminder affects money — confirming a linked subscription cancellation — is a
 * separate, explicit action added later.) So these actions do NOT call
 * recalculateFinancials; they only revalidate the screens that display
 * reminders.
 */
function refresh(): void {
  revalidatePath('/reminders');
  // Reminders also surface on Home (card), More (badge) and Calendar (dots),
  // which all share the (app) layout — invalidate the whole subtree.
  revalidatePath('/home', 'layout');
}

/** Parse the notification-preferences JSON a form may send; null if absent/invalid. */
function parseNotifPrefs(raw: FormDataEntryValue | null): unknown {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** The next due date for a repeating reminder, or null for NONE/CUSTOM. */
function advanceDue(due: string, rule: ReminderRecurrence): string | null {
  switch (rule) {
    case 'DAILY':
      return addDays(due, 1);
    case 'WEEKLY':
      return addDays(due, 7);
    case 'MONTHLY':
      return addMonths(due, 1);
    default:
      return null; // NONE, or CUSTOM (no fixed interval to advance by)
  }
}

interface ReminderFields {
  title: string;
  description: string | null;
  transcription: string | null;
  due_date: string | null;
  due_time: string | null;
  timezone: string | null;
  category: string | null;
  priority: string;
  status?: string;
  recurrence_rule: string;
  notification_preferences: unknown;
  related_entity_type: string | null;
  related_entity_id: string | null;
}

/** Read the reminder fields out of a submitted form (shared by create + edit). */
function readFields(fd: FormData, timezone: string): ReminderFields {
  const priority = String(fd.get('priority') ?? 'NORMAL');
  const recurrence = String(fd.get('recurrence_rule') ?? 'NONE');
  const relType = textOrNull(fd.get('related_entity_type'));
  const relId = textOrNull(fd.get('related_entity_id'));
  return {
    title: String(fd.get('title') ?? '').trim(),
    description: textOrNull(fd.get('description')),
    transcription: textOrNull(fd.get('transcription')),
    due_date: textOrNull(fd.get('due_date')),
    due_time: textOrNull(fd.get('due_time')),
    timezone: textOrNull(fd.get('timezone')) ?? timezone,
    category: textOrNull(fd.get('category')),
    priority: ['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(priority) ? priority : 'NORMAL',
    recurrence_rule: ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'].includes(recurrence)
      ? recurrence
      : 'NONE',
    notification_preferences: parseNotifPrefs(fd.get('notification_preferences')),
    // Only keep the link when both parts are present.
    related_entity_type: relType && relId ? relType : null,
    related_entity_id: relType && relId ? relId : null,
  };
}

/** Create a reminder. */
export async function createReminder(fd: FormData): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  const f = readFields(fd, clock.timezone);
  if (!f.title) return; // a reminder must say something
  await supabase.from('reminders').insert({ user_id: userId, ...f });
  refresh();
}

/** Edit an existing reminder's fields. */
export async function updateReminder(id: string, fd: FormData): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  const f = readFields(fd, clock.timezone);
  if (!f.title) return;
  await supabase.from('reminders').update(f).eq('id', id).eq('user_id', userId);
  refresh();
}

/**
 * Mark a reminder complete (or reopen it). Completing records the completion
 * time and moves it to the Completed section — it is never deleted. If the
 * reminder repeats, completing it also spawns the next occurrence so the series
 * continues.
 */
export async function setReminderComplete(id: string, complete: boolean): Promise<void> {
  const { supabase, userId } = await getSessionContext();
  const { data } = await supabase
    .from('reminders')
    .select('due_date,recurrence_rule,title,description,category,priority,due_time,timezone,notification_preferences,related_entity_type,related_entity_id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  const row = data as
    | {
        due_date: string | null;
        recurrence_rule: ReminderRecurrence;
        title: string;
        description: string | null;
        category: string | null;
        priority: string;
        due_time: string | null;
        timezone: string | null;
        notification_preferences: unknown;
        related_entity_type: string | null;
        related_entity_id: string | null;
      }
    | null;
  if (!row) return;

  await supabase
    .from('reminders')
    .update({
      status: complete ? 'COMPLETED' : 'OPEN',
      completed_at: complete ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .eq('user_id', userId);

  // Spawn the next occurrence of a repeating reminder on completion.
  if (complete && row.due_date && row.recurrence_rule !== 'NONE') {
    const next = advanceDue(row.due_date, row.recurrence_rule);
    if (next) {
      await supabase.from('reminders').insert({
        user_id: userId,
        title: row.title,
        description: row.description,
        category: row.category,
        priority: row.priority,
        due_date: next,
        due_time: row.due_time,
        timezone: row.timezone,
        recurrence_rule: row.recurrence_rule,
        notification_preferences: row.notification_preferences,
        related_entity_type: row.related_entity_type,
        related_entity_id: row.related_entity_id,
        status: 'OPEN',
      });
    }
  }
  refresh();
}

/** Reschedule: change only the due date (and optional time). */
export async function rescheduleReminder(id: string, fd: FormData): Promise<void> {
  const { supabase, userId } = await getSessionContext();
  await supabase
    .from('reminders')
    .update({ due_date: textOrNull(fd.get('due_date')), due_time: textOrNull(fd.get('due_time')) })
    .eq('id', id)
    .eq('user_id', userId);
  refresh();
}

/** Duplicate a reminder as a fresh OPEN copy (keeps the fields, clears completion). */
export async function duplicateReminder(id: string): Promise<void> {
  const { supabase, userId } = await getSessionContext();
  const { data } = await supabase
    .from('reminders')
    .select('title,description,due_date,due_time,timezone,category,priority,recurrence_rule,notification_preferences,related_entity_type,related_entity_id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return;
  await supabase.from('reminders').insert({
    user_id: userId,
    ...(data as Record<string, unknown>),
    status: 'OPEN',
    completed_at: null,
  });
  refresh();
}

/** Soft-delete a reminder (kept out of every list; never hard-deleted). */
export async function deleteReminder(id: string): Promise<void> {
  const { supabase, userId } = await getSessionContext();
  await supabase
    .from('reminders')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
  refresh();
}

/**
 * Confirming a subscription cancellation from a linked reminder. Pausing is
 * what removes a subscription from the forecast (see @fb/data normalize), so we
 * pause it AND stamp canceled_at — future charges stop while the record is
 * kept, never hard-deleted — then recalculate so the forecast, Reserved for
 * Bills and Safe to Spend all update. This is the one reminder action that
 * touches money, and only when the user explicitly confirms it.
 */
export async function cancelSubscriptionForReminder(subscriptionId: string): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  if (!subscriptionId) return;
  await supabase
    .from('subscriptions')
    .update({ paused: true, canceled_at: new Date().toISOString() })
    .eq('id', subscriptionId)
    .eq('user_id', userId);
  await recalculateFinancials(supabase, userId, clock);
  refresh();
}

// ---- Voice capture ---------------------------------------------------------

export type TranscribeResult = { ok: true; text: string } | { ok: false; error: string };
export type SuggestResult = { ok: true; suggestion: ExtractedReminder } | { ok: false; error: string };

/**
 * Transcribe a short audio clip with OpenAI Whisper. The audio is forwarded to
 * OpenAI for this one request and never stored anywhere — only the returned
 * text is used. Degrades gracefully if the key is missing, so the rest of the
 * feature keeps working.
 */
export async function transcribeVoice(fd: FormData): Promise<TranscribeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: 'Voice transcription isn’t set up yet. Add OPENAI_API_KEY to apps/web/.env.local, or just type your reminder.',
    };
  }
  const audio = fd.get('audio');
  if (!(audio instanceof Blob) || audio.size === 0) {
    return { ok: false, error: 'No audio was recorded. Try again, or type your reminder.' };
  }

  try {
    const upstream = new FormData();
    upstream.append('file', audio, 'reminder.webm');
    upstream.append('model', 'whisper-1');
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });
    if (!res.ok) {
      return { ok: false, error: 'Could not transcribe the audio. You can type your reminder instead.' };
    }
    const data = (await res.json()) as { text?: string };
    const text = (data.text ?? '').trim();
    if (!text) return { ok: false, error: 'Didn’t catch that. Try again, or type your reminder.' };
    return { ok: true, text };
  } catch {
    return { ok: false, error: 'Could not reach the transcription service. You can type your reminder.' };
  }
}

/**
 * Ask Claude to turn transcript/typed text into suggested reminder fields,
 * matching against the user's real financial items. Only the text and the item
 * names/ids are sent — no other financial data. The user reviews and edits the
 * suggestion before anything is saved.
 */
export async function suggestReminder(text: string): Promise<SuggestResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'Nothing to read yet.' };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: 'AI suggestions aren’t connected. Add ANTHROPIC_API_KEY to apps/web/.env.local — you can still fill the fields yourself.',
    };
  }

  const { clock } = await getSessionContext();
  const [subs, obls, accts, goals, biz] = await Promise.all([
    listOwn('subscriptions', 'id,name'),
    listOwn('obligations', 'id,name'),
    listOwn('accounts', 'id,name'),
    listOwn('goals', 'id,name'),
    listOwn('businesses', 'id,name'),
  ]);
  const candidates: ReminderCandidate[] = [
    ...subs.map((r) => ({ ref: `subscription:${r.id}`, name: String(r.name), type: 'subscription' })),
    ...obls.map((r) => ({ ref: `obligation:${r.id}`, name: String(r.name), type: 'obligation' })),
    ...accts.map((r) => ({ ref: `account:${r.id}`, name: String(r.name), type: 'account' })),
    ...goals.map((r) => ({ ref: `goal:${r.id}`, name: String(r.name), type: 'goal' })),
    ...biz.map((r) => ({ ref: `business:${r.id}`, name: String(r.name), type: 'business' })),
  ];

  try {
    const suggestion = await extractReminder({
      text: trimmed,
      candidates,
      today: clock.today,
      timezone: clock.timezone,
      apiKey,
    });
    return { ok: true, suggestion };
  } catch {
    return { ok: false, error: 'Couldn’t generate a suggestion. You can fill the fields yourself.' };
  }
}
