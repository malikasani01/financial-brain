import type { Metadata, Viewport } from 'next';
import { Nunito, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';

// Nunito for all UI text; Space Grotesk for money/data numerals. Self-hosted by
// next/font at build time, so the installed PWA loads them from our own origin.
const nunito = Nunito({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-num',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Financial Brain',
  description: 'What money is truly safe for you to spend.',
  // iOS home-screen icon (Safari ignores SVG here, so point at the PNG).
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  // Launch as a standalone app on iOS with a calm, branded status bar.
  appleWebApp: {
    capable: true,
    title: 'Financial Brain',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#FAF9F6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          attributes into <body> before hydration; this silences that false alarm. */}
      <body className="min-h-screen font-sans" suppressHydrationWarning>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
