import Link from 'next/link';
import { Icon } from '@/components/Icon';

export const dynamic = 'force-dynamic';

export default function InsightsPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-card bg-violet100 text-violet600">
        <Icon name="chart" size={32} />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold text-ink900">Insights</h1>
      <p className="mt-2 text-ink600">
        Spending by category, weekly and monthly reviews, and how you&apos;re trending — grounded in
        your real transactions. Coming soon.
      </p>
      <Link
        href="/more"
        className="mt-6 rounded-button bg-violet500 px-6 py-3 font-bold text-white"
      >
        Back to More
      </Link>
    </main>
  );
}
