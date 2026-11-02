import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        cream: "rgb(var(--color-cream) / <alpha-value>)",
        "warm-white": "rgb(var(--color-warm-white) / <alpha-value>)",
        sage: "rgb(var(--color-sage) / <alpha-value>)",
        "deep-sage": "rgb(var(--color-deep-sage) / <alpha-value>)",
        lavender: "rgb(var(--color-lavender) / <alpha-value>)",
        peach: "rgb(var(--color-peach) / <alpha-value>)",
        "dusty-rose": "rgb(var(--color-dusty-rose) / <alpha-value>)",
        sand: "rgb(var(--color-sand) / <alpha-value>)",
        charcoal: "rgb(var(--color-charcoal) / <alpha-value>)",
        "soft-gray": "rgb(var(--color-soft-gray) / <alpha-value>)",
        // Bold accent trio - the energy in the "Canopy Ember" direction
        fern: "rgb(var(--color-fern) / <alpha-value>)",
        ember: "rgb(var(--color-ember) / <alpha-value>)",
        coral: "rgb(var(--color-coral) / <alpha-value>)",
      },
      fontFamily: {
        serif: ["Fraunces", "ui-serif", "serif"],
        sans: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
