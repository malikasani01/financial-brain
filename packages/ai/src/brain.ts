/**
 * The "AI EXPLAINS" call. Server-side only — the ANTHROPIC_API_KEY never
 * reaches the client. Receives already-computed engine outputs as context and
 * asks Claude to explain them in the product's voice.
 *
 * Model: claude-opus-4-8 for the Brain's reasoning-heavy answers (locked
 * decision). The engine has already done every calculation.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { BrainContext } from './context.js';
import { BRAIN_SYSTEM_PROMPT } from './prompt.js';

export interface BrainTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskBrainArgs {
  question: string;
  context: BrainContext;
  history?: BrainTurn[];
  apiKey: string;
  model?: string;
}

export interface BrainAnswer {
  text: string;
  /** The exact context sent to the model, for audit/persistence. */
  contextJson: BrainContext;
}

export async function askFinancialBrain({
  question,
  context,
  history = [],
  apiKey,
  model = 'claude-opus-4-8',
}: AskBrainArgs): Promise<BrainAnswer> {
  const client = new Anthropic({ apiKey });

  const contextBlock = `CONTEXT (authoritative, engine-computed — cite only these numbers):\n${JSON.stringify(
    context,
    null,
    2,
  )}`;

  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content }) as Anthropic.MessageParam),
    { role: 'user', content: `${contextBlock}\n\nQUESTION: ${question}` },
  ];

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: BRAIN_SYSTEM_PROMPT,
    messages,
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  return { text, contextJson: context };
}
