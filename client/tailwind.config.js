/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        maroc: {
          red: "#C1272D",
          green: "#006233",
        },
      },
    },
  },
  plugins: [],
};
