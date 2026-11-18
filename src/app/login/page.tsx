import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LoginForm, SmokeyBackground } from "@/components/ui/login-form";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface LoginPageProps {
  searchParams: Promise<{ auth_error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const authErrorCode = params.auth_error ?? null;

  return (
    <main className="relative isolate flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#020617] px-5 py-14">
      <SmokeyBackground color="#1c47c4" backdropBlurAmount="sm" />

      <div className="relative z-10 w-full max-w-[23.5rem]">
        <div className="mb-3 flex items-center justify-between gap-2 px-1">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-200 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Volver al inicio
          </Link>
          <ThemeToggle className="size-8 border-white/20 bg-white/10 text-white backdrop-blur-md hover:bg-white/20" />
        </div>

        <LoginForm
          callbackReturnPath="/login"
          initialAuthErrorCode={authErrorCode}
        />
      </div>
    </main>
  );
}
