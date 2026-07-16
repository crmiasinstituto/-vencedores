import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: {
				DEFAULT: '1rem',
				sm: '1.5rem',
				lg: '2rem',
				xl: '2rem',
				'2xl': '2rem'
			},
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				'space-grotesk': ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
				'inter': ['Inter', 'system-ui', 'sans-serif'],
				// 'display' era Inter aqui e Playfair no portal — mesma classe,
				// duas fontes. Fica o sentido do portal (26 arquivos contam com
				// serif nos títulos); do lado do CRM só MasterclassIA usava, e
				// essa página sai junto com o resto da SQUAAD.
				'display': ['Playfair Display', 'Georgia', 'serif'],
				'body': ['Inter', 'system-ui', 'sans-serif'],
				'editorial': ['"Instrument Serif"', 'Georgia', 'serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				// Paleta do portal. 'gold' hoje resolve pra azul — o rebrand
				// trocou o valor do token e manteve o nome, e o portal chama
				// text-gold / bg-gold / variant="gold" em dezenas de telas.
				gold: {
					DEFAULT: 'hsl(var(--gold))',
					light: 'hsl(var(--gold-light))',
					dark: 'hsl(var(--gold-dark))'
				},
				navy: {
					DEFAULT: 'hsl(var(--navy))',
					deep: 'hsl(var(--navy-deep))',
					light: 'hsl(var(--navy-light))'
				},
				electric: 'hsl(var(--electric))',
				platinum: 'hsl(var(--platinum))'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				// Animações customizadas IaMilitia
				'fadeInUp': {
					'0%': {
						opacity: '0',
						transform: 'translateY(30px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'fadeInLeft': {
					'0%': {
						opacity: '0',
						transform: 'translateX(-30px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateX(0)'
					}
				},
				'fadeInRight': {
					'0%': {
						opacity: '0',
						transform: 'translateX(30px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateX(0)'
					}
				},
			'pulseYellow': {
				'0%, 100%': {
					boxShadow: '0 0 0 0 hsl(217 91% 60% / 0.7)'
				},
				'50%': {
					boxShadow: '0 0 0 10px hsl(217 91% 60% / 0)'
				}
			},
			'marquee': {
				from: { transform: 'translateX(0)' },
				to: { transform: 'translateX(calc(-100% - var(--gap)))' }
			},
			'marquee-vertical': {
				from: { transform: 'translateY(0)' },
				to: { transform: 'translateY(calc(-100% - var(--gap)))' }
			},
			// Vindas do portal. Os nomes em kebab-case não colidem com os
			// fadeInUp/fadeInLeft camelCase acima — os dois conjuntos convivem.
			'fade-up': {
				'0%': { opacity: '0', transform: 'translateY(30px)' },
				'100%': { opacity: '1', transform: 'translateY(0)' }
			},
			'fade-in': {
				'0%': { opacity: '0' },
				'100%': { opacity: '1' }
			},
			'scale-in': {
				'0%': { opacity: '0', transform: 'scale(0.95)' },
				'100%': { opacity: '1', transform: 'scale(1)' }
			},
			'slide-in-right': {
				'0%': { opacity: '0', transform: 'translateX(50px)' },
				'100%': { opacity: '1', transform: 'translateX(0)' }
			},
			'count-up': {
				'0%': { opacity: '0', transform: 'translateY(20px)' },
				'100%': { opacity: '1', transform: 'translateY(0)' }
			}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fadeInUp': 'fadeInUp 0.6s ease-out forwards',
				'fadeInLeft': 'fadeInLeft 0.8s ease-out forwards',
				'fadeInRight': 'fadeInRight 0.8s ease-out forwards',
				'pulseYellow': 'pulseYellow 2s ease-in-out infinite',
				'marquee': 'marquee var(--duration, 40s) linear infinite',
				'marquee-vertical': 'marquee-vertical var(--duration, 40s) linear infinite',
				'fade-up': 'fade-up 0.8s ease-out forwards',
				'fade-in': 'fade-in 0.6s ease-out forwards',
				'scale-in': 'scale-in 0.5s ease-out forwards',
				'slide-in-right': 'slide-in-right 0.6s ease-out forwards',
				'count-up': 'count-up 0.4s ease-out forwards'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
