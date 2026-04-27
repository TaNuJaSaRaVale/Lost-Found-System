/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#6366F1", // Indigo 500
          dark: "#818CF8", // Indigo 400
        },
        secondary: {
          DEFAULT: "#10B981", // Emerald 500
          dark: "#34D399", // Emerald 400
        },
        accent: {
          DEFAULT: "#F59E0B", // Amber 500
          dark: "#FBBF24", // Amber 400
        },
        background: {
          DEFAULT: "#F9FAFB", // Gray 50
          dark: "#111827", // Gray 900
        },
        surface: {
          DEFAULT: "#FFFFFF",
          dark: "#1F2937", // Gray 800
        },
        text: {
          DEFAULT: "#111827",
          dark: "#F9FAFB",
        },
        textLight: {
          DEFAULT: "#6B7280",
          dark: "#9CA3AF",
        }
      }
    },
  },
  plugins: [],
}
