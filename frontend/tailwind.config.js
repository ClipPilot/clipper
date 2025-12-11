import { heroui } from "@heroui/react";

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
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
        surface: {
          dark: "#0a0a14",
          base: "#0f0f1a",
          elevated: "#16161f",
          hover: "#1a1a2e",
        },
        text: {
          primary: "#ffffff",
          secondary: "#a1a1aa",
          tertiary: "#71717a",
          muted: "#52525b",
          disabled: "#3f3f46",
          inverse: "#0a0a14",
        },
        border: {
          base: "#27272a",
          light: "#3f3f46",
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
    },
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        dark: {
          colors: {
            background: "#0a0a14",
            foreground: "#ffffff",
            primary: {
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
              foreground: "#ffffff",
            },
            focus: "#4F47E6",
            content1: "#0f0f1a",
            content2: "#16161f",
            content3: "#1a1a2e",
            content4: "#27272a",
            divider: "#27272a",
            default: {
              50: "#fafafa",
              100: "#f4f4f5",
              200: "#e4e4e7",
              300: "#d4d4d8",
              400: "#a1a1aa",
              500: "#71717a",
              600: "#52525b",
              700: "#3f3f46",
              800: "#27272a",
              900: "#18181b",
              DEFAULT: "#27272a",
              foreground: "#ffffff",
            },
          },
          layout: {
            borderWidth: {
              small: "1px",
              medium: "2px",
              large: "3px",
            },
          },
        },
        light: {
          extend: "light",
          colors: {
            primary: {
              DEFAULT: "#4F47E6",
              foreground: "#ffffff",
            },
          },
        },
      },
      layout: {
        fontSize: {
          tiny: "0.75rem",
          small: "0.875rem",
          medium: "1rem",
          large: "1.125rem",
        },
        radius: {
          small: "8px",
          medium: "12px",
          large: "14px",
        },
      },
    }),
  ],
};

export default config;
