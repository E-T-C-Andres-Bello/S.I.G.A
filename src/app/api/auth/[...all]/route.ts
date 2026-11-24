import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse, type NextRequest } from "next/server";
import { getAuth, isAuthConfigured } from "@/lib/auth/server";
import { devError, devWarn } from "@/lib/dev-logger";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  if (!isAuthConfigured()) {
    devWarn("auth:handler", "GET rechazado porque auth no está configurado", {
      pathname: request.nextUrl.pathname,
    });
    return NextResponse.json(
      { ok: false, message: "El servicio de acceso escolar no está disponible temporalmente." },
      { status: 503 }
    );
  }
  try {
    const handler = toNextJsHandler(getAuth());
    const response = await handler.GET(request);
    if (response.status >= 400) {
      devWarn("auth:handler", "GET respondió con error", {
        pathname: request.nextUrl.pathname,
        status: response.status,
      });
    }
    return response;
  } catch (error) {
    devError("auth:handler", "Error no controlado en GET /api/auth/[...all]", error, {
      pathname: request.nextUrl.pathname,
    });
    return NextResponse.json(
      { ok: false, message: "No se pudo procesar la solicitud de autenticación." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!isAuthConfigured()) {
    devWarn("auth:handler", "POST rechazado porque auth no está configurado", {
      pathname: request.nextUrl.pathname,
    });
    return NextResponse.json(
      { ok: false, message: "El servicio de acceso escolar no está disponible temporalmente." },
      { status: 503 }
    );
  }
  try {
    const handler = toNextJsHandler(getAuth());
    const response = await handler.POST(request);
    if (response.status >= 400) {
      devWarn("auth:handler", "POST respondió con error", {
        pathname: request.nextUrl.pathname,
        status: response.status,
      });
    }
    return response;
  } catch (error) {
    devError("auth:handler", "Error no controlado en POST /api/auth/[...all]", error, {
      pathname: request.nextUrl.pathname,
    });
    return NextResponse.json(
      { ok: false, message: "No se pudo procesar la solicitud de autenticación." },
      { status: 500 }
    );
  }
}
