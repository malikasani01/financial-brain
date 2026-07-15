import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold text-forest">Not found</h1>
      <p className="mt-3 text-muted">That page doesn&apos;t exist.</p>
      <Link
        href="/home"
        className="mx-auto mt-6 rounded-2xl bg-forest px-6 py-3 font-medium text-cream"
      >
        Go home
      </Link>
    </main>
  );
}
