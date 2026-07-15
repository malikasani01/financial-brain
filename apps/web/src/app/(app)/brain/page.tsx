import { getSessionContext } from '@/lib/session';
import { AskBrainForm } from '@/components/AskBrainForm';
import { askBrain } from '@/app/actions/brain';
import { signOut } from '../actions';

export const dynamic = 'force-dynamic';

interface Msg {
  id: string;
  role: string;
  content: string;
}

export default async function BrainPage() {
  const { supabase, userId } = await getSessionContext();

  const { data: convo } = await supabase
    .from('chat_conversations')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let messages: Msg[] = [];
  if (convo?.id) {
    const { data } = await supabase
      .from('chat_messages')
      .select('id,role,content')
      .eq('conversation_id', convo.id)
      .order('created_at', { ascending: true });
    messages = (data ?? []) as Msg[];
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-md flex-col px-6 py-8">
      <h1 className="text-2xl font-semibold text-forest">Brain</h1>
      <p className="mt-1 text-sm text-muted">
        Ask about your money — grounded in your real numbers. I explain; the engine decides.
      </p>

      <div className="mt-6 flex-1 space-y-3">
        {messages.length === 0 ? (
          <p className="text-muted">
            Thinking about a decision? Ask me anything about what your money can safely do.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === 'user'
                  ? 'ml-8 rounded-2xl bg-forest px-4 py-3 text-cream'
                  : 'mr-8 whitespace-pre-wrap rounded-2xl bg-white px-4 py-3 text-ink shadow-card'
              }
            >
              {m.content}
            </div>
          ))
        )}
      </div>

      <div className="mt-6">
        <AskBrainForm action={askBrain} />
      </div>

      <form action={signOut} className="mt-6">
        <button className="text-xs text-muted underline underline-offset-4">Sign out</button>
      </form>
    </main>
  );
}
