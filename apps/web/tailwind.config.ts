import type { Config } from 'tailwindcss';

/**
 * Financial Brain brand tokens (Brand Book).
 *
 * Violet is the primary brand accent. Green/red/amber/blue are RESERVED for
 * money meaning only (positive, negative, due-soon, information) — never
 * decoration or navigation.
 *
 * The legacy palette names (cream/forest/sage/terracotta/ink/muted) are kept
 * as aliases mapped onto the nearest brand value, so the existing ~25 screens
 * adopt the new look immediately while later phases migrate each screen to the
 * semantic tokens below and retire the aliases.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ---- Brand (canonical) ----
        paper: '#FAF9F6',
        ink900: '#14131A',
        ink600: '#5B5868',
        line: '#E7E4DE',
        violet: {
          100: '#EEE9FF',
          300: '#C9BFFF',
          500: '#6C4CFF',
          600: '#5636E0',
          DEFAULT: '#6C4CFF',
        },
        // Money meaning ONLY.
        pos: '#1FAE6B',
        neg: '#E4523F',
        warn: '#F0A93B',
        info: '#2E6BFF',

        // ---- Legacy aliases (temporary — remapped to brand) ----
        cream: '#FAF9F6', // → paper
        ink: '#14131A', // → ink900
        muted: '#5B5868', // → ink600
        sage: '#E7E4DE', // → line (mostly borders)
        forest: '#6C4CFF', // → violet (primary chrome/accent)
        terracotta: '#E4523F', // → neg
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        num: ['var(--font-num)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        input: '10px',
        button: '18px',
        card: '26px',
      },
      boxShadow: {
        // Minimal, warm — no dramatic elevation.
        card: '0 1px 2px rgba(20, 19, 26, 0.04), 0 8px 24px rgba(20, 19, 26, 0.05)',
      },
    },
  },
  plugins: [],
};

export default config;
