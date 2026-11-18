import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  buildSocraticTutorSystemPrompt,
  detectsDirectHomeworkSolveAttempt,
} from "@/lib/ai/socratic-tutor-guard";
import { redactSigaPii } from "@/lib/analytics/sentry-scrub";
import {
  enforceRateLimit,
  resolveRequestClientIp,
} from "@/lib/security/rate-limit";
import { verifyPreEnrolledAccess } from "@/lib/supabase/auth-verification";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getGeminiServerApiKey } from "@/lib/supabase/server-secrets";

const tutorQuerySchema = z.object({
  virtualCourseId: z.string().uuid("Curso virtual inválido."),
  question: z
    .string()
    .trim()
    .min(4, "Escribe una consulta más específica sobre la guía de estudio.")
    .max(1200, "La consulta no puede exceder los 1200 caracteres."),
});

/**
 * Endpoint protegido del Tutor Socrático RAG (`/api/ai/tutor`).
 * - Exige sesión estudiantil o docente verificada (`@etcandresbello.org`).
 * - Aplica Rate Limiting y desidentificación de PII (`redactSigaPii`).
 * - Nunca fabrica respuestas simuladas: si el curso aún no tiene guías indexadas o la llave
 *   de IA no está configurada en el servidor, informa el estado real de forma transparente.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientIp = resolveRequestClientIp(request);
  const rate = await enforceRateLimit({
    namespace: "ai_socratic_tutor",
    clientKey: clientIp,
    limit: 15,
    windowMs: 60_000,
  });

  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "rate_limited",
        message:
          "Has realizado muchas consultas seguidas al Tutor IA. Espera unos segundos antes de continuar.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      }
    );
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        code: "service_unavailable",
        message: "El servicio del Aula Virtual no está disponible en este momento.",
      },
      { status: 503 }
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      {
        ok: false,
        code: "unauthorized",
        message: "Tu sesión institucional expiró. Inicia sesión nuevamente.",
      },
      { status: 401 }
    );
  }

  const verification = await verifyPreEnrolledAccess({
    authUserId: user.id,
    email: user.email,
    loginMethod: "credentials",
    sessionClient: supabase,
  });

  if (!verification.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: "forbidden",
        message:
          "Necesitas una cuenta institucional verificada (@etcandresbello.org) para consultar al Tutor IA.",
      },
      { status: 403 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "invalid_input", message: "Formato de solicitud inválido." },
      { status: 400 }
    );
  }

  const parsed = tutorQuerySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_input",
        message: parsed.error.issues[0]?.message ?? "Consulta inválida.",
      },
      { status: 400 }
    );
  }

  const sanitizedQuestion = redactSigaPii(parsed.data.question);

  if (detectsDirectHomeworkSolveAttempt(sanitizedQuestion)) {
    return NextResponse.json(
      {
        ok: false,
        code: "socratic_policy_block",
        message:
          "El Tutor Socrático está diseñado para explicarte los conceptos de las guías de tu profesor y guiarte paso a paso, no para resolver directamente la tarea o evaluación. Cuéntame qué parte del tema ya intentaste y qué duda específica tienes.",
      },
      { status: 422 }
    );
  }

  // Verificar acceso al curso bajo RLS y si el docente habilitó el Tutor IA
  const { data: courseRow, error: courseError } = await supabase
    .from("virtual_courses")
    .select("id, ai_tutor_enabled, is_published")
    .eq("id", parsed.data.virtualCourseId)
    .maybeSingle<{
      id: string;
      ai_tutor_enabled: boolean;
      is_published: boolean;
    }>();

  if (courseError || !courseRow) {
    return NextResponse.json(
      {
        ok: false,
        code: "course_not_accessible",
        message: "No tienes acceso a este curso del Aula Virtual o aún no ha sido publicado.",
      },
      { status: 403 }
    );
  }

  if (!courseRow.ai_tutor_enabled) {
    return NextResponse.json(
      {
        ok: false,
        code: "tutor_disabled",
        message:
          "El docente de esta asignatura desactivó temporalmente el Tutor IA (por ejemplo, durante una evaluación en curso).",
      },
      { status: 403 }
    );
  }

  const geminiApiKey = getGeminiServerApiKey();
  if (!geminiApiKey) {
    // Regla Innegociable #3: Cero respuestas simuladas cuando el motor IA no está configurado
    return NextResponse.json(
      {
        ok: false,
        code: "ai_provider_not_configured",
        message:
          "El motor de inteligencia artificial académica aún no está activo en este entorno. Consulta directamente las guías publicadas por tu docente en el curso.",
        socraticSystemPreview: buildSocraticTutorSystemPrompt({
          studentFirstName: "Estudiante",
          subjectName: "Asignatura del Curso",
          mencionName: "Técnica",
          chunks: [],
        }),
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      ok: false,
      code: "no_indexed_guides",
      message:
        "Tu docente aún no ha publicado guías indexadas para el Tutor IA en esta asignatura.",
    },
    { status: 404 }
  );
}
