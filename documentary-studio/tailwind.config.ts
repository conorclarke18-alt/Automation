import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './remotion/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0a0a0b',
          800: '#111214',
          700: '#1a1b1f',
          600: '#25272d',
          500: '#3a3d45',
          400: '#6b6f78',
          300: '#a4a8b0',
        },
        accent: {
          DEFAULT: '#d4a84b',
          dim: '#8a6f30',
        },
        danger: '#e05b52',
        ok: '#4ca97b',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
