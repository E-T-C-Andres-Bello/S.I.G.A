import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthSession, isAuthConfigured } from "@/lib/auth/server";
import { verifyPreEnrolledAccess } from "@/lib/auth/verification";

const aiPlanningRequestSchema = z.object({
  subjectName: z.string().min(2),
  gradeYear: z.number().int().min(1).max(6),
  mencion: z.string().nullable().optional(),
  momento: z.number().int().min(1).max(3),
  customTopic: z.string().max(250).optional(),
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    if (!isAuthConfigured()) {
      return NextResponse.json(
        { error: "Servicio de autenticación no disponible." },
        { status: 503 }
      );
    }

    const session = await getServerAuthSession();
    if (!session) {
      return NextResponse.json(
        { error: "Acceso no autorizado. Inicia sesión en el portal docente." },
        { status: 401 }
      );
    }

    const access = await verifyPreEnrolledAccess({
      authUserId: session.authUserId,
      email: session.email,
      loginMethod: "credentials",
    });

    if (
      !access.ok ||
      !["docente", "coordinador_mencion", "direccion", "control_estudios"].includes(
        access.primaryRole
      )
    ) {
      return NextResponse.json(
        { error: "No cuentas con permisos docentes para generar planificaciones con IA." },
        { status: 403 }
      );
    }

    const json = await req.json();
    const parsed = aiPlanningRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos de solicitud inválidos para la planificación.", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { subjectName, gradeYear, mencion, momento, customTopic } = parsed.data;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "El Asistente de Planificación IA no está habilitado temporalmente. Puedes crear las actividades manualmente.",
        },
        { status: 503 }
      );
    }

    const prompt = `Actúa como asesor curricular experto del Ministerio del Poder Popular para la Educación (MPPE) de Venezuela y especialista en Escuelas Técnicas de Comercio (E.T.C. "Andrés Bello").
Genera una propuesta de planificación académica y plan de evaluación ponderado para el siguiente contexto:
- Asignatura: "${subjectName}"
- Año: ${gradeYear}.º Año Técnico
- Mención / Especialidad: ${mencion ? `"${mencion}"` : "Educación Media Técnica General"}
- Momento Pedagógico: Momento ${momento} (Lapso ${momento})
${customTopic ? `- Énfasis temático solicitado por el docente: "${customTopic}"` : ""}

Reglas obligatorias:
1. Las actividades evaluativas deben sumar exactamente el 100 % de ponderación.
2. Cada actividad debe clasificarse en uno de estos tipos exactos:
   - "exam_online" (Prueba o examen objetivo)
   - "assignment_lms" (Guía de ejercicios, taller o entrega digital)
   - "lab_mention" (Práctica de laboratorio de especialidad técnica: redes/SQL en Telemática, valoración/arancel en Aduanas, recepción/rutas en Turismo)
   - "classroom_activity" (Defensa oral, debate, intervención o trabajo en aula)
   - "project" (Proyecto socioproductivo o integrador)
3. La escala es del 1 al 20 puntos MPPE (maxPoints: 20).
4. El tono debe ser pedagógico, riguroso, adaptado al perfil técnico y libre de jerga técnica interna de software.

Responde ÚNICAMENTE en formato JSON con la siguiente estructura exacta:
{
  "pedagogicalIntent": "Resumen pedagógico del momento y competencia técnica a consolidar",
  "contents": [
    "Contenido o unidad temática 1",
    "Contenido o unidad temática 2",
    "Contenido o unidad temática 3"
  ],
  "didacticStrategies": [
    "Estrategia de enseñanza o aprendizaje 1",
    "Estrategia de enseñanza o aprendizaje 2"
  ],
  "suggestedItems": [
    {
      "title": "Nombre descriptivo de la actividad evaluativa",
      "evaluationType": "exam_online | assignment_lms | lab_mention | classroom_activity | project",
      "weightPercent": 25,
      "maxPoints": 20,
      "learningIndicator": "Indicador de logro observable y medible"
    }
  ]
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const aiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("Gemini API error:", errText);
      return NextResponse.json(
        { error: "El servicio de Inteligencia Artificial no pudo generar la propuesta en este momento." },
        { status: 502 }
      );
    }

    const aiData = await aiRes.json();
    const rawContent = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) {
      return NextResponse.json(
        { error: "Respuesta vacía del servicio de Inteligencia Artificial." },
        { status: 502 }
      );
    }

    const parsedSuggestion = JSON.parse(rawContent);

    return NextResponse.json({
      success: true,
      proposal: parsedSuggestion,
    });
  } catch (error) {
    console.error("Error en API de planificación IA:", error);
    return NextResponse.json(
      { error: "Ocurrió un error inesperado al procesar la planificación con IA." },
      { status: 500 }
    );
  }
}
