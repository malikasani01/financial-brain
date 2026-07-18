'use client';

import { useState, useTransition } from 'react';
import { Icon } from '@/components/Icon';
import { Badge } from '@/components/brand';
import {
  PRIORITY_META,
  TIMING_META,
  shortDate,
  shortTime,
} from '@/lib/reminder-options';
import {
  deleteReminder,
  duplicateReminder,
  setReminderComplete,
} from '@/app/actions/reminders';
import type { ReminderRow as Reminder, ReminderTiming } from '@/lib/reminders';

/**
 * One reminder row: a rounded checkbox to complete/reopen, the title and its
 * meta chips (category, priority, timing, linked item), and a small actions
 * menu (duplicate, delete). Completing never deletes — the row simply moves to
 * the Completed section and can be un-checked.
 */
export function ReminderRow({
  reminder,
  timing,
  dueSoon,
  linkedLabel,
}: {
  reminder: Reminder;
  timing: ReminderTiming;
  dueSoon: boolean;
  linkedLabel: string | null;
}) {
  const [pending, start] = useTransition();
  const [menu, setMenu] = useState(false);
  const done = reminder.status !== 'OPEN';
  const canceled = reminder.status === 'CANCELED';

  const toggle = () => start(async () => void (await setReminderComplete(reminder.id, !done)));
  const dup = () => start(async () => void (await duplicateReminder(reminder.id)));
  const del = () => start(async () => void (await deleteReminder(reminder.id)));

  const priority = PRIORITY_META[reminder.priority];
  const timingMeta = timing !== 'none' ? TIMING_META[timing] : null;
  const dateLabel = shortDate(reminder.due_date);
  const timeLabel = shortTime(reminder.due_time);

  return (
    <div className={`flex items-start gap-3 py-3 ${pending ? 'opacity-60' : ''}`}>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={done}
        aria-label={done ? 'Mark reminder open' : 'Mark reminder complete'}
        className={done ? 'text-pos' : 'text-ink600 hover:text-violet600'}
      >
        <Icon name={done ? 'check-circle' : 'circle'} size={26} />
      </button>

      <div className="min-w-0 flex-1">
        <p className={`font-bold text-ink900 ${done ? 'text-ink600 line-through' : ''}`}>
          {reminder.title}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink600">
          {reminder.due_date && (
            <span className="font-semibold">
              {timing === 'today' ? 'Today' : dateLabel}
              {timeLabel && ` · ${timeLabel}`}
            </span>
          )}
          {reminder.category && <span>{reminder.category}</span>}
          {linkedLabel && (
            <span className="inline-flex items-center gap-1 text-violet600">
              <Icon name="repeat" size={12} />
              {linkedLabel}
            </span>
          )}
        </div>

        {(timingMeta || reminder.priority !== 'NORMAL' || reminder.recurrence_rule !== 'NONE') && !done && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {timingMeta && timing !== 'upcoming' && <Badge tone={timingMeta.tone}>{timingMeta.label}</Badge>}
            {timing === 'upcoming' && dueSoon && <Badge tone="warn">Due soon</Badge>}
            {reminder.priority !== 'NORMAL' && <Badge tone={priority.tone}>{priority.label}</Badge>}
            {reminder.recurrence_rule !== 'NONE' && <Badge tone="neutral">Repeats</Badge>}
          </div>
        )}
        {canceled && <p className="mt-1 text-xs text-ink600">Canceled</p>}
      </div>

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          aria-label="Reminder actions"
          className="rounded-button p-1 text-ink600 hover:bg-line"
        >
          <Icon name="dots" size={20} />
        </button>
        {menu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} aria-hidden />
            <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-card border border-line bg-white shadow-card">
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  dup();
                }}
                className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-ink900 hover:bg-line/50"
              >
                Duplicate
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  del();
                }}
                className="block w-full border-t border-line px-4 py-2.5 text-left text-sm font-semibold text-neg hover:bg-line/50"
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
