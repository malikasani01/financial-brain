'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker in production only. In dev it would fight
 * Next's hot-reload socket, so we skip it there.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
