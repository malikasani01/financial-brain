// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CheckboxField, Field, PrimaryButton, SelectField } from './ui';

afterEach(cleanup);

describe('Field', () => {
  it('renders a labelled input with the given name and default value', () => {
    const { container } = render(<Field label="Amount" name="amount" defaultValue="9.99" />);
    expect(screen.getByText('Amount')).toBeTruthy();
    const input = container.querySelector('input[name="amount"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('9.99');
  });

  it('passes through type and required', () => {
    const { container } = render(<Field label="Date" name="due" type="date" required />);
    const input = container.querySelector('input[name="due"]') as HTMLInputElement;
    expect(input.type).toBe('date');
    expect(input.required).toBe(true);
  });
});

describe('SelectField', () => {
  it('renders every option and preselects the default', () => {
    render(
      <SelectField
        label="Frequency"
        name="frequency"
        defaultValue="MONTHLY"
        options={[
          { value: 'WEEKLY', label: 'Weekly' },
          { value: 'MONTHLY', label: 'Monthly' },
        ]}
      />,
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.name).toBe('frequency');
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(select.value).toBe('MONTHLY');
  });
});

describe('CheckboxField', () => {
  it('renders a checkbox honoring defaultChecked', () => {
    render(<CheckboxField label="Essential" name="is_essential" defaultChecked />);
    const box = screen.getByRole('checkbox') as HTMLInputElement;
    expect(box.name).toBe('is_essential');
    expect(box.checked).toBe(true);
    expect(screen.getByText('Essential')).toBeTruthy();
  });
});

describe('PrimaryButton', () => {
  it('renders a submit button with its children', () => {
    render(<PrimaryButton>Save</PrimaryButton>);
    const btn = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(btn.type).toBe('submit');
  });
});
