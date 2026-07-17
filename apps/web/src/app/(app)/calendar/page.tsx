import Link from 'next/link';
import { Icon } from '@/components/Icon';

export const dynamic = 'force-dynamic';

export default function CalendarPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-card bg-violet100 text-violet600">
        <Icon name="calendar" size={32} />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold text-ink900">Calendar</h1>
      <p className="mt-2 text-ink600">
        See what happens to your money on any day — projected balance, bills due, and income, right
        on a calendar. Coming next.
      </p>
      <Link
        href="/plan"
        className="mt-6 rounded-button bg-violet500 px-6 py-3 font-bold text-white"
      >
        See your paycheck plan
      </Link>
    </main>
  );
}
