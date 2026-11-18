import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PublicDocumentVerifier } from "@/components/qr/PublicDocumentVerifier";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: 'Verificación QR de Documentos · S.I.G.A. — E.T.C. "Andrés Bello"',
  description:
    'Consulta pública oficial para verificar la autenticidad de constancias, boletines y certificaciones de la E.T.C. "Andrés Bello".',
};

interface VerificarPageProps {
  searchParams: Promise<{ code?: string }>;
}

export default async function VerificarDocumentoPage({
  searchParams,
}: VerificarPageProps) {
  const params = await searchParams;
  const initialCode = typeof params.code === "string" ? params.code : "";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-12">
      <div className="mb-4 flex w-full max-w-lg items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Volver al portal S.I.G.A.
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">Acceso institucional</Link>
        </Button>
      </div>

      <PublicDocumentVerifier initialCode={initialCode} />
    </main>
  );
}
