/**
 * Turn a spoken/typed financial reminder into structured fields. This is a pure
 * parsing task — the model reads natural language and fills in a form; it does
 * NOT compute any money figure (that stays with the engine). Server-side only:
 * the ANTHROPIC_API_KEY never reaches the client.
 *
 * Model: claude-opus-4-8 (locked decision).
 */

import Anthropic from '@anthropic-ai/sdk';

/** The standard financial reminder categories (mirrors the web app's list). */
export const REMINDER_CATEGORY_VALUES = [
  'Subscription',
  'Insurance',
  'Bill',
  'Debt',
  'Legal',
  'Account',
  'Goal',
  'Business',
  'Follow-up',
  'Other',
] as const;

/** A real financial item the reminder might refer to. `ref` is "type:id". */
export interface ReminderCandidate {
  ref: string;
  name: string;
  type: string;
}

export interface ExtractedReminder {
  title: string;
  due_date: string | null;
  due_time: string | null;
  category: string | null;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  related_ref: string | null;
  notes: string | null;
}

export interface ExtractReminderArgs {
  text: string;
  candidates: ReminderCandidate[];
  today: string;
  timezone: string;
  apiKey: string;
  model?: string;
}

const SYSTEM = `You convert a person's spoken or typed FINANCIAL reminder into structured fields for a personal-finance app. These are money-protecting tasks: canceling subscriptions, calling about insurance, following up with a creditor or attorney, renewing a policy, reviewing a charge, updating a payment method.

Rules:
- Resolve relative dates ("tomorrow", "next Monday", "the 5th", "before it renews next week") to an absolute date using the provided current date and timezone. If no date is implied, leave due_date empty.
- Only set a due time if the person actually stated one.
- Choose the single best category from the allowed list, or leave empty if unclear.
- Set priority from urgency cues ("urgent", "overdue", "before I get charged" -> HIGH or URGENT); default NORMAL.
- Only set related_ref when the text clearly names one of the provided financial items; otherwise leave it empty. Never invent an item.
- title should be a short imperative like "Cancel Loom" or "Call to reactivate car insurance".
- Put any extra detail worth keeping in notes.`;

const TOOL: Anthropic.Tool = {
  name: 'save_reminder',
  description: 'Record the structured reminder extracted from the text.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short imperative task, e.g. "Cancel Loom".' },
      due_date: { type: 'string', description: 'Absolute date YYYY-MM-DD, or "" if none.' },
      due_time: { type: 'string', description: '24h time HH:MM, or "" if none stated.' },
      category: {
        type: 'string',
        description: `One of: ${REMINDER_CATEGORY_VALUES.join(', ')}; or "" if unclear.`,
      },
      priority: { type: 'string', enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] },
      related_ref: {
        type: 'string',
        description: 'The "type:id" ref of a provided item this refers to, or "" if none.',
      },
      notes: { type: 'string', description: 'Any extra detail, or "".' },
    },
    required: ['title', 'priority'],
  },
};

const clean = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length > 0 ? s : null;
};

export async function extractReminder({
  text,
  candidates,
  today,
  timezone,
  apiKey,
  model = 'claude-opus-4-8',
}: ExtractReminderArgs): Promise<ExtractedReminder> {
  const client = new Anthropic({ apiKey });

  const candidateBlock =
    candidates.length > 0
      ? `Financial items the reminder MAY reference (use the exact ref):\n${candidates
          .map((c) => `- ${c.ref} — ${c.name} (${c.type})`)
          .join('\n')}`
      : 'The user has no linkable financial items.';

  const res = await client.messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: 'save_reminder' },
    messages: [
      {
        role: 'user',
        content: `Current date: ${today} (timezone ${timezone}).\n${candidateBlock}\n\nReminder text:\n"""${text}"""`,
      },
    ],
  });

  const call = res.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'save_reminder',
  );
  const input = (call?.input ?? {}) as Record<string, unknown>;

  const priorityRaw = clean(input.priority) ?? 'NORMAL';
  const priority = (['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).includes(priorityRaw as never)
    ? (priorityRaw as ExtractedReminder['priority'])
    : 'NORMAL';

  const category = clean(input.category);
  const validCategory =
    category && (REMINDER_CATEGORY_VALUES as readonly string[]).includes(category) ? category : null;

  // Only keep a ref that matches a real candidate.
  const relatedRaw = clean(input.related_ref);
  const relatedRef = relatedRaw && candidates.some((c) => c.ref === relatedRaw) ? relatedRaw : null;

  return {
    title: clean(input.title) ?? text.trim().slice(0, 120),
    due_date: clean(input.due_date),
    due_time: clean(input.due_time),
    category: validCategory,
    priority,
    related_ref: relatedRef,
    notes: clean(input.notes),
  };
}
