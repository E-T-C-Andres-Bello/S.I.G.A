import type { Metadata } from "next";
import { SigaLegalDocument } from "@/components/legal/SigaLegalDocument";
import { SIGA_LEGAL_ORIGIN } from "@/components/legal/siga-legal-data";

export const metadata: Metadata = {
  title:
    'Legal Notice, Privacy, Trademarks & Open Source · S.I.G.A. — E.T.C. "Andrés Bello"',
  description:
    'Official v2.0 legal notice for S.I.G.A. at E.T.C. "Andrés Bello": K12 student privacy, child protection (LOPNNA), third-party trademarks, MIT License, advisory AI disclaimers, responsible security disclosure, and terms of use.',
  alternates: {
    canonical: `${SIGA_LEGAL_ORIGIN}/legal/en`,
    languages: {
      es: `${SIGA_LEGAL_ORIGIN}/legal`,
      en: `${SIGA_LEGAL_ORIGIN}/legal/en`,
      "x-default": `${SIGA_LEGAL_ORIGIN}/legal`,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["es_VE"],
    siteName: 'S.I.G.A. — E.T.C. "Andrés Bello"',
    title:
      'Legal Notice, Privacy & Open Source · S.I.G.A. — E.T.C. "Andrés Bello"',
    description:
      "Institutional legal framework, K12 privacy, LOPNNA child protection, third-party trademarks, S.I.G.A. MIT License, and responsible security disclosure.",
    url: `${SIGA_LEGAL_ORIGIN}/legal/en`,
  },
};

export default function LegalEnglishPage() {
  return <SigaLegalDocument locale="en" />;
}
