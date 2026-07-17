'use client';

import { useState } from 'react';

function toCents(v: string): number | null {
  const cleaned = v.replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  return Math.round(parseFloat(cleaned) * 100);
}
function usd(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Compare your bank's statement balance to the app's cleared balance. */
export function ReconcileForm({ clearedCents }: { clearedCents: number }) {
  const [value, setValue] = useState('');
  const statement = toCents(value);
  const diff = statement == null ? null : statement - clearedCents;

  return (
    <div className="rounded-card bg-white p-6 shadow-card">
      <p className="text-sm text-ink600">Cleared balance in Financial Brain</p>
      <p className="font-num text-2xl font-bold text-ink900">{usd(clearedCents)}</p>

      <label className="mt-4 block text-sm font-semibold text-ink600">
        Your bank statement balance
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="$0.00"
          className="mt-1 w-full rounded-input border border-line bg-white px-4 py-3 outline-none focus:border-violet500"
        />
      </label>

      {diff != null && (
        <div
          className={`mt-4 rounded-button px-4 py-3 text-sm ${
            diff === 0 ? 'bg-pos/10 text-pos' : 'bg-warn/15 text-[#9A6410]'
          }`}
        >
          {diff === 0 ? (
            'Matched — your cleared balance agrees with your bank.'
          ) : (
            <>
              Difference of <span className="font-num font-bold">{usd(diff)}</span>. That&apos;s
              likely a transaction that has cleared your bank but is still marked uncleared here (or
              one you haven&apos;t added). Mark it cleared, or add it, to match.
            </>
          )}
        </div>
      )}
    </div>
  );
}
