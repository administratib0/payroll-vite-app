/** @type {import('tailwindcss').Config} */
export default { // Make sure it's 'export default' for Vite
  content: [
    "./index.html", // <--- IMPORTANT for Vite to scan your public HTML
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