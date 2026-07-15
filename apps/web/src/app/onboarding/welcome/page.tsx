import Link from 'next/link';

export default function WelcomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <h1 className="text-3xl font-semibold text-forest">Let&apos;s get clear about your money.</h1>
      <p className="mt-3 text-muted">Not a budget. Not a lecture.</p>
      <p className="text-muted">Let&apos;s figure out what your money needs to do next.</p>

      <Link
        href="/onboarding/accounts"
        className="mt-8 inline-block rounded-2xl bg-forest px-6 py-4 text-center font-medium text-cream"
      >
        Build my financial picture
      </Link>
      <p className="mt-4 text-sm text-muted">
        Takes about 15 minutes. You can update anything later.
      </p>
    </main>
  );
}
