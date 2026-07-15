// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({ pathname: '/home' }));
vi.mock('next/navigation', () => ({ usePathname: () => h.pathname }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { BottomNav } from './BottomNav';

afterEach(cleanup);

describe('BottomNav', () => {
  it('renders all five destinations', () => {
    h.pathname = '/home';
    render(<BottomNav />);
    for (const label of ['Home', 'Plan', 'Ask', 'Goals', 'Brain']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('emphasizes Ask as the centered circular button', () => {
    h.pathname = '/home';
    render(<BottomNav />);
    const ask = screen.getByText('Ask').closest('a')!;
    expect(ask.getAttribute('href')).toBe('/ask');
    expect(ask.className).toContain('rounded-full');
  });

  it('marks the active destination based on the current path', () => {
    h.pathname = '/plan';
    render(<BottomNav />);
    const plan = screen.getByText('Plan').closest('a')!;
    const home = screen.getByText('Home').closest('a')!;
    expect(plan.className).toContain('font-semibold');
    expect(home.className).not.toContain('font-semibold');
  });
});
