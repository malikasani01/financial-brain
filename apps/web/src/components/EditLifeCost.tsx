'use client';

import { useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { BottomSheet } from '@/components/BottomSheet';
import { centsToDollars } from '@/lib/money';

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
 * A flexible life-cost ledger row (Groceries, Gas, …). Two ways to plan it:
 *  - Fixed amount: a set amount per occurrence — for just this week (a one-off
 *    override) or every time (the recurring plan).
 *  - Monthly budget: an envelope for the month; the forecast reserves what's
 *    LEFT (budget − spent so far). As you log spending in this category, spent
 *    goes up and left goes down.
 * Also: reset a one-off back to plan, or remove the cost entirely.
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
  budgetAction,
  budgetMode,
  monthlyBudgetCents,
  spentThisMonthCents,
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
  budgetAction: (fd: FormData) => Promise<void>;
  budgetMode: boolean;
  monthlyBudgetCents: number | null;
  spentThisMonthCents: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'fixed' | 'budget'>(budgetMode ? 'budget' : 'fixed');
  const [amount, setAmount] = useState((amountCents / 100).toString());
  const [scope, setScope] = useState<'week' | 'plan'>('plan');
  const [budget, setBudget] = useState(((monthlyBudgetCents ?? amountCents) / 100).toString());

  const close = () => {
    setOpen(false);
    setMode(budgetMode ? 'budget' : 'fixed');
    setAmount((amountCents / 100).toString());
    setScope('plan');
    setBudget(((monthlyBudgetCents ?? amountCents) / 100).toString());
  };

  const budgetCents = Math.round((Number(budget) || 0) * 100);
  const leftCents = Math.max(0, budgetCents - spentThisMonthCents);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full text-left">
        {children}
      </button>

      <BottomSheet open={open} onClose={close} title={name}>
        {/* Fixed amount vs monthly budget */}
        <div className="mb-3 flex gap-1 rounded-full bg-line/60 p-1">
          <button
            type="button"
            onClick={() => setMode('fixed')}
            className={`flex-1 rounded-full py-2 text-sm font-bold ${
              mode === 'fixed' ? 'bg-white text-violet600 shadow-card' : 'text-ink600'
            }`}
          >
            Fixed amount
          </button>
          <button
            type="button"
            onClick={() => setMode('budget')}
            className={`flex-1 rounded-full py-2 text-sm font-bold ${
              mode === 'budget' ? 'bg-white text-violet600 shadow-card' : 'text-ink600'
            }`}
          >
            Monthly budget
          </button>
        </div>

        {mode === 'budget' ? (
          <form
            action={async (fd) => {
              await budgetAction(fd);
              close();
            }}
            className="grid gap-3"
          >
            <p className="text-sm text-ink600">
              Give {name.toLowerCase()} a monthly budget. As you log spending in this category, the
              forecast reserves only what&apos;s left.
            </p>
            <label className={label}>
              Monthly budget
              <input
                name="budget"
                inputMode="decimal"
                required
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className={field}
              />
            </label>
            <div className="rounded-input bg-violet100/60 px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-ink600">Spent this month</span>
                <span className="font-num font-semibold text-ink900">
                  {centsToDollars(spentThisMonthCents)}
                </span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-ink600">Left to spend</span>
                <span className="font-num font-bold text-violet600">{centsToDollars(leftCents)}</span>
              </div>
            </div>
            <Btn>Save budget</Btn>
          </form>
        ) : (
          <form
            action={async (fd) => {
              await (scope === 'week' ? weekAction(fd) : planAction(fd));
              close();
            }}
            className="grid gap-3"
          >
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="planning_mode" value="CUSTOM" />
            <input type="hidden" name="custom" value={amount} />

            <p className="text-sm text-ink600">Set a fixed amount for {name.toLowerCase()}.</p>
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
        )}

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
