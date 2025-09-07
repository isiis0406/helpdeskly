import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette from design system
        jet: "#353535",
        caribbean: "#3c6e71",
        platinum: "#d9d9d9",
        indigoDye: "#284b63",
        // Semantic aliases (CSS variables in globals.css)
        primary: "#284b63",
        accent: "#3c6e71",
        success: "#10b981",
        warning: "#f59e0b",
        destructive: "#ef4444",
        // Surface tokens via CSS variables (see globals.css)
        bg: "var(--background)",
        fg: "var(--foreground)",
        card: "var(--card)",
        muted: "var(--muted)",
        border: "var(--border)",
      },
    },
  },
  plugins: [],
} satisfies Config;
