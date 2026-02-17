/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#4F47E6",
          light: "#6C63FF",
          dark: "#3D36B9",
        },
        midnight: {
          50: "#1a1a2e",
          100: "#16161f",
          200: "#0f0f1a",
          300: "#0a0a14",
          400: "#050510",
        },
        status: {
          operational: "#22c55e",
          degraded: "#f59e0b",
          outage: "#ef4444",
          maintenance: "#3b82f6",
        },
      },
    },
  },
  darkMode: "class",
};

module.exports = config;
