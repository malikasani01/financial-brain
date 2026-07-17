'use client';

import { useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { BottomSheet } from '@/components/BottomSheet';

interface Txn {
  id: string;
  name: string | null;
  amount_cents: number;
  direction: string;
  category: string | null;
  account_id: string | null;
  status: string;
  txn_date: string;
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
      {pending ? 'Saving…' : 'Save changes'}
    </button>
  );
}

/**
 * A ledger/transaction row that opens an edit sheet (amount, description,
 * date, cleared) on tap. `children` is the row content shown inline.
 */
export function EditTransaction({
  txn,
  accounts,
  editAction,
  deleteAction,
  children,
}: {
  txn: Txn;
  accounts: Account[];
  editAction: (fd: FormData) => Promise<void>;
  deleteAction: () => Promise<void>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [cleared, setCleared] = useState(txn.status === 'cleared');

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full text-left">
        {children}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Edit transaction">
        <form
          action={async (fd) => {
            await editAction(fd);
            setOpen(false);
          }}
          className="grid gap-3"
        >
          <input type="hidden" name="direction" value={txn.direction} />
          {txn.category && <input type="hidden" name="category" value={txn.category} />}
          <input type="hidden" name="status" value={cleared ? 'cleared' : 'uncleared'} />

          <label className={label}>
            Amount
            <input
              name="amount"
              inputMode="decimal"
              required
              defaultValue={(txn.amount_cents / 100).toString()}
              className={field}
            />
          </label>
          <label className={label}>
            Description
            <input name="name" defaultValue={txn.name ?? ''} className={field} />
          </label>
          {accounts.length > 1 ? (
            <label className={label}>
              Account
              <select name="account_id" defaultValue={txn.account_id ?? ''} className={field}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <input type="hidden" name="account_id" value={txn.account_id ?? ''} />
          )}
          <label className={label}>
            Date
            <input name="txn_date" type="date" defaultValue={txn.txn_date} className={field} />
          </label>

          <label className="flex items-center gap-3 py-1">
            <input
              type="checkbox"
              checked={cleared}
              onChange={(e) => setCleared(e.target.checked)}
              className="h-5 w-5 rounded border-line text-violet500"
            />
            <span className="text-sm text-ink900">Cleared the bank already</span>
          </label>

          <SaveBtn />
        </form>

        <form action={deleteAction} className="mt-3 text-center">
          <button className="text-sm font-bold text-neg">Delete transaction</button>
        </form>
      </BottomSheet>
    </>
  );
}
