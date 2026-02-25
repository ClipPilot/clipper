const { heroui } = require("@heroui/theme");

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          400: "#4F47E6",
          500: "#4038c2",
          DEFAULT: "#4F47E6",
        },
        surface: {
          dark: "var(--surface-dark)",
          base: "var(--surface-base)",
          elevated: "var(--surface-elevated)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
        },
        border: {
          base: "var(--border-base)",
          light: "var(--border-light)",
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
};

module.exports = config;
