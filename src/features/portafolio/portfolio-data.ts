import type { DashboardUserProfile } from "@/lib/auth/dashboard-session";
import {
  callNeonRpcScalar,
  isNeonDatabaseConfigured,
  querySingleRow,
  withAnonDb,
  withUserDb,
} from "@/lib/db/neon";
import { devWarn } from "@/lib/dev-logger";
import {
  resolvePortfolioDesign,
  studentPortfolioDraftSchema,
  type PortfolioTemplateId,
  type StudentPortfolioDraft,
} from "@/lib/validators/portfolio";

export interface VerifiedStudentAcademicSnapshot {
  fullName: string;
  avatarUrl: string | null;
  institutionalEmail: string | null;
  phone: string | null;
  mencionCode: string | null;
  mencionName: string | null;
  mencionSpecialty: string | null;
  gradeYear: number | null;
  sectionLetter: string | null;
  schoolYearName: string | null;
  enrollmentStatus: string | null;
  averageGrade: number | null;
  medalsUnlocked: Array<{ id: string; title: string }>;
  internshipHoursApproved: number | null;
}

export interface StudentPortfolioWorkspaceData {
  hasSavedPortfolio: boolean;
  verificationCode: string | null;
  updatedAt: string | null;
  draft: StudentPortfolioDraft;
  verifiedProfile: VerifiedStudentAcademicSnapshot;
  aiQuotaRemaining: number;
  aiQuotaLimit: number;
}

export interface PublicPortfolioViewData {
  verificationCode: string;
  publicSlug: string;
  updatedAt: string;
  completenessScore: number;
  draft: StudentPortfolioDraft;
  verifiedProfile: {
    fullName: string;
    avatarUrl: string | null;
    institutionalEmail: string | null;
    phone: string | null;
    mencionCode: string | null;
    mencionName: string | null;
    mencionSpecialty: string | null;
    gradeYear: number | null;
    sectionLetter: string | null;
    schoolYearName: string | null;
    enrollmentStatus: string | null;
    averageGrade: number | null;
  };
}

interface PortfolioDbRow {
  id: string;
  verification_code: string;
  public_slug: string | null;
  is_public: boolean;
  privacy_settings: Record<string, unknown> | null;
  template_id: string;
  design_config: Record<string, unknown> | null;
  headline: string;
  about_summary: string;
  contact_meta: Record<string, unknown> | null;
  skills: unknown;
  languages: unknown;
  projects: unknown;
  experience: unknown;
  certifications: unknown;
  custom_sections: unknown;
  completeness_score: number;
  updated_at: string;
}

interface AcademicDbRow {
  full_name: string;
  avatar_url: string | null;
  institutional_email: string | null;
  phone: string | null;
  enrollment_id: string | null;
  grade_year: number | null;
  enrollment_status: string | null;
  section_letter: string | null;
  mencion_code: string | null;
  mencion_name: string | null;
  mencion_specialty: string | null;
  school_year_name: string | null;
  average_grade: string | number | null;
  used_ai_last_hour: number;
}

function defaultTemplateForMencion(mencionCode: string | null): PortfolioTemplateId {
  const norm = (mencionCode ?? "").toUpperCase();
  if (norm.includes("TEL") || norm.includes("INF")) return "ingenieria-telematica";
  if (norm.includes("ADU")) return "comercio-aduanas";
  if (norm.includes("TUR")) return "hospitalidad-turismo";
  return "tecnico-moderno";
}

function buildEmptyDraft(mencionCode: string | null): StudentPortfolioDraft {
  const tpl = defaultTemplateForMencion(mencionCode);
  return {
    templateId: tpl,
    designConfig: resolvePortfolioDesign(tpl),
    headline: "",
    aboutSummary: "",
    contactMeta: {
      city: "Puerto Ordaz, Estado Bolívar",
      availability: "",
      links: [],
    },
    skills: [],
    languages: [{ id: "lang-es", name: "Español", level: "Nativo" }],
    projects: [],
    experience: [],
    certifications: [],
    customSections: [],
    isPublic: false,
    publicSlug: "",
    privacySettings: {
      show_photo: true,
      show_email: false,
      show_phone: false,
      show_average: false,
      show_medals: true,
    },
  };
}

function hydrateDraftFromRow(
  row: PortfolioDbRow | null,
  mencionCode: string | null
): StudentPortfolioDraft {
  if (!row) return buildEmptyDraft(mencionCode);

  const rawTemplate = (row.template_id || "tecnico-moderno") as PortfolioTemplateId;
  const designConfig = resolvePortfolioDesign(
    rawTemplate,
    (row.design_config ?? {}) as Record<string, unknown>
  );

  const parsed = studentPortfolioDraftSchema.safeParse({
    templateId: rawTemplate,
    designConfig,
    headline: row.headline ?? "",
    aboutSummary: row.about_summary ?? "",
    contactMeta: row.contact_meta ?? {
      city: "Puerto Ordaz, Estado Bolívar",
      availability: "",
      links: [],
    },
    skills: Array.isArray(row.skills) ? row.skills : [],
    languages: Array.isArray(row.languages) ? row.languages : [],
    projects: Array.isArray(row.projects) ? row.projects : [],
    experience: Array.isArray(row.experience) ? row.experience : [],
    certifications: Array.isArray(row.certifications) ? row.certifications : [],
    customSections: Array.isArray(row.custom_sections) ? row.custom_sections : [],
    isPublic: Boolean(row.is_public),
    publicSlug: row.public_slug ?? "",
    privacySettings: row.privacy_settings ?? {
      show_photo: true,
      show_email: false,
      show_phone: false,
      show_average: false,
      show_medals: true,
    },
  });

  if (parsed.success) {
    return parsed.data;
  }

  return buildEmptyDraft(mencionCode);
}

/**
 * Carga en paralelo el portafolio guardado del estudiante, sus datos académicos
 * reales verificados en Neon y su cuota disponible del Coach IA.
 */
export async function getStudentPortfolioWorkspaceData(
  profile: DashboardUserProfile
): Promise<StudentPortfolioWorkspaceData> {
  const profileFullName = `${profile.firstName} ${profile.lastName}`.trim();
  const fallbackProfile: VerifiedStudentAcademicSnapshot = {
    fullName: profileFullName,
    avatarUrl: profile.avatarWebpUrl,
    institutionalEmail: profile.institutionalEmail,
    phone: profile.phone,
    mencionCode: null,
    mencionName: null,
    mencionSpecialty: null,
    gradeYear: null,
    sectionLetter: null,
    schoolYearName: null,
    enrollmentStatus: null,
    averageGrade: null,
    medalsUnlocked:
      profile.accessTier === "verified_workspace"
        ? [{ id: "workspace-verificado", title: "Identidad Institucional Verificada" }]
        : [],
    internshipHoursApproved: null,
  };

  if (!isNeonDatabaseConfigured()) {
    return {
      hasSavedPortfolio: false,
      verificationCode: null,
      updatedAt: null,
      draft: buildEmptyDraft(null),
      verifiedProfile: fallbackProfile,
      aiQuotaRemaining: 20,
      aiQuotaLimit: 20,
    };
  }

  try {
    return await withUserDb(
      { authUserId: profile.authUserId, email: profile.authEmail },
      async (client) => {
        const [academicRow, portfolioRow] = await Promise.all([
          querySingleRow<AcademicDbRow>(
            client,
            `SELECT trim(concat_ws(' ', u.first_name, u.last_name)) AS full_name,
                    u.avatar_webp_url AS avatar_url,
                    u.institutional_email,
                    u.phone,
                    en.id AS enrollment_id,
                    en.grade_year,
                    en.enrollment_status::text AS enrollment_status,
                    sec.section_letter,
                    m.code AS mencion_code,
                    m.name AS mencion_name,
                    m.specialty AS mencion_specialty,
                    sy.name AS school_year_name,
                    (
                      SELECT ROUND(AVG(mfg.final_numeric)::numeric, 2)
                        FROM public.moment_final_grades mfg
                       WHERE mfg.enrollment_id = en.id
                         AND mfg.final_numeric IS NOT NULL
                    ) AS average_grade,
                    (
                      SELECT COUNT(*)::int
                        FROM public.portfolio_ai_usage_logs l
                       WHERE l.user_id = u.id
                         AND l.created_at >= now() - interval '1 hour'
                         AND l.status IN ('pending', 'completed')
                    ) AS used_ai_last_hour
               FROM public.users u
               LEFT JOIN LATERAL (
                 SELECT e.id, e.grade_year, e.mencion_id, e.section_id, e.school_year_id, e.enrollment_status
                   FROM public.enrollments e
                   JOIN public.school_years syear ON syear.id = e.school_year_id
                  WHERE e.student_user_id = u.id
                    AND e.deleted_at IS NULL
                  ORDER BY syear.is_current DESC, syear.start_date DESC
                  LIMIT 1
               ) en ON true
               LEFT JOIN public.sections sec ON sec.id = en.section_id
               LEFT JOIN public.menciones m ON m.id = en.mencion_id
               LEFT JOIN public.school_years sy ON sy.id = en.school_year_id
              WHERE u.id = siga_internal.current_user_id()
              LIMIT 1`
          ),
          querySingleRow<PortfolioDbRow>(
            client,
            `SELECT sp.id,
                    sp.verification_code,
                    sp.public_slug,
                    sp.is_public,
                    sp.privacy_settings,
                    sp.template_id,
                    sp.design_config,
                    sp.headline,
                    sp.about_summary,
                    sp.contact_meta,
                    sp.skills,
                    sp.languages,
                    sp.projects,
                    sp.experience,
                    sp.certifications,
                    sp.custom_sections,
                    sp.completeness_score,
                    sp.updated_at::text AS updated_at
               FROM public.student_portfolios sp
              WHERE sp.student_user_id = siga_internal.current_user_id()
              LIMIT 1`
          ),
        ]);

        const avgNum =
          academicRow?.average_grade !== null &&
          academicRow?.average_grade !== undefined
            ? Number(academicRow.average_grade)
            : null;
        const safeAvg = avgNum !== null && Number.isFinite(avgNum) ? avgNum : null;

        const medalsUnlocked: Array<{ id: string; title: string }> = [];
        if (profile.accessTier === "verified_workspace") {
          medalsUnlocked.push({
            id: "workspace-verificado",
            title: "Identidad Institucional Verificada",
          });
        }
        if (safeAvg !== null && safeAvg >= 16) {
          medalsUnlocked.push({
            id: "cuadro-honor",
            title: "Cuadro de Honor (≥ 16 pts)",
          });
        }

        const verifiedProfile: VerifiedStudentAcademicSnapshot = {
          fullName: academicRow?.full_name?.trim() || profileFullName,
          avatarUrl: academicRow?.avatar_url ?? profile.avatarWebpUrl,
          institutionalEmail:
            academicRow?.institutional_email ?? profile.institutionalEmail,
          phone: academicRow?.phone ?? profile.phone,
          mencionCode: academicRow?.mencion_code ?? null,
          mencionName: academicRow?.mencion_name ?? null,
          mencionSpecialty: academicRow?.mencion_specialty ?? null,
          gradeYear: academicRow?.grade_year ?? null,
          sectionLetter: academicRow?.section_letter ?? null,
          schoolYearName: academicRow?.school_year_name ?? null,
          enrollmentStatus: academicRow?.enrollment_status ?? null,
          averageGrade: safeAvg,
          medalsUnlocked,
          internshipHoursApproved: null,
        };

        const used = academicRow?.used_ai_last_hour ?? 0;

        return {
          hasSavedPortfolio: Boolean(portfolioRow),
          verificationCode: portfolioRow?.verification_code ?? null,
          updatedAt: portfolioRow?.updated_at ?? null,
          draft: hydrateDraftFromRow(portfolioRow, verifiedProfile.mencionCode),
          verifiedProfile,
          aiQuotaRemaining: Math.max(0, 20 - used),
          aiQuotaLimit: 20,
        };
      }
    );
  } catch (err) {
    devWarn("portfolio-data", "Error cargando portafolio del estudiante", {
      detail: err instanceof Error ? err.message : String(err),
    });
    return {
      hasSavedPortfolio: false,
      verificationCode: null,
      updatedAt: null,
      draft: buildEmptyDraft(null),
      verifiedProfile: fallbackProfile,
      aiQuotaRemaining: 20,
      aiQuotaLimit: 20,
    };
  }
}

/**
 * Obtiene un portafolio público opt-in por slug vía RPC `anon` (cero PII ocultada).
 */
export async function getPublicPortfolioBySlug(
  slug: string
): Promise<PublicPortfolioViewData | null> {
  if (!isNeonDatabaseConfigured()) return null;
  const cleanSlug = slug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,46}[a-z0-9]$/.test(cleanSlug)) return null;

  try {
    const raw = await withAnonDb((client) =>
      callNeonRpcScalar<Record<string, unknown> | null>(
        client,
        "siga_public_get_portfolio_by_slug",
        { p_slug: cleanSlug }
      )
    );
    if (!raw || typeof raw !== "object") return null;

    const vp = (raw.verified_profile ?? {}) as Record<string, unknown>;
    const mencionCode =
      typeof vp.mencion_code === "string" ? vp.mencion_code : null;

    const hydrated = hydrateDraftFromRow(
      {
        id: "public",
        verification_code: String(raw.verification_code ?? ""),
        public_slug: String(raw.public_slug ?? cleanSlug),
        is_public: true,
        privacy_settings: (raw.privacy ?? {}) as Record<string, unknown>,
        template_id: String(raw.template_id ?? "tecnico-moderno"),
        design_config: (raw.design_config ?? {}) as Record<string, unknown>,
        headline: String(raw.headline ?? ""),
        about_summary: String(raw.about_summary ?? ""),
        contact_meta: (raw.contact_meta ?? {}) as Record<string, unknown>,
        skills: raw.skills,
        languages: raw.languages,
        projects: raw.projects,
        experience: raw.experience,
        certifications: raw.certifications,
        custom_sections: raw.custom_sections,
        completeness_score: Number(raw.completeness_score ?? 0),
        updated_at: String(raw.updated_at ?? new Date().toISOString()),
      },
      mencionCode
    );

    const avgVal =
      vp.average_grade !== null && vp.average_grade !== undefined
        ? Number(vp.average_grade)
        : null;

    return {
      verificationCode: String(raw.verification_code ?? ""),
      publicSlug: String(raw.public_slug ?? cleanSlug),
      updatedAt: String(raw.updated_at ?? new Date().toISOString()),
      completenessScore: Number(raw.completeness_score ?? 0),
      draft: hydrated,
      verifiedProfile: {
        fullName: String(vp.full_name ?? "Estudiante Bellista"),
        avatarUrl: typeof vp.avatar_url === "string" ? vp.avatar_url : null,
        institutionalEmail:
          typeof vp.institutional_email === "string" ? vp.institutional_email : null,
        phone: typeof vp.phone === "string" ? vp.phone : null,
        mencionCode,
        mencionName: typeof vp.mencion_name === "string" ? vp.mencion_name : null,
        mencionSpecialty:
          typeof vp.mencion_specialty === "string" ? vp.mencion_specialty : null,
        gradeYear: typeof vp.grade_year === "number" ? vp.grade_year : null,
        sectionLetter:
          typeof vp.section_letter === "string" ? vp.section_letter : null,
        schoolYearName:
          typeof vp.school_year_name === "string" ? vp.school_year_name : null,
        enrollmentStatus:
          typeof vp.enrollment_status === "string" ? vp.enrollment_status : null,
        averageGrade: avgVal !== null && Number.isFinite(avgVal) ? avgVal : null,
      },
    };
  } catch (err) {
    devWarn("portfolio-data", "Error consultando portafolio público", {
      detail: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
