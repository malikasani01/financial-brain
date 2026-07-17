'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { BottomSheet } from '@/components/BottomSheet';

interface GoalOption {
  id: string;
  name: string;
  remainingCents: number;
}
interface Account {
  id: string;
  name: string;
}

const field =
  'mt-1 w-full rounded-input border border-line bg-white px-4 py-3 outline-none focus:border-violet500';
const label = 'block text-sm font-semibold text-ink600';

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-button bg-violet500 px-5 py-4 text-center font-bold text-white disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Log this saving'}
    </button>
  );
}

/**
 * "I saved this" — record money actually moved to a goal. Counts toward the
 * goal and lowers the next recommendation. Prefills the suggested goal/amount.
 */
export function LogSaving({
  goals,
  accounts,
  suggestedGoalId,
  suggestedAmountCents,
  action,
}: {
  goals: GoalOption[];
  accounts: Account[];
  suggestedGoalId: string | null;
  suggestedAmountCents: number;
  action: (fd: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  if (goals.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 rounded-full border border-violet300 px-3 py-1.5 text-sm font-bold text-violet600"
      >
        I saved this →
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Log a saving">
        <p className="mb-3 text-sm text-ink600">
          Record money you actually moved to savings. It counts toward the goal and lowers what&apos;s
          suggested next.
        </p>
        <form
          action={async (fd) => {
            await action(fd);
            setOpen(false);
          }}
          className="grid gap-3"
        >
          <label className={label}>
            Goal
            <select name="goal_id" defaultValue={suggestedGoalId ?? goals[0]?.id} className={field}>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} — {(g.remainingCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} to go
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Amount saved
            <input
              name="amount"
              inputMode="decimal"
              required
              defaultValue={suggestedAmountCents > 0 ? (suggestedAmountCents / 100).toString() : ''}
              placeholder="$0.00"
              className={field}
            />
          </label>
          {accounts.length > 1 ? (
            <label className={label}>
              From account
              <select name="account_id" defaultValue={accounts[0]?.id} className={field}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            accounts[0] && <input type="hidden" name="account_id" value={accounts[0].id} />
          )}
          <SaveBtn />
        </form>
      </BottomSheet>
    </>
  );
}
