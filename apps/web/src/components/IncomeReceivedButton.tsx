'use client';

import { useTransition } from 'react';
import { markIncomeAlreadyReceived } from '@/app/actions/manage';

/**
 * "I already have this paycheck in my balance." Advances the period's income
 * source(s) past this occurrence so the forecast stops projecting money that is
 * already in the bank (otherwise the paycheck is counted twice). No balance
 * change — the money is already there.
 */
export function IncomeReceivedButton({ sourceIds }: { sourceIds: string[] }) {
  const [pending, start] = useTransition();
  if (sourceIds.length === 0) return null;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          for (const id of sourceIds) await markIncomeAlreadyReceived(id);
        })
      }
      className="mt-1 text-xs font-bold text-violet600 underline underline-offset-2 disabled:opacity-50"
    >
      {pending ? 'Updating…' : 'Already received — don’t count again'}
    </button>
  );
}
