import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Volver al inicio
          </Link>
          <ThemeToggle className="size-8 border-border bg-background text-muted-foreground hover:text-foreground" />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Image
            src="/images/institucion/logotipo.webp"
            alt='Escudo de la E.T.C. "Andrés Bello"'
            width={36}
            height={36}
            className="size-9 rounded-full object-contain"
          />
          <div>
            <h1 className="font-sans text-lg font-medium tracking-[-0.02em] text-foreground">
              Acceso a S.I.G.A.
            </h1>
            <p className="text-xs text-muted-foreground">
              E.T.C. &ldquo;Andrés Bello&rdquo; · Código DEA OD01340701
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
          El inicio de sesión con cédula, correo institucional
          (@etcandresbello.org) y enlaces de evaluación se habilitará al
          configurar la autenticación escolar.
        </p>

        <div className="mt-6">
          <Button asChild variant="outline" className="w-full">
            <Link href="/">Volver al portal principal</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
