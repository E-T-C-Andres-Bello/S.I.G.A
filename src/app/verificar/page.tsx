import Link from "next/link";
import { ArrowLeft, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VerificarDocumentoPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Volver al inicio
        </Link>

        <div className="mt-6 flex flex-col gap-3">
          <div className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-secondary text-primary">
            <QrCode className="size-5" aria-hidden="true" />
          </div>
          <h1 className="font-sans text-xl font-medium tracking-[-0.02em] text-foreground">
            Verificación de Documentos Oficiales
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Este espacio permitirá a universidades, empresas e instituciones
            validar en segundos la autenticidad de boletines, constancias y
            certificaciones de notas emitidas por la E.T.C. &ldquo;Andrés Bello&rdquo;.
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-dashed border-border bg-background p-4 text-xs text-muted-foreground">
          La consulta pública estará disponible una vez conectado el módulo de
          Control de Estudios y firma digital por código QR.
        </div>

        <div className="mt-6">
          <Button asChild className="w-full">
            <Link href="/">Regresar a S.I.G.A.</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
