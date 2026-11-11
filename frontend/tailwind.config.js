/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Pixelcake brand colors
        primary: {
          50: '#e6f2ff',
          100: '#cce5ff',
          200: '#99cbff',
          300: '#66b1ff',
          400: '#3397ff',
          500: '#007aff', // Main brand color
          600: '#0062cc',
          700: '#004999',
          800: '#003166',
          900: '#001933',
        },
        canvas: {
          light: '#ffffff',
          dark: '#252525',
        },
        page: {
          light: '#f4f7f6',
          dark: '#1a1a1a',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'device': '0 3px 6px rgba(0, 0, 0, 0.1)',
        'device-hover': '0 8px 20px rgba(0, 0, 0, 0.15)',
        'modal': '0 5px 20px rgba(0, 0, 0, 0.2)',
      },
    },
  },
  plugins: [],
}
