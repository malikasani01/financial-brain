'use client';

import { useEffect, type ReactNode } from 'react';

/** A mobile bottom sheet: scrim + slide-up panel. Controlled by the parent. */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-ink900/30" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-x-0 bottom-0 mx-auto max-h-[88vh] max-w-md overflow-y-auto rounded-t-card bg-paper p-6 pb-10 shadow-card"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" aria-hidden />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-ink900">{title}</h2>
          <button type="button" onClick={onClose} className="text-sm font-bold text-ink600">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
