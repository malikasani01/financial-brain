'use client';

import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

const SUGGESTIONS = [
  'Can I afford dinner out tonight?',
  'Why is my Safe to Spend what it is?',
  'What should I pay first?',
  'What would need to change for me to leave my job?',
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-2xl bg-forest px-5 py-3 font-medium text-cream disabled:opacity-60"
    >
      {pending ? 'Thinking…' : 'Ask'}
    </button>
  );
}

export function AskBrainForm({ action }: { action: (fd: FormData) => Promise<void> }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState('');

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setValue(q)}
            className="rounded-full border border-sage/40 px-3 py-1.5 text-sm text-forest"
          >
            {q}
          </button>
        ))}
      </div>
      <form
        ref={formRef}
        action={async (fd) => {
          await action(fd);
          setValue('');
          formRef.current?.reset();
        }}
        className="flex items-end gap-2"
      >
        <textarea
          name="question"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask about your money…"
          rows={2}
          className="flex-1 resize-none rounded-2xl border border-sage/40 bg-white px-4 py-3 outline-none focus:border-forest"
        />
        <SubmitButton />
      </form>
    </div>
  );
}
