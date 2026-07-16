'use client';

import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

interface AccountOption {
  id: string;
  name: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-2xl bg-forest px-5 py-3 font-medium text-cream disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Add expense'}
    </button>
  );
}

/**
 * Floating "+" button on Home for logging a day-to-day expense as it happens.
 * Submitting lowers the chosen account's balance (server action), which flows
 * straight into Safe to Spend. The panel closes itself once the action
 * resolves.
 */
export function QuickAddExpense({
  action,
  accounts,
  today,
}: {
  action: (fd: FormData) => Promise<void>;
  accounts: AccountOption[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-20 bg-ink/20" onClick={() => setOpen(false)} aria-hidden />
      )}

      <div className="fixed inset-x-0 bottom-24 z-30 mx-auto max-w-md px-6">
        {open && (
          <div className="mb-3 rounded-card bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <p className="font-medium text-forest">Add an expense</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-muted"
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">
              Something you just spent. It comes straight out of your available cash.
            </p>
            <form
              ref={formRef}
              action={async (fd) => {
                await action(fd);
                formRef.current?.reset();
                setOpen(false);
              }}
              className="mt-4 grid gap-3"
            >
              <label className="block">
                <span className="text-sm text-muted">Amount</span>
                <input
                  name="amount"
                  inputMode="decimal"
                  required
                  placeholder="$0.00"
                  autoFocus
                  className="mt-1 w-full rounded-2xl border border-sage/40 bg-cream/40 px-4 py-3 outline-none focus:border-forest"
                />
              </label>
              <label className="block">
                <span className="text-sm text-muted">What was it? (optional)</span>
                <input
                  name="description"
                  placeholder="Coffee, gas, groceries…"
                  className="mt-1 w-full rounded-2xl border border-sage/40 bg-cream/40 px-4 py-3 outline-none focus:border-forest"
                />
              </label>
              {accounts.length > 1 && (
                <label className="block">
                  <span className="text-sm text-muted">Paid from</span>
                  <select
                    name="account_id"
                    defaultValue={accounts[0]?.id}
                    className="mt-1 w-full rounded-2xl border border-sage/40 bg-cream/40 px-4 py-3 outline-none focus:border-forest"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {accounts.length === 1 && (
                <input type="hidden" name="account_id" value={accounts[0]!.id} />
              )}
              <label className="block">
                <span className="text-sm text-muted">Date</span>
                <input
                  name="spent_date"
                  type="date"
                  defaultValue={today}
                  className="mt-1 w-full rounded-2xl border border-sage/40 bg-cream/40 px-4 py-3 outline-none focus:border-forest"
                />
              </label>
              <SubmitButton />
            </form>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Add an expense"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-forest text-3xl leading-none text-cream shadow-card"
          >
            {open ? '×' : '+'}
          </button>
        </div>
      </div>
    </>
  );
}
