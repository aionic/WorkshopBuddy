import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b1220",
          900: "#0f172a",
          800: "#111c34",
          700: "#1e293b"
        },
        accent: {
          DEFAULT: "#22d3ee",
          600: "#0891b2",
          500: "#06b6d4"
        }
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"]
      },
      boxShadow: {
        card: "0 10px 30px -10px rgba(2, 6, 23, 0.35)"
      }
    }
  },
  plugins: []
};
export default config;
