import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Financial Brain',
    short_name: 'Financial Brain',
    description: 'What money is truly safe for you to spend.',
    start_url: '/home',
    display: 'standalone',
    background_color: '#F6F1E7',
    theme_color: '#20362B',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
