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
        clinical: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        warmGray: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
        sage: {
          50: '#f4f7f5',
          100: '#e3ebe6',
          200: '#c7d6ce',
          300: '#a0bcaf',
          400: '#8ca59b',
          500: '#738d82',
          600: '#566e64',
          700: '#465a52',
          800: '#3a4a44',
          900: '#313e3a',
        },
        terracotta: {
          50: '#fdf7f6',
          100: '#faece9',
          200: '#f3d4ce',
          300: '#e9b3a9',
          400: '#e28b7b',
          500: '#d46c59',
          600: '#ba503e',
          700: '#9b4031',
          800: '#82382c',
          900: '#6d3127',
        },
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1', // Indigo
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e', // Emerald
          600: '#16a34a',
        },
        accent: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6', // Teal
          600: '#0d9488',
        }
      },
      fontFamily: {
        sans: ['Nunito', 'Outfit', 'Inter', 'sans-serif'],
        serif: ['Lora', 'serif'],
      },
      borderRadius: {
        'organic-1': '255px 15px 225px 15px/15px 225px 15px 255px',
        'organic-2': '15px 225px 15px 255px/255px 15px 225px 15px',
        'organic-3': '225px 15px 255px 15px/15px 255px 15px 225px',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
