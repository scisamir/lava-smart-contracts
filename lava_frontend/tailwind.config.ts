import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "clamp(18px, 4vw, 56px)",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        // The landing page's stack, verbatim — system UI first, Inter as the
        // fallback for platforms without one.
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Inter', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      letterSpacing: {
        tightest: "-0.03em",
        tighter: "-0.02em",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        lava: {
          orange: "hsl(var(--lava-orange))",
          red: "hsl(var(--lava-red))",
          yellow: "hsl(var(--lava-yellow))",
          ember: "#ff9a4d",
          ink: "#05070a",
          surface: "#0d1116",
        },
      },
      boxShadow: {
        glow: "var(--glow-sm)",
        "glow-md": "var(--glow-md)",
        "glow-lg": "var(--glow-lg)",
        hairline: "inset 0 0 0 1px rgba(255,255,255,0.07)",
      },
      backgroundImage: {
        "gradient-lava": "linear-gradient(120deg, #ff9a4d 0%, #df473d 100%)",
        "gradient-lava-horizontal": "linear-gradient(90deg, #ff9a4d 0%, #ffd9a8 100%)",
        // The card treatment from the landing page's feature grid.
        "gradient-card": "linear-gradient(180deg, #0d1116 0%, #14100f 42%, #4a1a14 78%, #a03c22 100%)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
        card: "22px",
        lip: "32px",
      },
      transitionTimingFunction: {
        lava: "cubic-bezier(0.2, 0.7, 0.3, 1)",
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        float: "float 6s ease-in-out infinite",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        sheen: "lava-sheen 7s linear infinite",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(255, 154, 77, 0.25)" },
          "50%": { boxShadow: "0 0 40px rgba(255, 154, 77, 0.5)" },
        },
        "lava-sheen": {
          to: { backgroundPosition: "-220% 0" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
