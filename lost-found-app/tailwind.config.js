/** @type {import('tailwindcss').Config} */
// Keep these values in sync with constants/colors.ts (used for icons, tab bar, etc.)
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#4F46E5", // Indigo 600 - brand / "lost"
          dark: "#818CF8",
        },
        secondary: {
          DEFAULT: "#059669", // Emerald 600 - "found" / success
          dark: "#34D399",
        },
        accent: {
          DEFAULT: "#D97706", // Amber 600 - pending / rewards
          dark: "#FBBF24",
        },
        danger: {
          DEFAULT: "#E11D48", // Rose 600
          dark: "#FB7185",
        },
        background: {
          DEFAULT: "#F5F6FA",
          dark: "#0B1120", // Deep navy
        },
        surface: {
          DEFAULT: "#FFFFFF",
          dark: "#151C2F",
        },
        muted: {
          DEFAULT: "#F1F3F9", // Inputs, inset panels
          dark: "#1C2438",
        },
        line: {
          DEFAULT: "#E4E7F0", // Borders & dividers
          dark: "#263049",
        },
        text: {
          DEFAULT: "#0F172A",
          dark: "#E8ECF6",
        },
        textLight: {
          DEFAULT: "#64748B",
          dark: "#94A3B8",
        },
      },
    },
  },
  plugins: [],
};
