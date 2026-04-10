/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ["class"],
	content: [
	  "./pages/**/*.{ts,tsx}",
	  "./components/**/*.{ts,tsx}",
	  "./app/**/*.{ts,tsx}",
	  "./src/**/*.{ts,tsx}",
	],
	theme: {
	  extend: {
		/* ------------------------------------------------------------------ */
		/*  Energy Intelligence — Custom Color Palette                        */
		/* ------------------------------------------------------------------ */
		colors: {
		  // Core backgrounds
		  carbon: {
			950: "#050505",
			900: "#0a0a0a",   // primary background
			800: "#0d0d0d",   // card background
			700: "#111111",   // elevated card
			600: "#161616",   // hover state
		  },
		  // Primary accent — Energy Yellow
		  energy: {
			50:  "#fefce8",
			100: "#fef9c3",
			200: "#fef08a",
			300: "#fde047",
			400: "#facc15",   // primary accent
			500: "#eab308",
			600: "#ca8a04",
			700: "#a16207",
			800: "#854d0e",
			900: "#713f12",
		  },
		  // Secondary accent — Safety Teal
		  safety: {
			50:  "#f0fdfa",
			100: "#ccfbf1",
			200: "#99f6e4",
			300: "#5eead4",
			400: "#2dd4bf",
			500: "#14b8a6",   // secondary accent
			600: "#0d9488",
			700: "#0f766e",
			800: "#115e59",
			900: "#134e4a",
		  },
		  // Alert — Danger Red
		  hazard: {
			400: "#f87171",
			500: "#ef4444",
			600: "#dc2626",
		  },
		  // Neutrals for text
		  slate: {
			50:  "rgba(255,255,255,0.95)",
			100: "rgba(255,255,255,0.80)",
			200: "rgba(255,255,255,0.60)",
			300: "rgba(255,255,255,0.40)",
			400: "rgba(255,255,255,0.25)",
			500: "rgba(255,255,255,0.12)",
			600: "rgba(255,255,255,0.06)",
			700: "rgba(255,255,255,0.04)",
		  },
		},
  
		/* ------------------------------------------------------------------ */
		/*  Typography — Syne + JetBrains Mono                               */
		/* ------------------------------------------------------------------ */
		fontFamily: {
		  sans:    ["Syne", "system-ui", "sans-serif"],
		  mono:    ["JetBrains Mono", "monospace"],
		  display: ["Syne", "sans-serif"],
		},
  
		/* ------------------------------------------------------------------ */
		/*  Spacing & Sizing                                                  */
		/* ------------------------------------------------------------------ */
		spacing: {
		  "13": "3.25rem",
		  "18": "4.5rem",
		  "22": "5.5rem",
		  "26": "6.5rem",
		  "30": "7.5rem",
		},
  
		/* ------------------------------------------------------------------ */
		/*  Border Radius                                                     */
		/* ------------------------------------------------------------------ */
		borderRadius: {
		  "2xl": "1rem",
		  "3xl": "1.5rem",
		  "4xl": "2rem",
		},
  
		/* ------------------------------------------------------------------ */
		/*  Box Shadows — Energy glow system                                  */
		/* ------------------------------------------------------------------ */
		boxShadow: {
		  // Yellow energy glow
		  "glow-energy-sm": "0 0 12px rgba(250,204,21,0.15)",
		  "glow-energy":    "0 0 24px rgba(250,204,21,0.2), 0 0 60px rgba(250,204,21,0.08)",
		  "glow-energy-lg": "0 0 40px rgba(250,204,21,0.3), 0 0 100px rgba(250,204,21,0.12)",
		  // Teal safety glow
		  "glow-safety-sm": "0 0 12px rgba(20,184,166,0.15)",
		  "glow-safety":    "0 0 24px rgba(20,184,166,0.2), 0 0 60px rgba(20,184,166,0.08)",
		  // Card system
		  "card":           "0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px rgba(0,0,0,0.4)",
		  "card-hover":     "0 1px 0 rgba(255,255,255,0.04) inset, 0 16px 48px rgba(0,0,0,0.5)",
		  // Elevated containers
		  "panel":          "0 0 0 1px rgba(255,255,255,0.04), 0 32px 64px rgba(0,0,0,0.6)",
		  // Navbar
		  "nav":            "0 1px 0 rgba(250,204,21,0.08), 0 8px 32px rgba(0,0,0,0.4)",
		},
  
		/* ------------------------------------------------------------------ */
		/*  Background gradients                                              */
		/* ------------------------------------------------------------------ */
		backgroundImage: {
		  "energy-gradient":  "linear-gradient(135deg, #facc15 0%, #eab308 100%)",
		  "safety-gradient":  "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
		  "hero-gradient":    "linear-gradient(135deg, #facc15 0%, #fde68a 40%, #14b8a6 100%)",
		  "card-gradient":    "linear-gradient(135deg, #111111 0%, #0d0d0d 100%)",
		  "energy-glow":      "radial-gradient(ellipse at center, rgba(250,204,21,0.08) 0%, transparent 70%)",
		  "grid-pattern":     "repeating-linear-gradient(0deg, transparent, transparent 79px, rgba(250,204,21,0.03) 79px, rgba(250,204,21,0.03) 80px), repeating-linear-gradient(90deg, transparent, transparent 79px, rgba(250,204,21,0.025) 79px, rgba(250,204,21,0.025) 80px)",
		},
  
		/* ------------------------------------------------------------------ */
		/*  Animations                                                        */
		/* ------------------------------------------------------------------ */
		keyframes: {
		  "energy-pulse": {
			"0%, 100%": { opacity: "0.6", transform: "translateX(-50%) scale(1)" },
			"50%":       { opacity: "1",   transform: "translateX(-50%) scale(1.08)" },
		  },
		  "glow-pulse": {
			"0%, 100%": { boxShadow: "0 0 20px rgba(250,204,21,0.15)" },
			"50%":       { boxShadow: "0 0 40px rgba(250,204,21,0.35), 0 0 80px rgba(250,204,21,0.12)" },
		  },
		  "scan-line": {
			"0%":   { transform: "translateY(-100%)", opacity: "0" },
			"10%":  { opacity: "1" },
			"90%":  { opacity: "1" },
			"100%": { transform: "translateY(100vh)", opacity: "0" },
		  },
		  "ticker": {
			"0%":   { transform: "translateX(0)" },
			"100%": { transform: "translateX(-50%)" },
		  },
		  "float": {
			"0%, 100%": { transform: "translateY(0)" },
			"50%":       { transform: "translateY(-8px)" },
		  },
		  "shimmer": {
			"0%":   { backgroundPosition: "-400px 0" },
			"100%": { backgroundPosition: "400px 0" },
		  },
		},
		animation: {
		  "energy-pulse": "energy-pulse 8s ease-in-out infinite",
		  "glow-pulse":   "glow-pulse 3s ease-in-out infinite",
		  "scan-line":    "scan-line 12s linear infinite",
		  "ticker":       "ticker 24s linear infinite",
		  "float":        "float 4s ease-in-out infinite",
		  "shimmer":      "shimmer 2s linear infinite",
		},
  
		/* ------------------------------------------------------------------ */
		/*  Letter spacing                                                    */
		/* ------------------------------------------------------------------ */
		letterSpacing: {
		  "widest":  "0.15em",
		  "widest2": "0.2em",
		  "widest3": "0.3em",
		},
  
		/* ------------------------------------------------------------------ */
		/*  Blur                                                              */
		/* ------------------------------------------------------------------ */
		blur: {
		  "4xl": "100px",
		  "5xl": "150px",
		},
	  },
	},
	plugins: [require("tailwindcss-animate")],
  }
  