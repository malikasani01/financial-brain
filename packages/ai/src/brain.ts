/**
 * The "AI EXPLAINS" call. Server-side only — the ANTHROPIC_API_KEY never
 * reaches the client. Runs a tool-use loop: the model may call engine-backed
 * tools for any money figure, then explains the results in the product's voice.
 * The engine has already done (and re-does on demand) every calculation.
 *
 * Model: claude-opus-4-8 (locked decision).
 */

import Anthropic from '@anthropic-ai/sdk';
import type { EngineInput } from '@fb/types';
import type { BrainContext } from './context.js';
import { BRAIN_SYSTEM_PROMPT } from './prompt.js';
import { BRAIN_TOOLS, runBrainTool } from './tools.js';

export interface BrainTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskBrainArgs {
  question: string;
  context: BrainContext;
  /** Live engine input so tools can compute exact figures on demand. */
  input: EngineInput;
  history?: BrainTurn[];
  apiKey: string;
  model?: string;
}

export interface BrainAnswer {
  text: string;
  contextJson: BrainContext;
  /** Names of engine tools the model invoked (audit trail). */
  toolCalls: string[];
}

const MAX_TURNS = 6;

export async function askFinancialBrain({
  question,
  context,
  input,
  history = [],
  apiKey,
  model = 'claude-opus-4-8',
}: AskBrainArgs): Promise<BrainAnswer> {
  const client = new Anthropic({ apiKey });

  const contextBlock = `CONTEXT (authoritative, engine-computed — cite only these numbers or tool results):\n${JSON.stringify(
    context,
    null,
    2,
  )}`;

  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content }) as Anthropic.MessageParam),
    { role: 'user', content: `${contextBlock}\n\nQUESTION: ${question}` },
  ];

  const toolCalls: string[] = [];
  let text = '';

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await client.messages.create({
      model,
      max_tokens: 2048,
      system: BRAIN_SYSTEM_PROMPT,
      tools: BRAIN_TOOLS,
      messages,
    });

    if (res.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: res.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type === 'tool_use') {
          toolCalls.push(block.name);
          const out = runBrainTool(block.name, block.input, input);
          results.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: out.text,
            is_error: out.isError,
          });
        }
      }
      messages.push({ role: 'user', content: results });
      continue;
    }

    text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    break;
  }

  return { text, contextJson: context, toolCalls };
}
