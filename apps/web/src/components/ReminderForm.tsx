'use client';

import { useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { BottomSheet } from '@/components/BottomSheet';
import {
  REMINDER_CATEGORIES,
  REMINDER_PRIORITIES,
  REMINDER_REPEATS,
  type RelatedOption,
} from '@/lib/reminder-options';
import type { ReminderLead, ReminderRow } from '@/lib/reminders';

const field =
  'mt-1 w-full rounded-input border border-line bg-white px-4 py-3 outline-none focus:border-violet500';
const label = 'block text-sm font-semibold text-ink600';

const LEADS: { value: ReminderLead; label: string }[] = [
  { value: 'AT_DUE', label: 'At due time' },
  { value: 'ONE_DAY', label: '1 day before' },
  { value: 'THREE_DAYS', label: '3 days before' },
  { value: 'ONE_WEEK', label: '1 week before' },
];

function SaveBtn({ create }: { create: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 w-full rounded-button bg-violet500 px-5 py-4 text-center font-bold text-white shadow-card disabled:opacity-60"
    >
      {pending ? 'Saving…' : create ? 'Add reminder' : 'Save changes'}
    </button>
  );
}

/**
 * Create or edit a reminder. `children` is the tappable trigger. Pass
 * `reminder` to prefill for editing; omit it to create. `relatedOptions` (the
 * user's real subscriptions/obligations/accounts/goals/businesses) powers the
 * optional "link to a financial item" picker.
 */
export function ReminderForm({
  action,
  reminder,
  title,
  relatedOptions = [],
  contextBanner,
  children,
}: {
  action: (fd: FormData) => Promise<void>;
  reminder?: ReminderRow;
  title: string;
  relatedOptions?: RelatedOption[];
  contextBanner?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const create = !reminder;

  const initialRef =
    reminder?.related_entity_type && reminder?.related_entity_id
      ? `${reminder.related_entity_type}:${reminder.related_entity_id}`
      : '';
  const [relatedRef, setRelatedRef] = useState(initialRef);
  const [relType, relId] = relatedRef ? relatedRef.split(':') : ['', ''];

  const [leads, setLeads] = useState<Set<ReminderLead>>(
    new Set(reminder?.notification_preferences?.lead ?? []),
  );
  const toggleLead = (l: ReminderLead) =>
    setLeads((prev) => {
      const next = new Set(prev);
      if (next.has(l)) next.delete(l);
      else next.add(l);
      return next;
    });
  const notifJson = leads.size > 0 ? JSON.stringify({ lead: [...leads] }) : '';

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full text-left">
        {children}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={title}>
        <form
          action={async (fd) => {
            await action(fd);
            setOpen(false);
          }}
          className="grid gap-3"
        >
          {contextBanner && (
            <div className="rounded-input bg-violet100 px-4 py-3 text-sm font-semibold text-violet600">
              {contextBanner}
            </div>
          )}

          {/* Link + notifications ride along as hidden fields driven by state. */}
          <input type="hidden" name="related_entity_type" value={relType} />
          <input type="hidden" name="related_entity_id" value={relId} />
          <input type="hidden" name="notification_preferences" value={notifJson} />
          {reminder?.transcription && (
            <input type="hidden" name="transcription" value={reminder.transcription} />
          )}

          <label className={label}>
            What do you need to remember?
            <input
              name="title"
              required
              autoFocus={create}
              defaultValue={reminder?.title ?? ''}
              placeholder="Cancel Loom, call about car insurance…"
              className={field}
            />
          </label>

          <label className={label}>
            Details <span className="font-normal text-ink600">(optional)</span>
            <textarea
              name="description"
              rows={2}
              defaultValue={reminder?.description ?? ''}
              placeholder="Anything worth noting"
              className={field}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Due date
              <input name="due_date" type="date" defaultValue={reminder?.due_date ?? ''} className={field} />
            </label>
            <label className={label}>
              Time <span className="font-normal text-ink600">(optional)</span>
              <input name="due_time" type="time" defaultValue={reminder?.due_time ?? ''} className={field} />
            </label>
          </div>

          <label className={label}>
            Category
            <select name="category" defaultValue={reminder?.category ?? ''} className={field}>
              <option value="">Choose a category…</option>
              {REMINDER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Priority
              <select name="priority" defaultValue={reminder?.priority ?? 'NORMAL'} className={field}>
                {REMINDER_PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Repeat
              <select
                name="recurrence_rule"
                defaultValue={reminder?.recurrence_rule ?? 'NONE'}
                className={field}
              >
                {REMINDER_REPEATS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {relatedOptions.length > 0 && (
            <label className={label}>
              Related financial item <span className="font-normal text-ink600">(optional)</span>
              <select
                value={relatedRef}
                onChange={(e) => setRelatedRef(e.target.value)}
                className={field}
              >
                <option value="">Not linked</option>
                {['subscription', 'obligation', 'account', 'goal', 'business'].map((group) => {
                  const opts = relatedOptions.filter((o) => o.value.startsWith(`${group}:`));
                  if (opts.length === 0) return null;
                  return (
                    <optgroup key={group} label={group[0]!.toUpperCase() + group.slice(1) + 's'}>
                      {opts.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </label>
          )}

          <div>
            <span className={label}>
              Remind me <span className="font-normal text-ink600">(while the app is open)</span>
            </span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {LEADS.map((l) => {
                const on = leads.has(l.value);
                return (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => toggleLead(l.value)}
                    className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                      on ? 'bg-violet500 text-white' : 'bg-line text-ink600'
                    }`}
                  >
                    {l.label}
                  </button>
                );
              })}
            </div>
          </div>

          <SaveBtn create={create} />
        </form>
      </BottomSheet>
    </>
  );
}
