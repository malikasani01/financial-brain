import { createSupabaseServerClient } from '@/lib/supabase/server';
import { signOut } from '../actions';

// Auth-gated; always rendered per-request.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <p className="text-muted">Good day{user?.email ? `, ${user.email}` : ''}.</p>

      <section className="mt-6 rounded-card bg-white p-8 shadow-card">
        <p className="text-sm uppercase tracking-wide text-muted">Safe to spend</p>
        <p className="mt-2 text-5xl font-semibold text-forest">—</p>
        <p className="mt-4 text-sm text-muted">
          The financial engine lands in Phase 1. This shell confirms auth, styling, and data access
          are wired correctly.
        </p>
      </section>

      <form action={signOut} className="mt-8">
        <button className="text-sm text-forest underline underline-offset-4">Sign out</button>
      </form>
    </main>
  );
}
