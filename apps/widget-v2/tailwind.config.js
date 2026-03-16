/** @type {import('tailwindcss').Config} */
const config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        widget: {
          bg: "var(--widget-bg)",
          fg: "var(--widget-fg)",
          card: "var(--widget-card)",
          border: "var(--widget-border)",
          primary: "var(--widget-primary)",
          "primary-fg": "var(--widget-primary-fg)",
          muted: "var(--widget-muted)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
