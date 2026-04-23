/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#4F46E5", // Indigo 600
        secondary: "#10B981", // Emerald 500
        background: "#F3F4F6", // Gray 100
        surface: "#FFFFFF",
        text: "#1F2937", // Gray 800
        textLight: "#6B7280", // Gray 500
        error: "#EF4444", // Red 500
      }
    },
  },
  plugins: [],
}
