import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#F6F1E7",
          dark: "#EFE7D7",
          deep: "#E6DAC4",
        },
        ink: {
          DEFAULT: "#2A2118",
          soft: "#4A3D2F",
          faint: "#8A7A64",
        },
        seal: {
          DEFAULT: "#8E2C21",
          dark: "#6E2119",
        },
        sepia: {
          DEFAULT: "#A08862",
          light: "#C7B896",
        },
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
