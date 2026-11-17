import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: 'S.I.G.A. — Sistema Integral de Gestión Académica · E.T.C. "Andrés Bello"',
  description:
    'Plataforma académica oficial de la Escuela Técnica Comercial "Andrés Bello" en Puerto Ordaz. Calificaciones, aulas virtuales, pasantías y constancias verificables.',
  icons: {
    icon: [
      { url: "/images/institucion/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/institucion/logotipo.webp", type: "image/webp" },
    ],
    apple: "/images/institucion/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
};

const THEME_INIT_SCRIPT = `(function(){try{if(localStorage.getItem("siga-theme")==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-background text-foreground transition-colors duration-300 selection:bg-primary/15 selection:text-primary">
        {children}
      </body>
    </html>
  );
}
