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
        // PixelCake brand colors
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
        sans: ['"Inter Variable"', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      // Corners are barely rounded, as in the style sheet (--radius, --radius-small)
      borderRadius: {
        sm: '2px',
        DEFAULT: '3px',
        md: '4px',
        lg: '4px',
        xl: '6px',
        '2xl': '6px',
      },
      // Only what floats over the page keeps a shadow
      boxShadow: {
        'device': 'none',
        'device-hover': 'none',
        'modal': '0 16px 48px rgba(0, 0, 0, 0.18)',
      },
    },
  },
  plugins: [],
}
