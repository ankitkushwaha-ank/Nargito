import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "rgb(var(--c-primary) / <alpha-value>)", hover: "rgb(var(--c-primary-hover) / <alpha-value>)", tint: "rgb(var(--c-tint) / <alpha-value>)" },
        bg: "rgb(var(--c-bg) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        ink: "rgb(var(--c-text) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        line: "rgb(var(--c-border) / <alpha-value>)",
        success: "rgb(var(--c-success) / <alpha-value>)",
        warn: "rgb(var(--c-warn) / <alpha-value>)",
        danger: "rgb(var(--c-danger) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "var(--font-deva)", "system-ui", "sans-serif"],
      },
      borderRadius: { card: "var(--radius)" },
      maxWidth: { shell: "1360px" },
    },
  },
  plugins: [],
};
export default config;
