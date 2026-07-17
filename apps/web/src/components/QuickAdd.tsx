'use client';

import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';

interface Account {
  id: string;
  name: string;
}

type Kind = 'expense' | 'income' | 'transfer' | 'balance';

const CATEGORIES = [
  'Housing',
  'Auto & Transport',
  'Bills & Utilities',
  'Groceries',
  'Dining Out',
  'Health',
  'Personal',
  'Business',
  'Other',
];

const field =
  'mt-1 w-full rounded-input border border-line bg-white px-4 py-3 outline-none focus:border-violet500';
const label = 'block text-sm font-semibold text-ink600';

function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 rounded-button bg-violet500 px-5 py-3 font-bold text-white disabled:opacity-60"
    >
      {pending ? 'Saving…' : children}
    </button>
  );
}

export function QuickAdd({
  addTransaction,
  setAccountBalance,
  accounts,
  today,
}: {
  addTransaction: (fd: FormData) => Promise<void>;
  setAccountBalance: (fd: FormData) => Promise<void>;
  accounts: Account[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('expense');
  const [cleared, setCleared] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);

  const close = () => setOpen(false);
  const submit = (action: (fd: FormData) => Promise<void>) => async (fd: FormData) => {
    await action(fd);
    formRef.current?.reset();
    setOpen(false);
  };

  const TABS: { k: Kind; label: string }[] = [
    { k: 'expense', label: 'Expense' },
    { k: 'income', label: 'Income' },
    { k: 'transfer', label: 'Transfer' },
    { k: 'balance', label: 'Balance' },
  ];

  const AccountSelect = ({ name, label: l }: { name: string; label: string }) => (
    <label className={label}>
      {l}
      <select name={name} defaultValue={accounts[0]?.id} className={field}>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <div className="fixed inset-x-0 bottom-24 z-30 mx-auto max-w-md px-6">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Quick add"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-violet500 text-white shadow-card"
          >
            <Icon name="plus" size={26} />
          </button>
        </div>
      </div>

      <BottomSheet open={open} onClose={close} title="Add">
        <div className="mb-4 flex gap-1 rounded-full bg-line/60 p-1">
          {TABS.map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setKind(t.k)}
              className={`flex-1 rounded-full py-2 text-sm font-bold ${
                kind === t.k ? 'bg-white text-violet600 shadow-card' : 'text-ink600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {kind === 'balance' ? (
          <form ref={formRef} action={submit(setAccountBalance)} className="grid gap-3">
            <AccountSelect name="account_id" label="Account" />
            <label className={label}>
              New balance
              <input name="balance" inputMode="decimal" required placeholder="$0.00" className={field} />
            </label>
            <SubmitButton>Update balance</SubmitButton>
          </form>
        ) : (
          <form ref={formRef} action={submit(addTransaction)} className="grid gap-3">
            <input type="hidden" name="direction" value={kind} />
            <input type="hidden" name="status" value={cleared ? 'cleared' : 'uncleared'} />

            <label className={label}>
              Amount
              <input name="amount" inputMode="decimal" required autoFocus placeholder="$0.00" className={field} />
            </label>

            {kind !== 'transfer' && (
              <label className={label}>
                {kind === 'income' ? 'Source' : 'What was it?'}
                <input
                  name="name"
                  placeholder={kind === 'income' ? 'Paycheck, refund…' : 'Coffee, gas, groceries…'}
                  className={field}
                />
              </label>
            )}

            {kind === 'expense' && (
              <label className={label}>
                Category
                <select name="category" defaultValue="Other" className={field}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {kind === 'transfer' ? (
              <>
                <AccountSelect name="account_id" label="From account" />
                <AccountSelect name="transfer_account_id" label="To account" />
              </>
            ) : (
              accounts.length > 1 && <AccountSelect name="account_id" label={kind === 'income' ? 'Into account' : 'Paid from'} />
            )}
            {kind !== 'transfer' && accounts.length === 1 && (
              <input type="hidden" name="account_id" value={accounts[0]!.id} />
            )}

            <label className={label}>
              Date
              <input name="txn_date" type="date" defaultValue={today} className={field} />
            </label>

            <label className="flex items-center gap-3 py-1">
              <input
                type="checkbox"
                checked={cleared}
                onChange={(e) => setCleared(e.target.checked)}
                className="h-5 w-5 rounded border-line text-violet500"
              />
              <span className="text-sm text-ink900">Already cleared my account</span>
            </label>

            <SubmitButton>Add {kind}</SubmitButton>
          </form>
        )}

        <div className="mt-6 border-t border-line pt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink600">Set up recurring</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/obligations" onClick={close} className="rounded-full border border-line px-3 py-1.5 text-sm font-bold text-violet600">
              Add a bill
            </Link>
            <Link href="/subscriptions" onClick={close} className="rounded-full border border-line px-3 py-1.5 text-sm font-bold text-violet600">
              Add a subscription
            </Link>
            <Link href="/income" onClick={close} className="rounded-full border border-line px-3 py-1.5 text-sm font-bold text-violet600">
              Add income source
            </Link>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
