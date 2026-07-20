'use client';

import { useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { BottomSheet } from '@/components/BottomSheet';

const field =
  'mt-1 w-full rounded-input border border-line bg-white px-4 py-3 outline-none focus:border-violet500';
const label = 'block text-sm font-semibold text-ink600';

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
 * sheet to adjust its planned amount up or down, or remove it entirely.
 * Adjusting sets a CUSTOM planning amount for the category, so the change flows
 * through the whole forecast. `children` is the row content shown inline.
 */
export function EditLifeCost({
  id,
  name,
  amountCents,
  saveAction,
  deleteAction,
  children,
}: {
  id: string;
  name: string;
  amountCents: number;
  saveAction: (fd: FormData) => Promise<void>;
  deleteAction: () => Promise<void>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full text-left">
        {children}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={name}>
        <form
          action={async (fd) => {
            await saveAction(fd);
            setOpen(false);
          }}
          className="grid gap-3"
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="planning_mode" value="CUSTOM" />
          <p className="text-sm text-ink600">
            This is a flexible cost — set what you actually plan to spend on {name.toLowerCase()}.
            It updates your forecast for this category.
          </p>
          <label className={label}>
            Planned amount
            <input
              name="custom"
              inputMode="decimal"
              required
              defaultValue={(amountCents / 100).toString()}
              className={field}
            />
          </label>
          <Btn>Save amount</Btn>
        </form>

        <form
          action={async () => {
            await deleteAction();
            setOpen(false);
          }}
          className="mt-4 grid gap-3 border-t border-line pt-4"
        >
          <p className="text-sm text-ink600">
            Don&apos;t want to track {name.toLowerCase()} here? Remove it — you can always add it
            back from Life costs.
          </p>
          <Btn tone="neg">Remove this cost</Btn>
        </form>
      </BottomSheet>
    </>
  );
}
