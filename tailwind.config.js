/** @type {import('tailwindcss').Config} */
module.exports = { // <--- CHANGE THIS LINE
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'], // Add Inter font
      },
    },
  },
  plugins: [],
}