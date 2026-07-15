import type { Config } from 'tailwindcss';

/**
 * Design tokens from the PRD §4: warm, calm, non-corporate.
 * Warm cream background, deep forest green accent, soft sage, muted terracotta
 * for warnings. Large numbers, generous spacing, rounded cards.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F6F1E7',
        forest: '#20362B',
        sage: '#8FA99A',
        terracotta: '#C46A4E',
        ink: '#33322E',
        muted: '#6F6C64',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '1.5rem',
      },
      boxShadow: {
        card: '0 1px 3px rgba(32, 54, 43, 0.06), 0 8px 24px rgba(32, 54, 43, 0.05)',
      },
    },
  },
  plugins: [],
};

export default config;
