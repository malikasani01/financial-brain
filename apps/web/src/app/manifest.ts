import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Financial Brain',
    short_name: 'Financial Brain',
    description: 'What money is truly safe for you to spend.',
    start_url: '/home',
    scope: '/',
    orientation: 'portrait',
    categories: ['finance', 'productivity'],
    display: 'standalone',
    // Ink splash to match the icon tile; violet is the brand toolbar accent.
    background_color: '#14131A',
    theme_color: '#6C4CFF',
    icons: [
      // Scalable source for any browser that supports it.
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      // Raster fallbacks: 'any' keeps the full square; 'maskable' has safe-zone
      // padding so Android's adaptive mask never clips the mark.
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
