import type { DashboardUserProfile } from "@/lib/auth/dashboard-session";
import { getCachedAcademicCatalog } from "@/lib/db/catalog-cache";
import {
  callNeonRpcTable,
  callNeonRpcTableSafe,
  withUserDb,
} from "@/lib/db/neon";
import {
  ANNOUNCEMENT_CATEGORIES,
  resolveAnnouncementPalette,
  type AnnouncementCategory,
  type SchoolAnnouncementItem,
} from "@/lib/validators/bulletin";

interface AnnouncementRpcRow {
  id: string;
  title: string;
  short_note: string;
  body: string;
  category: string;
  target_mencion_id: string | null;
  target_mencion_code: string | null;
  target_mencion_name: string | null;
  target_grade_year: number | null;
  event_date: string | null;
  location_label: string | null;
  cover_webp_url: string | null;
  theme_palette: unknown;
  is_pinned: boolean;
  is_published: boolean;
  published_at: string;
  expires_at: string | null;
  created_by: string;
  author_name: string | null;
  author_department?: string | null;
  can_edit?: boolean;
  read_count: number;
  has_read: boolean;
  read_at: string | null;
  updated_at?: string | null;
}

export interface BulletinMentionOption {
  id: string;
  code: string;
  name: string;
}

export interface SchoolBulletinData {
  items: SchoolAnnouncementItem[];
  canPublish: boolean;
  isDireccion: boolean;
  isGlobalEditor: boolean;
  isCoordPasantias: boolean;
  restrictedMencionId: string | null;
  restrictedMencionName: string | null;
  allowedGradeYears: number[] | null;
  departmentLabel: string;
  menciones: BulletinMentionOption[];
}

const VALID_CATEGORY_SET = new Set<string>(ANNOUNCEMENT_CATEGORIES);

function normalizeCategory(raw: string): AnnouncementCategory {
  return VALID_CATEGORY_SET.has(raw) ? (raw as AnnouncementCategory) : "evento";
}

function mapAnnouncementRow(row: AnnouncementRpcRow): SchoolAnnouncementItem {
  const category = normalizeCategory(row.category);
  return {
    id: row.id,
    title: row.title,
    shortNote: row.short_note,
    body: row.body,
    category,
    targetMencionId: row.target_mencion_id,
    targetMencionCode: row.target_mencion_code,
    targetMencionName: row.target_mencion_name,
    targetGradeYear:
      typeof row.target_grade_year === "number" ? row.target_grade_year : null,
    eventDate: row.event_date,
    locationLabel: row.location_label,
    coverWebpUrl: row.cover_webp_url,
    themePalette: resolveAnnouncementPalette(
      row.theme_palette,
      category,
      row.target_mencion_code
    ),
    isPinned: Boolean(row.is_pinned),
    isPublished: Boolean(row.is_published),
    publishedAt: row.published_at,
    expiresAt: row.expires_at,
    createdBy: row.created_by,
    authorName: row.author_name?.trim() || 'E.T.C. "Andrés Bello"',
    authorDepartment: row.author_department?.trim() || "Dirección",
    canEdit: Boolean(row.can_edit),
    readCount: Math.max(0, Number(row.read_count ?? 0)),
    hasRead: Boolean(row.has_read),
    readAt: row.read_at,
    updatedAt: row.updated_at ?? row.published_at,
  };
}

export async function getSchoolBulletinData(
  profile: DashboardUserProfile,
  options?: { includeEditorial?: boolean; limit?: number }
): Promise<SchoolBulletinData> {
  const limit = options?.limit ?? 60;
  const includeEditorial = options?.includeEditorial ?? true;

  return withUserDb(
    { authUserId: profile.authUserId, email: profile.authEmail },
    async (client) => {
      let isDireccion = false;
      let isControlEstudios = false;
      let isCoordPasantias = false;
      let coordMencionId: string | null = null;
      let departmentLabel = 'E.T.C. "Andrés Bello"';

      await client.query("SAVEPOINT siga_bulletin_perms");
      try {
        const permRes = await client.query<{
          is_direccion: boolean;
          is_control_estudios: boolean;
          is_coord_pasantias: boolean;
          coord_mencion_id: string | null;
          department_label: string;
        }>(
          `SELECT
             siga_internal.has_any_role(ARRAY['direccion']) AS is_direccion,
             siga_internal.has_any_role(ARRAY['control_estudios']) AS is_control_estudios,
             siga_internal.has_any_role(ARRAY['coordinador_pasantias']) AS is_coord_pasantias,
             siga_internal.current_coord_mencion_id() AS coord_mencion_id,
             siga_internal.resolve_bulletin_department_label() AS department_label`
        );
        await client.query("RELEASE SAVEPOINT siga_bulletin_perms");
        const row = permRes.rows[0];
        isDireccion = Boolean(row?.is_direccion);
        isControlEstudios = Boolean(row?.is_control_estudios);
        isCoordPasantias = Boolean(row?.is_coord_pasantias);
        coordMencionId = row?.coord_mencion_id ?? null;
        if (row?.department_label) {
          departmentLabel = row.department_label;
        }
      } catch {
        await client.query("ROLLBACK TO SAVEPOINT siga_bulletin_perms");
        await client.query("RELEASE SAVEPOINT siga_bulletin_perms");
      }

      const isGlobalEditor = isDireccion || isControlEstudios;
      const canPublish =
        isGlobalEditor || coordMencionId !== null || isCoordPasantias;
      const restrictedMencionId =
        isGlobalEditor || isCoordPasantias ? null : coordMencionId;
      const allowedGradeYears =
        !isGlobalEditor && coordMencionId === null && isCoordPasantias
          ? [5, 6]
          : null;

      const rows = await callNeonRpcTableSafe<AnnouncementRpcRow>(
        client,
        "siga_get_school_announcements",
        {
          p_include_editorial: includeEditorial && canPublish,
          p_limit: limit,
        }
      );

      let menciones: BulletinMentionOption[] = [];
      if (canPublish) {
        const catalog = await getCachedAcademicCatalog();
        menciones = catalog.menciones.map((m) => ({
          id: m.id,
          code: m.code,
          name: m.name,
        }));
      }

      const restrictedMencionName = restrictedMencionId
        ? menciones.find((m) => m.id === restrictedMencionId)?.name ?? null
        : null;

      return {
        items: rows.map(mapAnnouncementRow),
        canPublish,
        isDireccion,
        isGlobalEditor,
        isCoordPasantias,
        restrictedMencionId,
        restrictedMencionName,
        allowedGradeYears,
        departmentLabel,
        menciones,
      };
    }
  );
}

/**
 * Consulta liviana para alimentar el abanico interactivo en el dashboard `/estudiante`
 * (compatible con cuentas `verified_workspace` y `provisional_cedula`) en 1 sola consulta sin SAVEPOINTs extra.
 */
export async function getDashboardBulletinHighlights(
  profile: DashboardUserProfile,
  limit = 9
): Promise<SchoolAnnouncementItem[]> {
  try {
    return await withUserDb(
      { authUserId: profile.authUserId, email: profile.authEmail },
      async (client) => {
        const rows = await callNeonRpcTable<AnnouncementRpcRow>(
          client,
          "siga_get_school_announcements",
          {
            p_include_editorial: false,
            p_limit: limit,
          }
        );
        return rows.map(mapAnnouncementRow);
      }
    );
  } catch {
    return [];
  }
}
