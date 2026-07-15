/** Ordered onboarding steps. The wizard renders one per slug. */
export interface OnboardingStep {
  slug: string;
  title: string;
  headline: string;
  supporting: string;
}

export const STEPS: OnboardingStep[] = [
  {
    slug: 'accounts',
    title: 'Where are you today?',
    headline: 'How much money can you access today?',
    supporting: 'Add the money you can access today. We are not calculating net worth.',
  },
  {
    slug: 'income',
    title: 'When does money come in?',
    headline: 'Add money you expect to receive.',
    supporting: 'Start with your paycheck.',
  },
  {
    slug: 'obligations',
    title: 'What must get paid?',
    headline: 'What needs money, even when things feel tight?',
    supporting: 'Start with anything that could create a serious problem if it is not paid.',
  },
  {
    slug: 'life-costs',
    title: 'What does normal life cost?',
    headline: 'The money you realistically need to live.',
    supporting: 'Bills are not the whole story. Add groceries, gas, and daily needs.',
  },
  {
    slug: 'subscriptions',
    title: 'What keeps charging you?',
    headline: 'Recurring commitments and potential pauses.',
    supporting: 'Include courses, apps, memberships, software, and recurring programs.',
  },
  {
    slug: 'goals',
    title: 'What are you building toward?',
    headline: 'Your money should protect today and build tomorrow.',
    supporting: 'Add a goal and I will show you what it needs from each paycheck.',
  },
  {
    slug: 'freedom',
    title: 'What does financial freedom mean to you?',
    headline: 'The income you would need to leave employment.',
    supporting: 'Keep it simple — just the big numbers for now.',
  },
];

export function stepIndex(slug: string): number {
  return STEPS.findIndex((s) => s.slug === slug);
}
