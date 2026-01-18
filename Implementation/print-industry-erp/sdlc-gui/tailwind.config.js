/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // SDLC Phase colors
        'phase-backlog': '#6b7280',
        'phase-design': '#3b82f6',
        'phase-dev': '#8b5cf6',
        'phase-review': '#f59e0b',
        'phase-test': '#10b981',
        'phase-deploy': '#06b6d4',
        'phase-done': '#22c55e',
        // BU colors
        'bu-core': '#326CE5',
        'bu-sales': '#059669',
        'bu-supply': '#7c3aed',
        'bu-mfg': '#dc2626',
        'bu-finance': '#0891b2',
        'bu-special': '#d97706',
      },
    },
  },
  plugins: [],
}
