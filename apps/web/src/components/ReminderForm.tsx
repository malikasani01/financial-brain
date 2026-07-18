'use client';

import { useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { BottomSheet } from '@/components/BottomSheet';
import {
  REMINDER_CATEGORIES,
  REMINDER_PRIORITIES,
  REMINDER_REPEATS,
} from '@/lib/reminder-options';
import type { ReminderRow } from '@/lib/reminders';

const field =
  'mt-1 w-full rounded-input border border-line bg-white px-4 py-3 outline-none focus:border-violet500';
const label = 'block text-sm font-semibold text-ink600';

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
 * Create or edit a reminder. `children` is the tappable trigger (a button or a
 * row). Pass `reminder` to prefill for editing; omit it to create. The core
 * fields live here; richer capture (voice, related-item link, notification
 * timing) is layered on in later phases.
 */
export function ReminderForm({
  action,
  reminder,
  title,
  children,
}: {
  action: (fd: FormData) => Promise<void>;
  reminder?: ReminderRow;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const create = !reminder;

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

          <SaveBtn create={create} />
        </form>
      </BottomSheet>
    </>
  );
}
