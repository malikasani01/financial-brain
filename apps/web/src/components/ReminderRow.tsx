'use client';

import { useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { BottomSheet } from '@/components/BottomSheet';
import { ReminderForm } from '@/components/ReminderForm';
import { Icon } from '@/components/Icon';
import { Badge } from '@/components/brand';
import {
  PRIORITY_META,
  TIMING_META,
  shortDate,
  shortTime,
  type RelatedOption,
} from '@/lib/reminder-options';
import {
  cancelSubscriptionForReminder,
  deleteReminder,
  duplicateReminder,
  rescheduleReminder,
  setReminderComplete,
  updateReminder,
} from '@/app/actions/reminders';
import type { ReminderRow as Reminder, ReminderTiming } from '@/lib/reminders';

const field =
  'mt-1 w-full rounded-input border border-line bg-white px-4 py-3 outline-none focus:border-violet500';
const label = 'block text-sm font-semibold text-ink600';

function RescheduleBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 w-full rounded-button bg-violet500 px-5 py-4 text-center font-bold text-white shadow-card disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Reschedule'}
    </button>
  );
}

/**
 * One reminder row: a rounded checkbox to complete/reopen, the title (tap to
 * edit) and its meta chips, and a small actions menu (reschedule, duplicate,
 * delete). Completing never deletes — the row moves to Completed and can be
 * un-checked.
 */
export function ReminderRow({
  reminder,
  timing,
  dueSoon,
  linkedLabel,
  linkedContext,
  relatedOptions,
}: {
  reminder: Reminder;
  timing: ReminderTiming;
  dueSoon: boolean;
  linkedLabel: string | null;
  linkedContext: string | null;
  relatedOptions: RelatedOption[];
}) {
  const [pending, start] = useTransition();
  const [menu, setMenu] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const done = reminder.status !== 'OPEN';
  const canceled = reminder.status === 'CANCELED';
  const subLink =
    reminder.related_entity_type === 'subscription' && reminder.related_entity_id
      ? reminder.related_entity_id
      : null;

  const complete = () => start(async () => void (await setReminderComplete(reminder.id, true)));
  const toggle = () => {
    // Completing a subscription-linked reminder first asks whether the
    // subscription was actually canceled (which stops its future charges).
    if (!done && subLink) {
      setConfirmCancel(true);
      return;
    }
    start(async () => void (await setReminderComplete(reminder.id, !done)));
  };
  const cancelAndComplete = () =>
    start(async () => {
      if (subLink) await cancelSubscriptionForReminder(subLink);
      await setReminderComplete(reminder.id, true);
    });
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
        <ReminderForm
          action={updateReminder.bind(null, reminder.id)}
          reminder={reminder}
          relatedOptions={relatedOptions}
          title="Edit reminder"
          contextBanner={linkedContext}
        >
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

          {(timingMeta || reminder.priority !== 'NORMAL' || reminder.recurrence_rule !== 'NONE') &&
            !done && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {timingMeta && timing !== 'upcoming' && (
                  <Badge tone={timingMeta.tone}>{timingMeta.label}</Badge>
                )}
                {timing === 'upcoming' && dueSoon && <Badge tone="warn">Due soon</Badge>}
                {reminder.priority !== 'NORMAL' && <Badge tone={priority.tone}>{priority.label}</Badge>}
                {reminder.recurrence_rule !== 'NONE' && <Badge tone="neutral">Repeats</Badge>}
              </div>
            )}
          {canceled && <p className="mt-1 text-xs text-ink600">Canceled</p>}
        </ReminderForm>
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
                  setRescheduling(true);
                }}
                className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-ink900 hover:bg-line/50"
              >
                Reschedule
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  dup();
                }}
                className="block w-full border-t border-line px-4 py-2.5 text-left text-sm font-semibold text-ink900 hover:bg-line/50"
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

      <BottomSheet open={rescheduling} onClose={() => setRescheduling(false)} title="Reschedule">
        <form
          action={async (fd) => {
            await rescheduleReminder(reminder.id, fd);
            setRescheduling(false);
          }}
          className="grid gap-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Due date
              <input name="due_date" type="date" defaultValue={reminder.due_date ?? ''} className={field} />
            </label>
            <label className={label}>
              Time
              <input name="due_time" type="time" defaultValue={reminder.due_time ?? ''} className={field} />
            </label>
          </div>
          <RescheduleBtn />
        </form>
      </BottomSheet>

      <BottomSheet
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancel subscription?"
      >
        <p className="text-sm text-ink900">Did you successfully cancel this subscription?</p>
        {linkedContext && <p className="mt-1 text-sm font-semibold text-violet600">{linkedContext}</p>}
        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={() => {
              setConfirmCancel(false);
              cancelAndComplete();
            }}
            className="w-full rounded-button bg-violet500 px-5 py-3.5 text-center font-bold text-white shadow-card"
          >
            Yes — mark it canceled
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmCancel(false);
              complete();
            }}
            className="w-full rounded-button border border-line bg-white px-5 py-3.5 text-center font-bold text-ink900"
          >
            No — just complete the reminder
          </button>
          <button
            type="button"
            onClick={() => setConfirmCancel(false)}
            className="w-full px-5 py-2.5 text-center text-sm font-bold text-ink600"
          >
            Not yet
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-ink600">
          Marking it canceled stops its future charges and updates your forecast. The record is kept.
        </p>
      </BottomSheet>
    </div>
  );
}
