import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: "#8D5CA2",
          purpleDark: "#513061",
          copper: "#BB8D71",
          ink: "#18181B",
          muted: "#6B7280",
          line: "#E5E7EB",
          paper: "#FAFAFA",
        },
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        hairline: "0 1px 0 rgba(24, 24, 27, 0.08)",
      },
    },
  },
  plugins: [typography],
};

export default config;
