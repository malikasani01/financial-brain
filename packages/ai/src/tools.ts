/**
 * Engine-backed tools for the Financial Brain. Each tool's handler runs a
 * deterministic engine function and returns dollar-formatted results. The AI
 * calls these instead of doing arithmetic — CODE DECIDES, AI EXPLAINS, enforced
 * structurally: the model can only obtain money figures by calling a tool.
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { DecisionType, EngineInput, Purpose } from '@fb/types';
import { allocateAvailableCash, maxAffordable, simulatePurchaseDecision } from '@fb/engine';
import { dollarsToCents, usd } from './money.js';

export const BRAIN_TOOLS: Anthropic.Tool[] = [
  {
    name: 'check_purchase',
    description:
      'Evaluate whether a specific purchase or commitment is affordable right now. Call this whenever the user asks if they can afford a specific amount, or names a purchase with a price.',
    input_schema: {
      type: 'object',
      properties: {
        amount_dollars: { type: 'number', description: 'The price in dollars' },
        recurring: { type: 'boolean', description: 'True for a subscription/ongoing payment' },
        purpose: {
          type: 'string',
          enum: ['ESSENTIAL', 'FAMILY', 'BUSINESS', 'PERSONAL_GROWTH', 'HEALTH', 'FUN', 'OTHER'],
        },
      },
      required: ['amount_dollars'],
    },
  },
  {
    name: 'max_affordable',
    description:
      'Find the largest amount that is safe to spend for a category. Call this when the user asks "how much can I afford for X".',
    input_schema: {
      type: 'object',
      properties: {
        recurring: { type: 'boolean', description: 'True for an ongoing/monthly amount' },
        category: { type: 'string', description: "e.g. 'Business', 'Insurance', 'Other'" },
      },
      required: [],
    },
  },
  {
    name: 'allocate_money',
    description:
      'Given a lump sum the user has available, produce a recommended allocation across their obligations and buffer. Call this for "what should I do with $X" or "what should I pay".',
    input_schema: {
      type: 'object',
      properties: { amount_dollars: { type: 'number', description: 'The available amount in dollars' } },
      required: ['amount_dollars'],
    },
  },
];

/** Execute a Brain tool by name against the engine. Returns a text result for the model. */
export function runBrainTool(
  name: string,
  rawInput: unknown,
  input: EngineInput,
): { text: string; isError: boolean } {
  const args = (rawInput ?? {}) as Record<string, unknown>;
  try {
    switch (name) {
      case 'check_purchase': {
        const amountCents = dollarsToCents(Number(args.amount_dollars) || 0);
        const type: DecisionType = args.recurring === true ? 'SUBSCRIPTION' : 'ONE_TIME';
        const purpose = (typeof args.purpose === 'string' ? args.purpose : 'OTHER') as Purpose;
        const r = simulatePurchaseDecision(
          {
            name: 'this purchase',
            amountCents,
            type,
            purpose,
            ...(type === 'SUBSCRIPTION' ? { monthlyPaymentCents: amountCents } : {}),
          },
          input,
        );
        return {
          isError: false,
          text: JSON.stringify({
            decision: r.state,
            purchase: usd(amountCents),
            safeToSpendBefore: usd(r.safeToSpendBeforeCents),
            safeToSpendAfter: usd(r.safeToSpendAfterCents),
            lowestCashAfter: usd(r.lowestCashAfterCents),
            dailyFlexibilityAfter: r.dailyFlexAfterCents != null ? usd(r.dailyFlexAfterCents) : null,
            reasons: r.reasons,
          }),
        };
      }
      case 'max_affordable': {
        const kind = args.recurring === true ? 'RECURRING' : 'ONE_TIME';
        const category = typeof args.category === 'string' ? args.category : 'Other';
        const cents = maxAffordable(kind, category, input);
        return {
          isError: false,
          text: JSON.stringify({
            kind,
            category,
            maxAffordable: usd(cents),
            note: kind === 'RECURRING' ? 'per month' : 'one-time',
          }),
        };
      }
      case 'allocate_money': {
        const cents = dollarsToCents(Number(args.amount_dollars) || 0);
        const r = allocateAvailableCash(cents, input);
        return {
          isError: false,
          text: JSON.stringify({
            available: usd(cents),
            lines: r.lines.map((l) => ({ label: l.label, amount: usd(l.amountCents), reason: l.reason })),
            protectedAsCash: usd(r.protectedAsBufferCents),
          }),
        };
      }
      default:
        return { isError: true, text: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { isError: true, text: `Tool error: ${err instanceof Error ? err.message : 'unknown'}` };
  }
}
