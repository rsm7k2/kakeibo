/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    // スマホ専用/タブレット専用の2段階のみ。PC向けの大画面は対象外。
    screens: {
      sm: '480px',   // 大きめスマホ
      md: '768px'    // タブレット
    },
    extend: {}
  },
  plugins: []
}
