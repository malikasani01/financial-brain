'use client';

import { useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { BottomSheet } from '@/components/BottomSheet';

interface Account {
  id: string;
  name: string;
}

const field =
  'mt-1 w-full rounded-input border border-line bg-white px-4 py-3 outline-none focus:border-violet500';
const label = 'block text-sm font-semibold text-ink600';

function Btn({ children, tone = 'violet' }: { children: string; tone?: 'violet' | 'pos' }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full rounded-button px-5 py-4 text-center font-bold text-white disabled:opacity-60 ${
        tone === 'pos' ? 'bg-pos' : 'bg-violet500'
      }`}
    >
      {pending ? 'Working…' : children}
    </button>
  );
}

/**
 * A ledger bill/subscription row that opens a sheet to edit its amount and
 * date, or mark this occurrence paid (which advances the schedule so it isn't
 * double-counted). `children` is the row content shown inline.
 */
export function EditBill({
  name,
  amountCents,
  date,
  accounts,
  editAction,
  payAction,
  children,
}: {
  name: string;
  amountCents: number;
  date: string;
  accounts: Account[];
  editAction: (fd: FormData) => Promise<void>;
  payAction: (fd: FormData) => Promise<void>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const AccountField = () =>
    accounts.length > 1 ? (
      <label className={label}>
        Paid from
        <select name="account_id" defaultValue={accounts[0]?.id} className={field}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
    ) : (
      <input type="hidden" name="account_id" value={accounts[0]?.id ?? ''} />
    );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full text-left">
        {children}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={name}>
        <form
          action={async (fd) => {
            await editAction(fd);
            setOpen(false);
          }}
          className="grid gap-3"
        >
          <p className="text-sm text-ink600">Edit this bill</p>
          <label className={label}>
            Amount
            <input
              name="amount"
              inputMode="decimal"
              required
              defaultValue={(amountCents / 100).toString()}
              className={field}
            />
          </label>
          <label className={label}>
            Due date
            <input name="date" type="date" defaultValue={date} className={field} />
          </label>
          <Btn>Save changes</Btn>
        </form>

        <form
          action={async (fd) => {
            await payAction(fd);
            setOpen(false);
          }}
          className="mt-4 grid gap-3 border-t border-line pt-4"
        >
          <p className="text-sm text-ink600">
            Paid it already? Marking it cleared lowers your balance and moves this bill to its next
            occurrence.
          </p>
          <AccountField />
          <Btn tone="pos">Mark paid / cleared</Btn>
        </form>
      </BottomSheet>
    </>
  );
}
