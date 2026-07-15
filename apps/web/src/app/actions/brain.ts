'use server';

import { revalidatePath } from 'next/cache';
import { askFinancialBrain, buildBrainContext, type BrainTurn } from '@fb/ai';
import { buildEngineInput } from '@fb/data';
import { computeEngineOutput, FORECAST_HORIZON_DAYS } from '@fb/engine';
import { getSessionContext } from '@/lib/session';

const NO_KEY_MESSAGE =
  "I'm not connected to my AI yet. Add an ANTHROPIC_API_KEY to apps/web/.env.local and restart, and I'll be able to talk through your numbers.";

/** Ensure a single conversation exists for the user; return its id. */
async function ensureConversation(
  supabase: Awaited<ReturnType<typeof getSessionContext>>['supabase'],
  userId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('chat_conversations')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data, error } = await supabase
    .from('chat_conversations')
    .insert({ user_id: userId, title: 'Financial Brain' })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export async function askBrain(fd: FormData): Promise<void> {
  const question = String(fd.get('question') ?? '').trim();
  if (!question) return;

  const { supabase, userId, clock } = await getSessionContext();
  const conversationId = await ensureConversation(supabase, userId);

  // Persist the user's question first so it shows even if the AI call fails.
  await supabase
    .from('chat_messages')
    .insert({ user_id: userId, conversation_id: conversationId, role: 'user', content: question });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await supabase.from('chat_messages').insert({
      user_id: userId,
      conversation_id: conversationId,
      role: 'assistant',
      content: NO_KEY_MESSAGE,
    });
    revalidatePath('/brain');
    return;
  }

  // Prior turns for context (exclude the just-inserted question).
  const { data: priorRows } = await supabase
    .from('chat_messages')
    .select('role,content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(20);
  const history: BrainTurn[] = ((priorRows ?? []) as { role: string; content: string }[])
    .slice(0, -1)
    .map((r) => ({ role: r.role === 'assistant' ? 'assistant' : 'user', content: r.content }));

  const input = await buildEngineInput(supabase, userId, clock, FORECAST_HORIZON_DAYS);
  const context = buildBrainContext(input, computeEngineOutput(input));

  let answer: string;
  let contextJson: unknown;
  try {
    const result = await askFinancialBrain({ question, context, history, apiKey });
    answer = result.text || "I couldn't put together an answer just now. Try rephrasing?";
    contextJson = result.contextJson;
  } catch (err) {
    answer = `I hit an error reaching my AI: ${err instanceof Error ? err.message : 'unknown error'}.`;
    contextJson = null;
  }

  await supabase.from('chat_messages').insert({
    user_id: userId,
    conversation_id: conversationId,
    role: 'assistant',
    content: answer,
    context_json: contextJson,
  });
  revalidatePath('/brain');
}
