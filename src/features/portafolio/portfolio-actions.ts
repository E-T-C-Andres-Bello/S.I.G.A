"use server";

import { revalidatePath } from "next/cache";
import { getServerAuthSession, isAuthConfigured } from "@/lib/auth/server";
import { callNeonRpcScalar, withUserDb } from "@/lib/db/neon";
import { devWarn } from "@/lib/dev-logger";
import { evaluateStudentPortfolio } from "@/features/portafolio/cv-scoring";
import {
  studentPortfolioDraftSchema,
  type StudentPortfolioDraft,
} from "@/lib/validators/portfolio";

export interface SavePortfolioActionResult {
  ok: boolean;
  message: string;
  verificationCode?: string;
  publicSlug?: string | null;
  isPublic?: boolean;
  completenessScore?: number;
  updatedAt?: string;
}

export async function saveStudentPortfolioAction(
  rawInput: StudentPortfolioDraft,
  contextMeta?: {
    mencionCode?: string | null;
    mencionName?: string | null;
    gradeYear?: number | null;
  }
): Promise<SavePortfolioActionResult> {
  if (!isAuthConfigured()) {
    return {
      ok: false,
      message: "El servicio no está disponible temporalmente.",
    };
  }

  const session = await getServerAuthSession();
  if (!session) {
    return {
      ok: false,
      message: "Tu sesión institucional expiró. Inicia sesión nuevamente.",
    };
  }

  const parsed = studentPortfolioDraftSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "Revisa los campos de tu portafolio antes de guardar.",
    };
  }

  const draft = parsed.data;
  const evaluation = evaluateStudentPortfolio(draft, {
    mencionCode: contextMeta?.mencionCode ?? null,
    mencionName: contextMeta?.mencionName ?? null,
    gradeYear: contextMeta?.gradeYear ?? null,
  });

  try {
    const rpcResult = await withUserDb(
      { authUserId: session.authUserId, email: session.email },
      (client) =>
        callNeonRpcScalar<{
          ok?: boolean;
          verification_code?: string;
          public_slug?: string | null;
          is_public?: boolean;
          completeness_score?: number;
          updated_at?: string;
        }>(client, "siga_guardar_portafolio_estudiante", {
          p_template_id: draft.templateId,
          p_design_config: JSON.stringify(draft.designConfig),
          p_headline: draft.headline,
          p_about_summary: draft.aboutSummary,
          p_contact_meta: JSON.stringify(draft.contactMeta),
          p_skills: JSON.stringify(draft.skills),
          p_languages: JSON.stringify(draft.languages),
          p_projects: JSON.stringify(draft.projects),
          p_experience: JSON.stringify(draft.experience),
          p_certifications: JSON.stringify(draft.certifications),
          p_custom_sections: JSON.stringify(draft.customSections),
          p_completeness_score: evaluation.totalScore,
          p_is_public: draft.isPublic,
          p_public_slug: draft.publicSlug || null,
          p_privacy_settings: JSON.stringify(draft.privacySettings),
        })
    );

    if (!rpcResult || !rpcResult.ok) {
      return {
        ok: false,
        message: "No se pudo guardar tu portafolio en este momento.",
      };
    }

    revalidatePath("/estudiante/portafolio");
    if (rpcResult.public_slug) {
      revalidatePath(`/portafolio/${rpcResult.public_slug}`);
    }

    return {
      ok: true,
      message: "Portafolio técnico guardado y actualizado.",
      verificationCode: rpcResult.verification_code,
      publicSlug: rpcResult.public_slug ?? null,
      isPublic: Boolean(rpcResult.is_public),
      completenessScore: rpcResult.completeness_score ?? evaluation.totalScore,
      updatedAt: rpcResult.updated_at ?? new Date().toISOString(),
    };
  } catch (err) {
    devWarn("portfolio-actions", "Error guardando portafolio", {
      detail: err instanceof Error ? err.message : String(err),
    });
    const rawMsg = err instanceof Error ? err.message : "";
    if (
      rawMsg.includes("ya está en uso") ||
      rawMsg.includes("enlace público") ||
      rawMsg.includes("cuenta institucional")
    ) {
      return { ok: false, message: rawMsg };
    }
    return {
      ok: false,
      message:
        "No fue posible guardar tu portafolio en este momento. Intenta nuevamente.",
    };
  }
}
