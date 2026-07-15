// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AskBrainForm } from './AskBrainForm';

afterEach(cleanup);

describe('AskBrainForm', () => {
  it('renders the input and the Ask button', () => {
    render(<AskBrainForm action={vi.fn()} />);
    expect(screen.getByPlaceholderText('Ask about your money…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ask' })).toBeTruthy();
  });

  it('offers suggested questions', () => {
    render(<AskBrainForm action={vi.fn()} />);
    expect(screen.getByText('Why is my Safe to Spend what it is?')).toBeTruthy();
    expect(screen.getByText('Can I afford dinner out tonight?')).toBeTruthy();
  });

  it('fills the textarea when a suggestion is clicked', () => {
    render(<AskBrainForm action={vi.fn()} />);
    const textarea = screen.getByPlaceholderText('Ask about your money…') as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
    fireEvent.click(screen.getByText('What should I pay first?'));
    expect(textarea.value).toBe('What should I pay first?');
  });
});
