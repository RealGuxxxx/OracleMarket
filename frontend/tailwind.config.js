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
        zinc: {
          850: '#1f2126',
          900: '#18181b',
          950: '#09090b',
        },
        walrus: {
          50: '#fff5f2',
          100: '#ffebe6',
          200: '#ffd6cc',
          300: '#ffb09e',
          400: '#ff8066',
          500: '#fa4e29',
          600: '#e63612',
          700: '#c2280a',
          800: '#a1230b',
          900: '#85210e',
          950: '#470e04',
        },
        surface: {
          DEFAULT: '#111111',
          hover: '#1a1a1a',
          active: '#222222',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}

