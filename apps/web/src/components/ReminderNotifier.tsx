'use client';

import { useEffect, useState } from 'react';

export interface DueReminder {
  id: string;
  title: string;
  /** The due date this notification is for, so re-notifying is deduped per day. */
  dueKey: string;
  overdue: boolean;
}

/**
 * Foreground reminder notifications. While the app is open and the user has
 * granted permission, this fires a browser notification once per due/overdue
 * reminder per day (deduped via sessionStorage). If permission hasn't been
 * decided yet, it shows a small opt-in button. It never blocks anything — the
 * list, Home card and badges work regardless of notification support.
 *
 * Background/closed-app alerts are intentionally out of scope (they need a push
 * server; see the feature notes), so this only runs while a tab is open.
 */
export function ReminderNotifier({ due }: { due: DueReminder[] }) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (permission !== 'granted' || due.length === 0) return;
    for (const r of due) {
      const key = `fb-reminder-notified:${r.id}:${r.dueKey}`;
      if (sessionStorage.getItem(key)) continue;
      try {
        new Notification(r.overdue ? 'Overdue financial reminder' : 'Financial reminder due today', {
          body: r.title,
          tag: `reminder-${r.id}`,
        });
        sessionStorage.setItem(key, '1');
      } catch {
        // Some browsers only allow notifications from a service worker; ignore.
      }
    }
  }, [permission, due]);

  if (permission !== 'default' || due.length === 0) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          setPermission(await Notification.requestPermission());
        } catch {
          setPermission('denied');
        }
      }}
      className="mt-3 w-full rounded-input border border-violet500/40 bg-violet100/50 px-4 py-2.5 text-sm font-bold text-violet600"
    >
      🔔 Turn on reminder alerts (while the app is open)
    </button>
  );
}
