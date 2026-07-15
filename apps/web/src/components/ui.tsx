import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-card bg-white p-6 shadow-card ${className}`}>{children}</section>
  );
}

export function Field({
  label,
  name,
  type = 'text',
  required = false,
  placeholder,
  defaultValue,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-muted">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        step={step}
        className="mt-1 w-full rounded-2xl border border-sage/40 bg-cream/40 px-4 py-3 outline-none focus:border-forest"
      />
    </label>
  );
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-muted">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-2xl border border-sage/40 bg-cream/40 px-4 py-3 outline-none focus:border-forest"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CheckboxField({
  label,
  name,
  defaultChecked = false,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-3">
      <input
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="h-5 w-5 rounded border-sage/50 text-forest"
      />
      <span className="text-sm text-ink">{label}</span>
    </label>
  );
}

export function PrimaryButton({
  children,
  type = 'submit',
}: {
  children: ReactNode;
  type?: 'submit' | 'button';
}) {
  return (
    <button
      type={type}
      className="rounded-2xl bg-forest px-5 py-3 font-medium text-cream transition hover:opacity-90"
    >
      {children}
    </button>
  );
}
