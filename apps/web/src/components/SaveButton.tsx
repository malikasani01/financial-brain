'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

/**
 * Submit button for a Server Action form that shows "Saving…" while pending
 * and a brief "Saved" confirmation right after — so a save that only changes
 * data the user can't see on this screen still gives visible feedback. Must
 * render inside the <form> it submits (useFormStatus reads the parent form).
 */
export function SaveButton({ label = 'Save changes' }: { label?: string }) {
  const { pending } = useFormStatus();
  const [justSaved, setJustSaved] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      setJustSaved(false);
      return;
    }
    // Only a real pending->idle transition counts as "just saved" — not the
    // initial mount, where pending starts false.
    if (!wasPending.current) return;
    wasPending.current = false;
    setJustSaved(true);
    const t = setTimeout(() => setJustSaved(false), 2500);
    return () => clearTimeout(t);
  }, [pending]);

  return (
    <div className="flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="rounded-2xl bg-forest px-5 py-3 font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? 'Saving…' : label}
      </button>
      {justSaved && <span className="text-sm text-forest">Saved</span>}
    </div>
  );
}
