import type { InstitutionalRoleCode } from "./auth-verification";
import type { DashboardUserProfile } from "./dashboard-session";

export type ExtendedActorRoleCode =
  | InstitutionalRoleCode
  | "tutor_empresarial_externo";

/**
 * Matriz canónica de Control de Acceso Basado en Roles (RBAC) por prefijo de ruta
 * dentro del monolito Next.js App Router de S.I.G.A.
 */
export const DASHBOARD_ROUTE_ACCESS: ReadonlyArray<{
  prefix: string;
  allowedRoles: readonly InstitutionalRoleCode[];
}> = [
  {
    prefix: "/control-estudios/orientacion",
    allowedRoles: ["orientacion", "direccion"],
  },
  {
    prefix: "/control-estudios",
    allowedRoles: ["control_estudios", "direccion"],
  },
  {
    prefix: "/analitica",
    allowedRoles: ["direccion", "control_estudios", "coordinador_mencion"],
  },
  {
    prefix: "/biblioteca",
    allowedRoles: ["biblioteca", "direccion", "estudiante", "docente"],
  },
  {
    prefix: "/pasantias",
    allowedRoles: [
      "coordinador_pasantias",
      "direccion",
      "docente",
      "estudiante",
    ],
  },
  {
    prefix: "/aula-virtual",
    allowedRoles: [
      "estudiante",
      "docente",
      "coordinador_mencion",
      "direccion",
    ],
  },
  {
    prefix: "/docente",
    allowedRoles: ["docente", "coordinador_mencion", "direccion"],
  },
  {
    prefix: "/estudiante",
    allowedRoles: ["estudiante", "direccion", "control_estudios"],
  },
];

export function canRoleAccessDashboardPath(
  role: InstitutionalRoleCode,
  pathname: string
): boolean {
  const cleanPath = pathname.split("?")[0] || "/";
  for (const rule of DASHBOARD_ROUTE_ACCESS) {
    if (
      cleanPath === rule.prefix ||
      cleanPath.startsWith(`${rule.prefix}/`)
    ) {
      return rule.allowedRoles.includes(role);
    }
  }
  return true;
}

export function assertAuthorizedRole(
  profile: Pick<DashboardUserProfile, "primaryRole" | "accessTier">,
  allowedRoles: readonly InstitutionalRoleCode[],
  options?: { requireVerifiedWorkspace?: boolean }
): { ok: true } | { ok: false; message: string } {
  if (profile.accessTier === "suspended") {
    return {
      ok: false,
      message: "Tu cuenta institucional se encuentra temporalmente suspendida.",
    };
  }

  if (
    options?.requireVerifiedWorkspace &&
    profile.accessTier !== "verified_workspace"
  ) {
    return {
      ok: false,
      message:
        "Esta operación requiere vincular tu cuenta institucional @etcandresbello.org.",
    };
  }

  if (!allowedRoles.includes(profile.primaryRole)) {
    return {
      ok: false,
      message:
        "No cuentas con los permisos institucionales requeridos para realizar esta acción.",
    };
  }

  return { ok: true };
}
