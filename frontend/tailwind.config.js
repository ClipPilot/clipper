/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        checkPop: {
          "0%": { transform: "scale(0)", opacity: "0" },
          "50%": { transform: "scale(1.3)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        shimmer: "shimmer 2s infinite",
        "check-pop": "checkPop 0.4s ease-out",
      },
      colors: {
        // Custom colors for use alongside HeroUI theme
        midnight: {
          50: "#1a1a2e",
          100: "#16161f",
          200: "#0f0f1a",
          300: "#0a0a14",
          400: "#050510",
          500: "#00000a",
          600: "#000005",
          700: "#000003",
          800: "#000001",
          900: "#000000",
        },
        accent: {
          50: "#f0efff",
          100: "#e0deff",
          200: "#c7c4fe",
          300: "#a5a0fd",
          400: "#4F47E6",
          500: "#4038c2",
          600: "#342ca0",
          700: "#28217e",
          800: "#1d175f",
          900: "#130f40",
          DEFAULT: "#4F47E6",
        },
        // Theme-aware surface colors (use CSS variables)
        surface: {
          dark: "var(--surface-dark)",
          base: "var(--surface-base)",
          elevated: "var(--surface-elevated)",
          hover: "var(--surface-hover)",
        },
        // Theme-aware text colors (use CSS variables)
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
          muted: "var(--text-muted)",
          disabled: "var(--text-disabled)",
          inverse: "var(--text-inverse)",
        },
        // Theme-aware border colors (use CSS variables)
        border: {
          base: "var(--border-base)",
          light: "var(--border-light)",
          accent: "#4F47E633",
          focus: "#4F47E6",
        },
        status: {
          success: "#22c55e",
          warning: "#f59e0b",
          error: "#ef4444",
          info: "#3b82f6",
        },
      },
      backgroundColor: {
        background: "var(--background)",
      },
      textColor: {
        foreground: "var(--foreground)",
      },
    },
  },
  darkMode: "class",
}

module.exports = config;
