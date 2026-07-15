import { signOut } from '../actions';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function BrainPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-2xl font-semibold text-forest">Brain</h1>
      <Card className="mt-6">
        <p className="text-muted">
          Ask about your money — grounded in your actual numbers. The conversational Financial Brain
          arrives in Phase 4, wired to the same deterministic engine (it explains; it never
          calculates).
        </p>
      </Card>

      <form action={signOut} className="mt-10">
        <button className="text-sm text-forest underline underline-offset-4">Sign out</button>
      </form>
    </main>
  );
}
