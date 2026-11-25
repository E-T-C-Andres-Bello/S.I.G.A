import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { PortfolioLiveSheet } from "@/components/portafolio/PortfolioLiveSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublicPortfolioBySlug } from "@/features/portafolio/portfolio-data";

interface PublicPortfolioPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PublicPortfolioPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicPortfolioBySlug(slug);
  if (!data) {
    return {
      title: 'Portafolio no disponible · S.I.G.A. — E.T.C. "Andrés Bello"',
    };
  }
  return {
    title: `${data.verifiedProfile.fullName} · Portafolio Técnico · E.T.C. "Andrés Bello"`,
    description:
      data.draft.headline ||
      `Portafolio técnico verificado de estudiante de la E.T.C. "Andrés Bello" (Puerto Ordaz).`,
  };
}

export default async function PublicStudentPortfolioPage({
  params,
}: PublicPortfolioPageProps) {
  const { slug } = await params;
  const data = await getPublicPortfolioBySlug(slug);

  if (!data) {
    notFound();
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") || "";

  return (
    <main className="min-h-screen bg-slate-100/80 px-4 py-8 dark:bg-slate-950">
      <div className="mx-auto max-w-[820px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Portal S.I.G.A. · E.T.C. &ldquo;Andrés Bello&rdquo;
          </Link>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            >
              <ShieldCheck className="mr-1 size-3.5" aria-hidden="true" />
              Identidad Verificada
            </Badge>
            <Button asChild size="sm" variant="outline">
              <Link
                href={`/verificar?code=${encodeURIComponent(data.verificationCode)}`}
              >
                Validar código QR
              </Link>
            </Button>
          </div>
        </div>

        <PortfolioLiveSheet
          draft={data.draft}
          verified={data.verifiedProfile}
          verificationCode={data.verificationCode}
          verificationBaseUrl={appUrl}
          interactive={false}
        />
      </div>
    </main>
  );
}
