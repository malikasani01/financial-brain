'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold text-forest">Something didn&apos;t load</h1>
      <p className="mt-3 text-muted">
        I couldn&apos;t finish that just now. Your data is still safe. You can try again.
      </p>
      <button
        onClick={reset}
        className="mx-auto mt-6 rounded-2xl bg-forest px-6 py-3 font-medium text-cream"
      >
        Try again
      </button>
    </main>
  );
}
