import type { Metadata } from "next";
import { SigaLegalDocument } from "@/components/legal/SigaLegalDocument";
import { SIGA_LEGAL_ORIGIN } from "@/components/legal/siga-legal-data";

export const metadata: Metadata = {
  title:
    'Aviso Legal, Privacidad, Marcas y Código Abierto · S.I.G.A. — E.T.C. "Andrés Bello"',
  description:
    'Marco legal v2.0 de S.I.G.A. en la Escuela Técnica Comercial "Andrés Bello": privacidad escolar K12, protección de menores (LOPNNA), marcas registradas, Licencia MIT, IA orientativa, divulgación responsable de seguridad y términos de uso.',
  alternates: {
    canonical: `${SIGA_LEGAL_ORIGIN}/legal`,
    languages: {
      es: `${SIGA_LEGAL_ORIGIN}/legal`,
      en: `${SIGA_LEGAL_ORIGIN}/legal/en`,
      "x-default": `${SIGA_LEGAL_ORIGIN}/legal`,
    },
  },
  openGraph: {
    type: "website",
    locale: "es_VE",
    alternateLocale: ["en_US"],
    siteName: 'S.I.G.A. — E.T.C. "Andrés Bello"',
    title:
      'Aviso Legal, Privacidad y Código Abierto · S.I.G.A. — E.T.C. "Andrés Bello"',
    description:
      "Marco legal institucional, privacidad K12, LOPNNA, marcas registradas, Licencia MIT de S.I.G.A. y divulgación responsable de seguridad.",
    url: `${SIGA_LEGAL_ORIGIN}/legal`,
  },
};

export default function LegalPage() {
  return <SigaLegalDocument locale="es" />;
}
