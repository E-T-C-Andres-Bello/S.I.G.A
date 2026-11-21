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

const BOOTSTRAP_INIT_SCRIPT = `(function(){try{if(localStorage.getItem("siga-theme")==="dark"){document.documentElement.classList.add("dark");}var p=localStorage.getItem("siga-color-palette-v1");if(p&&/^(cobalto|orinoco|nebula|aurum|carmesi|grafito)$/.test(p)){document.documentElement.setAttribute("data-siga-palette",p);}}catch(e){}try{var a=["bis_skin_checked","bis_register","bis_size","bis_id"],s="[bis_skin_checked],[bis_register],[bis_size],[bis_id]",c=0;function cl(el){if(!el||el.nodeType!==1||c>2000)return;for(var i=0;i<a.length;i++){if(el.hasAttribute(a[i])){el.removeAttribute(a[i]);c++;}}}function sw(){var ns=document.querySelectorAll(s);for(var i=0;i<ns.length;i++)cl(ns[i]);}sw();var ob=new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var m=ms[i];if(m.type==="attributes"){cl(m.target);}else if(m.addedNodes){for(var j=0;j<m.addedNodes.length;j++){var n=m.addedNodes[j];cl(n);if(n&&n.querySelectorAll){var sub=n.querySelectorAll(s);for(var k=0;k<sub.length;k++)cl(sub[k]);}}}}});ob.observe(document.documentElement,{attributes:true,attributeFilter:a,childList:true,subtree:true});var st=function(){try{ob.disconnect();}catch(e){}};document.addEventListener("DOMContentLoaded",sw,{once:true});window.addEventListener("load",function(){setTimeout(st,1500);},{once:true});setTimeout(st,5000);}catch(e){}})();`;

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
        <script dangerouslySetInnerHTML={{ __html: BOOTSTRAP_INIT_SCRIPT }} />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-background text-foreground transition-colors duration-300 selection:bg-primary/15 selection:text-primary"
      >
        {children}
      </body>
    </html>
  );
}
