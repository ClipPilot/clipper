import {heroui} from "@heroui/theme"

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          dark: "var(--surface-dark)",
          DEFAULT: "var(--surface)",
          elevated: "var(--surface-elevated)",
          hover: "var(--surface-hover)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
          muted: "var(--text-muted)",
        },
        border: {
          DEFAULT: "var(--border)",
          light: "var(--border-light)",
        },
        emerald: {
          DEFAULT: "var(--emerald)",
          dark: "var(--emerald-dark)",
          light: "var(--emerald-light)",
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
  plugins: [heroui()],
}

module.exports = config;
