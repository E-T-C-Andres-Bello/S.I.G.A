import { unstable_cache } from "next/cache";
import { isNeonDatabaseConfigured, withServiceDb } from "./neon";

export interface CachedMencionRow {
  id: string;
  code: string;
  name: string;
  specialty: string | null;
  description: string | null;
}

export interface CachedCurriculumSubjectRow {
  id: string;
  mencion_id: string;
  grade_year: number;
  weekly_hours: number;
  annual_hours: number | null;
  curriculum_component: string | null;
  display_order: number | null;
  subjects: {
    id: string;
    code: string;
    name: string;
    grading_scale: "NUMERIC_1_20" | "LITERAL_A_E";
    passing_threshold: number;
    is_technical_core: boolean;
  };
}

export interface AcademicCatalogSnapshot {
  menciones: CachedMencionRow[];
  curriculumRows: CachedCurriculumSubjectRow[];
}

const fetchCatalogFromNeon = unstable_cache(
  async (): Promise<AcademicCatalogSnapshot> => {
    if (!isNeonDatabaseConfigured()) {
      return { menciones: [], curriculumRows: [] };
    }

    return withServiceDb(async (client) => {
      const res = await client.query<{
        menciones_json: CachedMencionRow[] | null;
        curriculum_json: CachedCurriculumSubjectRow[] | null;
      }>(
        `SELECT
           COALESCE(
             (
               SELECT json_agg(m_row ORDER BY m_row.name ASC)
                 FROM (
                   SELECT id, code, name, specialty, description
                     FROM public.menciones
                    WHERE is_active = true
                 ) m_row
             ),
             '[]'::json
           ) AS menciones_json,
           COALESCE(
             (
               SELECT json_agg(c_row ORDER BY c_row.display_order ASC)
                 FROM (
                   SELECT cs.id,
                          cs.mencion_id,
                          cs.grade_year,
                          cs.weekly_hours,
                          cs.annual_hours,
                          cs.curriculum_component,
                          cs.display_order,
                          json_build_object(
                            'id', s.id,
                            'code', s.code,
                            'name', s.name,
                            'grading_scale', s.grading_scale,
                            'passing_threshold', s.passing_threshold,
                            'is_technical_core', s.is_technical_core
                          ) AS subjects
                     FROM public.curriculum_subjects cs
                     JOIN public.subjects s ON s.id = cs.subject_id
                    WHERE cs.is_active = true
                 ) c_row
             ),
             '[]'::json
           ) AS curriculum_json`
      );

      const row = res.rows[0];
      return {
        menciones: row?.menciones_json ?? [],
        curriculumRows: row?.curriculum_json ?? [],
      };
    });
  },
  ["siga-academic-catalog-v1"],
  {
    revalidate: 600,
    tags: ["siga-catalogs"],
  }
);

/**
 * Devuelve los catálogos académicos públicos (menciones y malla curricular MPPE)
 * cacheados en servidor durante 10 minutos (0 PII, 0 viajes extra a Neon por visita).
 */
export async function getCachedAcademicCatalog(): Promise<AcademicCatalogSnapshot> {
  return fetchCatalogFromNeon();
}
