import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

// Channel-only vars so opacity modifiers (bg-primary/10) actually work.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: token("background"),
        foreground: token("foreground"),
        surface: token("surface"),
        muted: token("muted"),
        "muted-foreground": token("muted-foreground"),
        border: token("border"),
        primary: token("primary"),
        "primary-foreground": token("primary-foreground"),
        positive: token("positive"),
        negative: token("negative"),
        warning: token("warning"),
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", ...fontFamily.sans],
        mono: ["var(--font-geist-mono)", ...fontFamily.mono],
      },
      keyframes: {
        enter: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        enter: "enter 240ms cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
} satisfies Config;
