'use client';

import { useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { BottomSheet } from '@/components/BottomSheet';

const field =
  'mt-1 w-full rounded-input border border-line bg-white px-4 py-3 outline-none focus:border-violet500';
const label = 'block text-sm font-semibold text-ink600';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}`;
}

function Btn({ children, tone = 'violet' }: { children: string; tone?: 'violet' | 'neg' }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full rounded-button px-5 py-4 text-center font-bold text-white disabled:opacity-60 ${
        tone === 'neg' ? 'bg-neg' : 'bg-violet500'
      }`}
    >
      {pending ? 'Working…' : children}
    </button>
  );
}

/**
 * A flexible life-cost ledger row (Groceries, Gas, Eating out, …) that opens a
 * sheet to change its amount — either just this one week (a one-off override
 * that leaves the ongoing plan untouched) or every time (the recurring plan) —
 * reset a one-off back to the plan, or remove the cost entirely.
 */
export function EditLifeCost({
  id,
  name,
  amountCents,
  date,
  planAction,
  weekAction,
  resetWeekAction,
  deleteAction,
  children,
}: {
  id: string;
  name: string;
  amountCents: number;
  date: string;
  planAction: (fd: FormData) => Promise<void>;
  weekAction: (fd: FormData) => Promise<void>;
  resetWeekAction: () => Promise<void>;
  deleteAction: () => Promise<void>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState((amountCents / 100).toString());
  const [scope, setScope] = useState<'week' | 'plan'>('plan');

  const close = () => {
    setOpen(false);
    setAmount((amountCents / 100).toString());
    setScope('plan');
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full text-left">
        {children}
      </button>

      <BottomSheet open={open} onClose={close} title={name}>
        <form
          action={async (fd) => {
            await (scope === 'week' ? weekAction(fd) : planAction(fd));
            close();
          }}
          className="grid gap-3"
        >
          {/* Fields for the recurring-plan path (setLifeCostPlanning). */}
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="planning_mode" value="CUSTOM" />
          <input type="hidden" name="custom" value={amount} />

          <p className="text-sm text-ink600">
            {name} is flexible — set what you plan to spend.
          </p>

          <label className={label}>
            Amount
            <input
              name="amount"
              inputMode="decimal"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={field}
            />
          </label>

          <div className="flex gap-1 rounded-full bg-line/60 p-1">
            <button
              type="button"
              onClick={() => setScope('week')}
              className={`flex-1 rounded-full py-2 text-sm font-bold ${
                scope === 'week' ? 'bg-white text-violet600 shadow-card' : 'text-ink600'
              }`}
            >
              Just this week ({shortDate(date)})
            </button>
            <button
              type="button"
              onClick={() => setScope('plan')}
              className={`flex-1 rounded-full py-2 text-sm font-bold ${
                scope === 'plan' ? 'bg-white text-violet600 shadow-card' : 'text-ink600'
              }`}
            >
              Every time
            </button>
          </div>
          <p className="text-xs text-ink600">
            {scope === 'week'
              ? 'A one-off tweak for this week only — your ongoing plan stays the same.'
              : 'Changes the planned amount for this category across your whole forecast.'}
          </p>

          <Btn>{scope === 'week' ? `Save for ${shortDate(date)}` : 'Save the plan'}</Btn>
        </form>

        <form
          action={async () => {
            await resetWeekAction();
            close();
          }}
          className="mt-3"
        >
          <button type="submit" className="w-full py-2 text-center text-sm font-bold text-violet600">
            Reset this week to the usual plan
          </button>
        </form>

        <form
          action={async () => {
            await deleteAction();
            close();
          }}
          className="mt-2 grid gap-2 border-t border-line pt-4"
        >
          <p className="text-sm text-ink600">
            Don&apos;t want to track {name.toLowerCase()} here at all? Remove it — you can add it
            back from Life costs.
          </p>
          <Btn tone="neg">Remove this cost entirely</Btn>
        </form>
      </BottomSheet>
    </>
  );
}
