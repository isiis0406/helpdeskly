import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette (light theme defaults)
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1', // Indigo-500
          600: '#4f46e5', // Indigo-600 (brand)
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        accent: '#06b6d4', // cyan-500
        success: '#10b981', // emerald-500
        warning: '#f59e0b', // amber-500
        destructive: '#ef4444', // red-500
        // Surface tokens via CSS variables (see globals.css)
        bg: 'var(--background)',
        fg: 'var(--foreground)',
        card: 'var(--card)',
        muted: 'var(--muted)',
        border: 'var(--border)',
      },
    },
  },
  plugins: [],
} satisfies Config
