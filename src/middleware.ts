import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
] as const;

const PROTECTED_DASHBOARD_PREFIXES = [
  "/estudiante",
  "/docente",
  "/control-estudios",
  "/analitica",
  "/biblioteca",
  "/pasantias",
  "/aula-virtual",
  "/representante",
  "/notificaciones",
];

function isProtectedDashboardRoute(pathname: string): boolean {
  return PROTECTED_DASHBOARD_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=()"
  );
  return response;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (isProtectedDashboardRoute(pathname)) {
    // Verificación ligera de cookie Better Auth en Edge; la validación criptográfica
    // y de matrícula/rol se ejecuta en `getAuthenticatedDashboardContext()`.
    const hasSessionCookie = SESSION_COOKIE_NAMES.some((name) =>
      Boolean(request.cookies.get(name)?.value)
    );
    if (!hasSessionCookie) {
      if (process.env.NODE_ENV !== "production") {
        const presentCookieNames = request.cookies.getAll().map((c) => c.name);
        console.warn("[SIGA:DEV][middleware] Redirigiendo ruta protegida sin cookie de sesión", {
          pathname,
          presentCookieNames,
        });
      }
      const redirectUrl = new URL("/", request.url);
      redirectUrl.searchParams.set("next", pathname);
      return applySecurityHeaders(NextResponse.redirect(redirectUrl));
    }
  }

  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
