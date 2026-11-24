"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  GraduationCap,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Moon,
  Palette,
  Phone,
  QrCode,
  RotateCcw,
  Save,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  User,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import {
  COLOR_PALETTES,
  GLASS_PRESETS,
  useGlassTheme,
  type ColorPaletteId,
} from "@/components/dashboard/GlassThemeContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  StudentProfileAuditEntry,
  StudentProfilePageData,
} from "@/features/estudiante/profile-data";
import {
  updateStudentProfileContactAction,
} from "@/features/estudiante/student-actions";
import { authClient } from "@/lib/auth/client";
import {
  enrollInstitutionalPasskey,
  isBrowserPasskeySupported,
  listInstitutionalPasskeys,
  unenrollInstitutionalPasskey,
  type PasskeyFactorSummary,
} from "@/lib/auth/passkeys";
import { compressImageToWebpClient } from "@/lib/storage/media-optimizer";
import { formatVenezuelanCedulaDisplay } from "@/lib/validators/auth";
import {
  studentPasswordChangeSchema,
  studentProfileContactSchema,
} from "@/lib/validators/student-portal";

export type StudentProfileTab =
  | "identidad"
  | "contacto"
  | "seguridad"
  | "preferencias";

export interface StudentProfileViewProps {
  data: StudentProfilePageData;
  initialSection?: StudentProfileTab;
}

const SIDEBAR_STORAGE_KEY = "siga-sidebar-expanded-v1";

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  pre_enrolled: "Preinscrito",
  active: "Estudiante regular activo",
  promoted: "Promovido",
  withdrawn: "Retirado",
  graduated: "Egresado",
};

const AUDIT_ACTION_LABELS: Record<StudentProfileAuditEntry["action"], string> = {
  profile_contact_updated: "Datos de contacto actualizados",
  avatar_updated: "Fotografía de perfil actualizada",
  avatar_removed: "Fotografía de perfil retirada",
};

const AUDIT_FIELD_LABELS: Record<string, string> = {
  phone: "teléfono",
  recovery_email: "correo de respaldo",
  emergency_contact: "contacto de emergencia",
  avatar_webp_url: "fotografía institucional",
};

function formatDateVe(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-VE", {
      timeZone: "America/Caracas",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function formatBytesKb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Perfil y Configuración del Estudiante (`/estudiante/perfil`):
 * - Identidad y Foto (datos oficiales en solo lectura + fotografía .webp sincronizada con Carnet QR)
 * - Contacto y Emergencia (teléfono, correo de respaldo y contacto de emergencia auditados)
 * - Seguridad (Google Workspace, cambio de contraseña, llaves biométricas y cierre en otros dispositivos)
 * - Preferencias de interfaz (tema claro/oscuro, efecto Glassmorphism y barra lateral)
 */
export function StudentProfileView({
  data,
  initialSection = "identidad",
}: StudentProfileViewProps) {
  const router = useRouter();
  const {
    settings,
    applyPreset,
    setOpacityPct,
    setBlurPx,
    setPalette,
    resetDefaults,
  } = useGlassTheme();

  const isVerified = data.accessTier === "verified_workspace";
  const fullName = `${data.firstName} ${data.lastName}`.trim();
  const formattedCedula = formatVenezuelanCedulaDisplay(data.cedula);
  const initials =
    `${data.firstName.charAt(0)}${data.lastName.charAt(0)}`.toUpperCase();

  const [activeTab, setActiveTab] =
    React.useState<StudentProfileTab>(initialSection);

  // Estado de fotografía (.webp)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const avatarLockRef = React.useRef(false);
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(
    data.avatarWebpUrl
  );
  const [avatarBusy, setAvatarBusy] = React.useState(false);
  const [lastCompressionInfo, setLastCompressionInfo] = React.useState<
    string | null
  >(null);

  // Estado de formulario Contacto y Emergencia
  const contactLockRef = React.useRef(false);
  const [phone, setPhone] = React.useState(data.phone ?? "");
  const [recoveryEmail, setRecoveryEmail] = React.useState(
    data.recoveryEmail ?? ""
  );
  const [emergencyName, setEmergencyName] = React.useState(
    data.enrollment?.emergencyContactName ?? ""
  );
  const [emergencyCedula, setEmergencyCedula] = React.useState(
    data.enrollment?.emergencyContactCedula
      ? formatVenezuelanCedulaDisplay(data.enrollment.emergencyContactCedula)
      : ""
  );
  const [emergencyPhone, setEmergencyPhone] = React.useState(
    data.enrollment?.emergencyContactPhone ?? ""
  );
  const [emergencyRelationship, setEmergencyRelationship] = React.useState(
    data.enrollment?.emergencyContactRelationship ?? ""
  );
  const [contactSaving, setContactSaving] = React.useState(false);
  const [contactError, setContactError] = React.useState<string | null>(null);

  // Estado de Seguridad (contraseña, Passkeys, otras sesiones)
  const passwordLockRef = React.useRef(false);
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [passwordSaving, setPasswordSaving] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);

  const passkeyLockRef = React.useRef(false);
  const [passkeySupported, setPasskeySupported] = React.useState<
    boolean | null
  >(null);
  const [passkeys, setPasskeys] = React.useState<PasskeyFactorSummary[]>([]);
  const [passkeysLoading, setPasskeysLoading] = React.useState(false);
  const [passkeyDeviceName, setPasskeyDeviceName] = React.useState(
    "Mi dispositivo personal"
  );
  const [passkeyBusyId, setPasskeyBusyId] = React.useState<string | null>(null);

  const sessionsLockRef = React.useRef(false);
  const [signingOutOthers, setSigningOutOthers] = React.useState(false);

  // Estado de Preferencias de interfaz
  const [isDark, setIsDark] = React.useState(false);
  const [sidebarExpandedPref, setSidebarExpandedPref] = React.useState(false);

  React.useEffect(() => {
    setAvatarUrl(data.avatarWebpUrl);
  }, [data.avatarWebpUrl]);

  React.useEffect(() => {
    const syncPrefs = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
      try {
        setSidebarExpandedPref(
          window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true"
        );
      } catch {
        // Ignorar si el almacenamiento local está restringido.
      }
    };
    syncPrefs();
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  React.useEffect(() => {
    if (!isVerified) {
      setPasskeySupported(false);
      return;
    }
    let cancelled = false;
    setPasskeysLoading(true);
    Promise.all([isBrowserPasskeySupported(), listInstitutionalPasskeys()])
      .then(([supported, factors]) => {
        if (cancelled) return;
        setPasskeySupported(supported);
        setPasskeys(factors);
      })
      .finally(() => {
        if (!cancelled) setPasskeysLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isVerified]);

  const handleTabChange = React.useCallback((next: string) => {
    const resolved: StudentProfileTab =
      next === "contacto" || next === "seguridad" || next === "preferencias"
        ? next
        : "identidad";
    setActiveTab(resolved);
    try {
      const nextUrl = new URL(window.location.href);
      if (resolved === "identidad") {
        nextUrl.searchParams.delete("seccion");
      } else {
        nextUrl.searchParams.set("seccion", resolved);
      }
      window.history.replaceState(null, "", nextUrl.toString());
    } catch {
      // Ignorar si history API está restringida.
    }
  }, []);

  // Subida y compresión .webp de fotografía de perfil/carnet
  const handleAvatarFileSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || avatarLockRef.current) return;

    if (!data.authUserId) {
      toast.error("No se pudo validar tu sesión. Recarga la página e intenta de nuevo.");
      return;
    }

    avatarLockRef.current = true;
    setAvatarBusy(true);

    try {
      const compressed = await compressImageToWebpClient(file, {
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.84,
        maxOutputBytes: 512 * 1024,
      });

      const formData = new FormData();
      formData.append("file", compressed.file);

      const uploadRes = await fetch("/api/estudiante/avatar", {
        method: "POST",
        body: formData,
      });

      const uploadJson = (await uploadRes.json().catch(() => ({}))) as {
        ok?: boolean;
        avatarWebpUrl?: string | null;
        message?: string;
      };

      if (!uploadRes.ok || !uploadJson.ok) {
        toast.error(
          uploadJson.message ??
            "No se pudo subir la fotografía en este momento. Verifica tu conexión e inténtalo de nuevo."
        );
        return;
      }

      setAvatarUrl(uploadJson.avatarWebpUrl ?? null);
      setLastCompressionInfo(
        `Optimizada automáticamente: ${formatBytesKb(compressed.originalBytes)} → ${formatBytesKb(compressed.compressedBytes)} (${compressed.width}×${compressed.height} px)`
      );
      toast.success(
        "Fotografía actualizada y sincronizada con tu Carnet Digital QR."
      );
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "No se pudo procesar la imagen seleccionada."
      );
    } finally {
      avatarLockRef.current = false;
      setAvatarBusy(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!avatarUrl || avatarLockRef.current) return;
    avatarLockRef.current = true;
    setAvatarBusy(true);

    try {
      const res = await fetch("/api/estudiante/avatar", {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };

      if (!res.ok || !json.ok) {
        toast.error(
          json.message ?? "No se pudo retirar la fotografía en este momento."
        );
        return;
      }

      setAvatarUrl(null);
      setLastCompressionInfo(null);
      toast.success("Fotografía retirada. Se mostrarán tus iniciales institucionales.");
      router.refresh();
    } finally {
      avatarLockRef.current = false;
      setAvatarBusy(false);
    }
  };

  // Guardar Contacto y Emergencia
  const handleSaveContact = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (contactLockRef.current) return;

    const payload = {
      phone,
      recoveryEmail,
      emergencyContactName: emergencyName,
      emergencyContactCedula: emergencyCedula,
      emergencyContactPhone: emergencyPhone,
      emergencyContactRelationship: emergencyRelationship,
    };

    const parsed = studentProfileContactSchema.safeParse(payload);
    if (!parsed.success) {
      const msg =
        parsed.error.issues[0]?.message ??
        "Revisa los campos de contacto antes de guardar.";
      setContactError(msg);
      toast.error(msg);
      return;
    }

    setContactError(null);
    contactLockRef.current = true;
    setContactSaving(true);

    try {
      const result = await updateStudentProfileContactAction(payload);
      if (!result.ok) {
        setContactError(result.message);
        toast.error(result.message);
        return;
      }

      if (result.data.emergencyContactCedula) {
        setEmergencyCedula(
          formatVenezuelanCedulaDisplay(result.data.emergencyContactCedula)
        );
      }

      toast.success(
        result.data.changedFields.length > 0
          ? "Datos de contacto y emergencia guardados correctamente."
          : "No había cambios nuevos por guardar."
      );
      router.refresh();
    } finally {
      contactLockRef.current = false;
      setContactSaving(false);
    }
  };

  // Cambio de contraseña
  const handleChangePassword = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (passwordLockRef.current) return;

    const parsed = studentPasswordChangeSchema.safeParse({
      newPassword,
      confirmPassword,
    });
    if (!parsed.success) {
      const msg =
        parsed.error.issues[0]?.message ??
        "Revisa los requisitos de tu nueva contraseña.";
      setPasswordError(msg);
      toast.error(msg);
      return;
    }

    setPasswordError(null);
    passwordLockRef.current = true;
    setPasswordSaving(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: parsed.data.newPassword }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };

      if (!res.ok || !json.ok) {
        const friendly =
          json.message ??
          "No se pudo actualizar la contraseña en este momento. Intenta iniciar sesión nuevamente.";
        setPasswordError(friendly);
        toast.error(friendly);
        return;
      }

      setNewPassword("");
      setConfirmPassword("");
      toast.success("Tu contraseña se actualizó correctamente.");
    } finally {
      passwordLockRef.current = false;
      setPasswordSaving(false);
    }
  };

  // Llaves biométricas (Passkeys)
  const handleEnrollPasskey = async () => {
    if (passkeyLockRef.current || !isVerified) return;
    passkeyLockRef.current = true;
    setPasskeyBusyId("new");

    try {
      const label = passkeyDeviceName.trim() || "Dispositivo Biométrico S.I.G.A.";
      const res = await enrollInstitutionalPasskey(label);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      const refreshed = await listInstitutionalPasskeys();
      setPasskeys(refreshed);
      toast.success("Llave biométrica registrada correctamente.");
    } finally {
      passkeyLockRef.current = false;
      setPasskeyBusyId(null);
    }
  };

  const handleRemovePasskey = async (factorId: string) => {
    if (passkeyLockRef.current || !isVerified) return;
    passkeyLockRef.current = true;
    setPasskeyBusyId(factorId);

    try {
      const res = await unenrollInstitutionalPasskey(factorId);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setPasskeys((prev) => prev.filter((item) => item.id !== factorId));
      toast.success("Llave biométrica eliminada de tu cuenta.");
    } finally {
      passkeyLockRef.current = false;
      setPasskeyBusyId(null);
    }
  };

  // Cerrar sesiones en otros dispositivos
  const handleSignOutOtherDevices = async () => {
    if (sessionsLockRef.current) return;

    sessionsLockRef.current = true;
    setSigningOutOthers(true);
    try {
      const result = await authClient.revokeOtherSessions();
      if (result?.error) {
        toast.error(
          "No se pudieron cerrar las sesiones en otros dispositivos. Intenta nuevamente."
        );
        return;
      }
      toast.success("Se cerraron todas tus sesiones abiertas en otros dispositivos.");
    } finally {
      sessionsLockRef.current = false;
      setSigningOutOthers(false);
    }
  };

  // Preferencias visuales
  const handleSetTheme = (mode: "light" | "dark") => {
    const nextDark = mode === "dark";
    document.documentElement.classList.toggle("dark", nextDark);
    setIsDark(nextDark);
    try {
      window.localStorage.setItem("siga-theme", mode);
    } catch {
      // Ignorar si el almacenamiento local está restringido.
    }
    toast.success(
      nextDark ? "Tema oscuro activado." : "Tema claro activado."
    );
  };

  const handleSelectPalette = (paletteId: ColorPaletteId, label: string) => {
    setPalette(paletteId);
    toast.success(`Paleta «${label}» aplicada en todo el portal.`);
  };

  const handleResetVisualDefaults = () => {
    resetDefaults();
    toast.success("Apariencia restablecida a Cobalto Andrés Bello y Glass.");
  };

  const handleToggleSidebarPref = (expanded: boolean) => {
    setSidebarExpandedPref(expanded);
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(expanded));
    } catch {
      // Ignorar si el almacenamiento local está restringido.
    }
    toast.success(
      expanded
        ? "La barra lateral se abrirá expandida por defecto."
        : "La barra lateral se mantendrá compacta por defecto."
    );
  };

  const passwordHasMinLength = newPassword.length >= 8;
  const passwordHasMixedCase =
    /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword);
  const passwordHasNumber = /[0-9]/.test(newPassword);
  const passwordMatches =
    confirmPassword.length > 0 && newPassword === confirmPassword;

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="font-hero flex flex-col gap-5 pb-8"
    >
      {/* Cabecera y selector de pestañas */}
      <header className="flex flex-col justify-between gap-3.5 xl:flex-row xl:items-end">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] leading-tight font-normal tracking-[-0.03em] text-foreground sm:text-[2.1rem]">
            Mi Perfil y Configuración
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
            Administra tu fotografía institucional, datos de contacto, seguridad
            de acceso y apariencia del portal.
          </p>
        </div>

        <TabsList className="siga-glass-surface grid w-full shrink-0 grid-cols-2 gap-1 rounded-2xl border p-1 group-data-[orientation=horizontal]/tabs:h-auto sm:inline-flex sm:w-fit sm:flex-nowrap">
          <TabsTrigger
            value="identidad"
            className="h-auto flex-none cursor-pointer rounded-xl px-3 py-2 text-xs font-medium"
          >
            <User data-icon="inline-start" aria-hidden="true" />
            Identidad y Foto
          </TabsTrigger>
          <TabsTrigger
            value="contacto"
            className="h-auto flex-none cursor-pointer rounded-xl px-3 py-2 text-xs font-medium"
          >
            <Phone data-icon="inline-start" aria-hidden="true" />
            Contacto y Emergencia
          </TabsTrigger>
          <TabsTrigger
            value="seguridad"
            className="h-auto flex-none cursor-pointer rounded-xl px-3 py-2 text-xs font-medium"
          >
            <Shield data-icon="inline-start" aria-hidden="true" />
            Seguridad
          </TabsTrigger>
          <TabsTrigger
            value="preferencias"
            className="h-auto flex-none cursor-pointer rounded-xl px-3 py-2 text-xs font-medium"
          >
            <Palette data-icon="inline-start" aria-hidden="true" />
            Preferencias
          </TabsTrigger>
        </TabsList>
      </header>

      {/* Hero resumen de identidad estudiantil */}
      <section
        aria-label="Resumen de identidad del estudiante"
        className="siga-glass-hero relative overflow-hidden rounded-[28px] border p-5 text-white shadow-lg sm:p-6"
      >
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/55 bg-[#0b1d59]/80 shadow-md">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={`Fotografía de ${fullName}`}
                  className="size-full object-cover"
                />
              ) : (
                <span className="font-kpi-num text-2xl font-light text-white">
                  {initials || "AB"}
                </span>
              )}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute right-1.5 bottom-1.5 size-3 rounded-full ring-2 ring-[#0b1d59]",
                  isVerified ? "bg-emerald-400" : "bg-amber-400"
                )}
              />
            </div>

            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-sky-100">
                  {isVerified ? (
                    <>
                      <ShieldCheck className="size-3.5" aria-hidden="true" />
                      Cuenta institucional verificada
                    </>
                  ) : (
                    <>
                      <AlertCircle className="size-3.5" aria-hidden="true" />
                      Acceso provisional por cédula
                    </>
                  )}
                </span>
                {data.enrollment ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-100 tabular-nums">
                    <GraduationCap className="size-3.5" aria-hidden="true" />
                    {data.enrollment.gradeYear}.º Año
                    {data.enrollment.sectionLetter
                      ? ` · Sec. ${data.enrollment.sectionLetter}`
                      : ""}
                  </span>
                ) : null}
              </div>

              <h2 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {fullName}
              </h2>

              <p className="text-xs text-sky-100/85 tabular-nums">
                Cédula {formattedCedula}
                {data.enrollment?.mencionName
                  ? ` · Mención ${data.enrollment.mencionName}`
                  : ""}
                {data.enrollment?.mencionSpecialty
                  ? ` (${data.enrollment.mencionSpecialty})`
                  : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 md:justify-end">
            {isVerified ? (
              <Button
                asChild
                size="sm"
                className="rounded-xl border border-white/25 bg-white text-slate-900 hover:bg-sky-50"
              >
                <Link href="/estudiante?tab=carnet">
                  <QrCode data-icon="inline-start" aria-hidden="true" />
                  Ver Carnet Digital QR
                </Link>
              </Button>
            ) : (
              <Button
                asChild
                size="sm"
                className="rounded-xl border border-white/25 bg-white text-slate-900 hover:bg-sky-50"
              >
                <Link href="/estudiante">
                  <ShieldCheck data-icon="inline-start" aria-hidden="true" />
                  Activar cuenta institucional
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ==================== PESTAÑA 1: IDENTIDAD Y FOTO ==================== */}
      <TabsContent value="identidad" className="mt-0">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Bloque Fotografía de perfil y carnet */}
          <section
            aria-label="Fotografía de perfil y Carnet Digital"
            className="siga-glass-surface flex flex-col justify-between gap-5 rounded-[28px] border p-5 sm:p-6 lg:col-span-5"
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                    Fotografía institucional
                  </h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Se sincroniza automáticamente con tu avatar superior y tu
                    Carnet Digital QR.
                  </p>
                </div>
                <span className="siga-glass-inner flex size-9 shrink-0 items-center justify-center rounded-xl border text-primary dark:text-sky-300">
                  <Camera className="size-4" aria-hidden="true" />
                </span>
              </div>

              <div className="siga-glass-inner flex flex-col items-center gap-4 rounded-2xl border p-5 text-center">
                <div className="relative flex size-32 items-center justify-center overflow-hidden rounded-2xl border-2 border-primary/25 bg-gradient-to-br from-[#1c47c4] to-[#0b1d59] shadow-sm">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt={`Foto institucional de ${fullName}`}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="font-kpi-num text-3xl font-light text-white">
                      {initials || "AB"}
                    </span>
                  )}
                  {avatarBusy ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px]">
                      <Loader2
                        className="size-6 animate-spin text-white"
                        aria-hidden="true"
                      />
                    </div>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    {avatarUrl
                      ? "Fotografía activa en tu perfil y carnet"
                      : "Aún no has cargado una fotografía"}
                  </p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Acepta JPG, PNG o WebP. Se optimiza automáticamente en tu
                    navegador antes de guardarse.
                  </p>
                  {lastCompressionInfo ? (
                    <p
                      aria-live="polite"
                      className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
                    >
                      {lastCompressionInfo}
                    </p>
                  ) : null}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={handleAvatarFileSelected}
                  className="sr-only"
                  aria-label="Seleccionar fotografía de perfil"
                />

                <div className="flex w-full flex-wrap items-center justify-center gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    disabled={avatarBusy}
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl text-xs"
                  >
                    {avatarBusy ? (
                      <Loader2
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <Upload data-icon="inline-start" aria-hidden="true" />
                    )}
                    {avatarUrl ? "Cambiar fotografía" : "Subir fotografía"}
                  </Button>

                  {avatarUrl ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={avatarBusy}
                      onClick={handleRemoveAvatar}
                      className="rounded-xl text-xs text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-300"
                    >
                      <Trash2 data-icon="inline-start" aria-hidden="true" />
                      Quitar foto
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/45 p-3.5 text-[11.5px] leading-relaxed text-muted-foreground">
              <strong className="font-semibold text-foreground">
                Recomendación escolar:
              </strong>{" "}
              usa una fotografía nítida de frente con fondo claro y uniforme
              institucional para facilitar tu identificación en Biblioteca y
              portón.
            </div>
          </section>

          {/* Bloque Datos oficiales en solo lectura */}
          <section
            aria-label="Ficha de identidad oficial del estudiante"
            className="siga-glass-surface flex flex-col justify-between gap-5 rounded-[28px] border p-5 sm:p-6 lg:col-span-7"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                    Datos oficiales del expediente
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Información validada y administrada por Control de Estudios
                    y Secretaría.
                  </p>
                </div>
                <Badge variant="secondary" className="gap-1 rounded-full">
                  <Lock className="size-3" aria-hidden="true" />
                  Solo lectura
                </Badge>
              </div>

              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="siga-glass-inner rounded-2xl border p-3.5">
                  <dt className="text-[11px] text-muted-foreground">Nombres</dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground">
                    {data.firstName}
                  </dd>
                </div>
                <div className="siga-glass-inner rounded-2xl border p-3.5">
                  <dt className="text-[11px] text-muted-foreground">
                    Apellidos
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground">
                    {data.lastName}
                  </dd>
                </div>
                <div className="siga-glass-inner rounded-2xl border p-3.5">
                  <dt className="text-[11px] text-muted-foreground">
                    Cédula de identidad
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground tabular-nums">
                    {formattedCedula}
                  </dd>
                </div>
                <div className="siga-glass-inner rounded-2xl border p-3.5">
                  <dt className="text-[11px] text-muted-foreground">
                    Correo institucional
                  </dt>
                  <dd className="mt-1 truncate text-sm font-semibold text-foreground">
                    {data.institutionalEmail ?? "Pendiente de activación"}
                  </dd>
                </div>
                <div className="siga-glass-inner rounded-2xl border p-3.5">
                  <dt className="text-[11px] text-muted-foreground">
                    Especialidad y mención
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground">
                    {data.enrollment?.mencionName
                      ? `${data.enrollment.mencionName}${data.enrollment.mencionSpecialty ? ` · ${data.enrollment.mencionSpecialty}` : ""}`
                      : "Sin matrícula activa"}
                  </dd>
                </div>
                <div className="siga-glass-inner rounded-2xl border p-3.5">
                  <dt className="text-[11px] text-muted-foreground">
                    Año, sección y período
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground tabular-nums">
                    {data.enrollment
                      ? `${data.enrollment.gradeYear}.º Año${data.enrollment.sectionLetter ? ` · Sección ${data.enrollment.sectionLetter}` : ""}${data.enrollment.schoolYearName ? ` · ${data.enrollment.schoolYearName}` : ""}`
                      : "Por asignar"}
                  </dd>
                </div>
              </dl>

              {data.enrollment ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 bg-background/45 px-4 py-3 text-xs">
                  <span className="text-muted-foreground">
                    Estatus de matrícula actual
                  </span>
                  <Badge variant="outline" className="font-medium">
                    {ENROLLMENT_STATUS_LABELS[data.enrollment.enrollmentStatus] ??
                      "Activa"}
                  </Badge>
                </div>
              ) : null}
            </div>

            <div className="space-y-3 border-t border-border/60 pt-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Si detectas un error ortográfico en tus nombres, cédula o
                sección asignada, acude presencialmente a{" "}
                <strong className="font-semibold text-foreground">
                  Control de Estudios y Secretaría
                </strong>{" "}
                con tu documento de identidad original para actualizar el
                expediente.
              </p>

              {data.recentAuditEntries.length > 0 ? (
                <div className="siga-glass-inner rounded-2xl border p-3.5">
                  <p className="text-[11px] font-semibold text-foreground">
                    Últimos cambios registrados en tu perfil
                  </p>
                  <ul className="mt-2 space-y-1.5 text-[11.5px] text-muted-foreground">
                    {data.recentAuditEntries.slice(0, 3).map((entry) => {
                      const fields = entry.changedFields
                        .map((f) => AUDIT_FIELD_LABELS[f] ?? f)
                        .join(", ");
                      return (
                        <li
                          key={entry.id}
                          className="flex flex-wrap items-center justify-between gap-2"
                        >
                          <span className="text-foreground/90">
                            {AUDIT_ACTION_LABELS[entry.action]}
                            {fields && entry.action === "profile_contact_updated"
                              ? ` (${fields})`
                              : ""}
                          </span>
                          <span className="tabular-nums">
                            {formatDateVe(entry.createdAt)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </TabsContent>

      {/* ==================== PESTAÑA 2: CONTACTO Y EMERGENCIA ==================== */}
      <TabsContent value="contacto" className="mt-0">
        <form
          onSubmit={handleSaveContact}
          className="siga-glass-surface space-y-6 rounded-[28px] border p-5 sm:p-6"
        >
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                Contacto personal y de emergencia
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Mantén actualizados tus medios de contacto para avisos escolares
                y atención ante cualquier eventualidad en el plantel.
              </p>
            </div>
            <Badge variant="outline" className="w-fit text-[11px]">
              Cambios registrados en bitácora
            </Badge>
          </div>

          {contactError ? (
            <Alert variant="destructive" className="rounded-2xl">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>No se pudieron guardar los cambios</AlertTitle>
              <AlertDescription>{contactError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Contacto personal */}
            <div className="siga-glass-inner space-y-4 rounded-2xl border p-4.5">
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-primary dark:text-sky-300" aria-hidden="true" />
                <h4 className="text-sm font-semibold text-foreground">
                  Medios de contacto del estudiante
                </h4>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-phone" className="text-xs">
                  Teléfono personal
                </Label>
                <Input
                  id="profile-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej. 0414-1234567"
                  maxLength={24}
                  autoComplete="tel"
                  className="rounded-xl bg-background/70"
                />
                <p className="text-[11px] text-muted-foreground">
                  Opcional. Puedes usar formato nacional o internacional (+58).
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-recovery-email" className="text-xs">
                  Correo personal de respaldo
                </Label>
                <Input
                  id="profile-recovery-email"
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  maxLength={160}
                  autoComplete="email"
                  className="rounded-xl bg-background/70"
                />
                <p className="text-[11px] text-muted-foreground">
                  Debe ser distinto a tu correo institucional @etcandresbello.org.
                  Se utiliza para recuperación y notificaciones de activación.
                </p>
              </div>
            </div>

            {/* Contacto de emergencia */}
            <div className="siga-glass-inner space-y-4 rounded-2xl border p-4.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <UserCheck
                    className="size-4 text-primary dark:text-sky-300"
                    aria-hidden="true"
                  />
                  <h4 className="text-sm font-semibold text-foreground">
                    Contacto de emergencia / Representante
                  </h4>
                </div>
                {!data.enrollment ? (
                  <Badge variant="secondary" className="text-[10px]">
                    Sin matrícula activa
                  </Badge>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="profile-emg-name" className="text-xs">
                    Nombre y apellido
                  </Label>
                  <Input
                    id="profile-emg-name"
                    type="text"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    placeholder="Ej. María González"
                    maxLength={120}
                    disabled={!data.enrollment}
                    className="rounded-xl bg-background/70"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profile-emg-cedula" className="text-xs">
                    Cédula de identidad
                  </Label>
                  <Input
                    id="profile-emg-cedula"
                    type="text"
                    value={emergencyCedula}
                    onChange={(e) => setEmergencyCedula(e.target.value)}
                    placeholder="V-12345678"
                    maxLength={14}
                    disabled={!data.enrollment}
                    className="rounded-xl bg-background/70 tabular-nums"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profile-emg-rel" className="text-xs">
                    Parentesco
                  </Label>
                  <Input
                    id="profile-emg-rel"
                    type="text"
                    value={emergencyRelationship}
                    onChange={(e) => setEmergencyRelationship(e.target.value)}
                    placeholder="Madre, Padre, Representante..."
                    maxLength={60}
                    disabled={!data.enrollment}
                    className="rounded-xl bg-background/70"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="profile-emg-phone" className="text-xs">
                    Teléfono de emergencia
                  </Label>
                  <Input
                    id="profile-emg-phone"
                    type="tel"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    placeholder="Ej. 0424-9876543"
                    maxLength={24}
                    disabled={!data.enrollment}
                    className="rounded-xl bg-background/70"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
            <p className="text-xs text-muted-foreground">
              Los cambios se reflejan inmediatamente en tu ficha institucional.
            </p>
            <Button
              type="submit"
              disabled={contactSaving}
              className="rounded-xl text-xs"
            >
              {contactSaving ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <Save data-icon="inline-start" aria-hidden="true" />
              )}
              Guardar cambios
            </Button>
          </div>
        </form>
      </TabsContent>

      {/* ==================== PESTAÑA 3: SEGURIDAD ==================== */}
      <TabsContent value="seguridad" className="mt-0 space-y-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Estado de Google Workspace + Contraseña */}
          <div className="flex flex-col gap-5 lg:col-span-7">
            <section
              aria-label="Estado de cuenta institucional Google Workspace"
              className="siga-glass-surface space-y-4 rounded-[28px] border p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                    Identidad institucional (@etcandresbello.org)
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Estado de tu cuenta escolar para acceso completo al Aula
                    Virtual, Biblioteca y Trámites.
                  </p>
                </div>
                <Badge
                  variant={isVerified ? "default" : "secondary"}
                  className="rounded-full"
                >
                  {isVerified ? "Verificada" : "Provisional"}
                </Badge>
              </div>

              <div className="siga-glass-inner flex flex-col justify-between gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">
                    {data.institutionalEmail ??
                      "Sin correo @etcandresbello.org vinculado todavía"}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground">
                    {isVerified
                      ? data.workspaceVerifiedAt
                        ? `Vinculada el ${formatDateVe(data.workspaceVerifiedAt)}`
                        : "Acceso institucional completo habilitado."
                      : "Mientras activas tu correo escolar, puedes usar tu cédula y registrar tu correo de respaldo."}
                  </p>
                </div>

                {!isVerified ? (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="shrink-0 rounded-xl text-xs"
                  >
                    <Link href="/estudiante">Solicitar activación</Link>
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    Activa
                  </span>
                )}
              </div>
            </section>

            {/* Cambio de contraseña */}
            <section
              aria-label="Cambio de contraseña"
              className="siga-glass-surface space-y-4 rounded-[28px] border p-5 sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                    Cambiar contraseña de acceso
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Define una clave segura para iniciar sesión con tu cédula o
                    correo institucional.
                  </p>
                </div>
                <span className="siga-glass-inner flex size-9 shrink-0 items-center justify-center rounded-xl border text-primary dark:text-sky-300">
                  <KeyRound className="size-4" aria-hidden="true" />
                </span>
              </div>

              {passwordError ? (
                <Alert variant="destructive" className="rounded-2xl">
                  <AlertCircle aria-hidden="true" />
                  <AlertTitle>No se pudo actualizar la contraseña</AlertTitle>
                  <AlertDescription>{passwordError}</AlertDescription>
                </Alert>
              ) : null}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-new-password" className="text-xs">
                      Nueva contraseña
                    </Label>
                    <div className="relative">
                      <Input
                        id="profile-new-password"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        placeholder="Mínimo 8 caracteres"
                        className="rounded-xl bg-background/70 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((v) => !v)}
                        aria-label={
                          showNewPassword
                            ? "Ocultar nueva contraseña"
                            : "Mostrar nueva contraseña"
                        }
                        className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? (
                          <EyeOff className="size-4" aria-hidden="true" />
                        ) : (
                          <Eye className="size-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="profile-confirm-password"
                      className="text-xs"
                    >
                      Confirmar nueva contraseña
                    </Label>
                    <div className="relative">
                      <Input
                        id="profile-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        placeholder="Repite la contraseña"
                        className="rounded-xl bg-background/70 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        aria-label={
                          showConfirmPassword
                            ? "Ocultar confirmación"
                            : "Mostrar confirmación"
                        }
                        className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="size-4" aria-hidden="true" />
                        ) : (
                          <Eye className="size-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <ul className="grid grid-cols-1 gap-1.5 rounded-2xl border border-border/60 bg-background/45 p-3 text-[11.5px] sm:grid-cols-2">
                  {[
                    { ok: passwordHasMinLength, label: "Al menos 8 caracteres" },
                    {
                      ok: passwordHasMixedCase,
                      label: "Mayúsculas y minúsculas",
                    },
                    { ok: passwordHasNumber, label: "Al menos un número" },
                    { ok: passwordMatches, label: "Ambas claves coinciden" },
                  ].map((rule) => (
                    <li
                      key={rule.label}
                      className={cn(
                        "flex items-center gap-1.5 transition-colors",
                        rule.ok
                          ? "font-medium text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      )}
                    >
                      <Check
                        className={cn(
                          "size-3.5 shrink-0",
                          rule.ok ? "opacity-100" : "opacity-35"
                        )}
                        aria-hidden="true"
                      />
                      <span>{rule.label}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={passwordSaving}
                    className="rounded-xl text-xs"
                  >
                    {passwordSaving ? (
                      <Loader2
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <KeyRound data-icon="inline-start" aria-hidden="true" />
                    )}
                    Actualizar contraseña
                  </Button>
                </div>
              </form>
            </section>
          </div>

          {/* Llaves biométricas (Passkeys) + Sesiones activas */}
          <div className="flex flex-col gap-5 lg:col-span-5">
            <section
              aria-label="Llaves biométricas del dispositivo"
              className="siga-glass-surface space-y-4 rounded-[28px] border p-5 sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                    Llaves biométricas (Passkeys)
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Protege tu cuenta con huella digital, rostro o PIN de tu
                    teléfono o computador.
                  </p>
                </div>
                <span className="siga-glass-inner flex size-9 shrink-0 items-center justify-center rounded-xl border text-primary dark:text-sky-300">
                  <Fingerprint className="size-4" aria-hidden="true" />
                </span>
              </div>

              {!isVerified ? (
                <div className="siga-glass-inner rounded-2xl border border-dashed p-4 text-xs leading-relaxed text-muted-foreground">
                  El registro de llaves biométricas se habilita al activar tu
                  cuenta institucional{" "}
                  <strong className="font-semibold text-foreground">
                    @etcandresbello.org
                  </strong>
                  .
                </div>
              ) : passkeysLoading ? (
                <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Consultando llaves registradas…
                </div>
              ) : (
                <>
                  {passkeySupported ? (
                    <div className="siga-glass-inner space-y-3 rounded-2xl border p-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="passkey-device-name" className="text-xs">
                          Nombre del dispositivo
                        </Label>
                        <Input
                          id="passkey-device-name"
                          type="text"
                          value={passkeyDeviceName}
                          onChange={(e) => setPasskeyDeviceName(e.target.value)}
                          maxLength={60}
                          placeholder="Ej. Teléfono personal o Laptop"
                          className="rounded-xl bg-background/70"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={passkeyBusyId !== null}
                        onClick={handleEnrollPasskey}
                        className="w-full rounded-xl text-xs"
                      >
                        {passkeyBusyId === "new" ? (
                          <Loader2
                            className="animate-spin"
                            data-icon="inline-start"
                          />
                        ) : (
                          <Fingerprint
                            data-icon="inline-start"
                            aria-hidden="true"
                          />
                        )}
                        Registrar llave biométrica
                      </Button>
                    </div>
                  ) : (
                    <div className="siga-glass-inner rounded-2xl border p-3.5 text-xs leading-relaxed text-muted-foreground">
                      Este navegador o dispositivo no reporta un lector
                      biométrico compatible en este momento.
                    </div>
                  )}

                  {passkeys.length > 0 ? (
                    <ul className="space-y-2">
                      {passkeys.map((pk) => (
                        <li
                          key={pk.id}
                          className="siga-glass-inner flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">
                              {pk.friendlyName}
                            </p>
                            <p className="text-[11px] text-muted-foreground tabular-nums">
                              Registrada el {formatDateVe(pk.createdAt)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={passkeyBusyId !== null}
                            onClick={() => handleRemovePasskey(pk.id)}
                            aria-label={`Eliminar llave ${pk.friendlyName}`}
                            className="shrink-0 rounded-lg text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-300"
                          >
                            {passkeyBusyId === pk.id ? (
                              <Loader2
                                className="size-3.5 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            )}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Aún no tienes llaves biométricas registradas.
                    </p>
                  )}
                </>
              )}
            </section>

            {/* Sesiones en otros dispositivos */}
            <section
              aria-label="Control de sesiones activas"
              className="siga-glass-surface space-y-3.5 rounded-[28px] border p-5 sm:p-6"
            >
              <div>
                <h3 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                  Sesiones en otros dispositivos
                </h3>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Si iniciaste sesión en un computador del laboratorio o en un
                  equipo prestado, cierra esas sesiones manteniendo activa solo
                  la actual.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={signingOutOthers}
                onClick={handleSignOutOtherDevices}
                className="w-full rounded-xl text-xs"
              >
                {signingOutOthers ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <LogOut data-icon="inline-start" aria-hidden="true" />
                )}
                Cerrar sesión en otros dispositivos
              </Button>
            </section>
          </div>
        </div>
      </TabsContent>

      {/* ==================== PESTAÑA 4: PREFERENCIAS DE INTERFAZ ==================== */}
      <TabsContent value="preferencias" className="mt-0 space-y-5">
        {/* Galería de Paletas Cromáticas Predefinidas */}
        <section
          aria-label="Paletas de color predefinidas"
          className="siga-glass-surface space-y-5 rounded-[28px] border p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="siga-glass-inner flex size-9 shrink-0 items-center justify-center rounded-xl border text-primary">
                <Palette className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                  Paletas de color del portal
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Cambia la atmósfera, acentos, botones y reflejos de toda la
                  aplicación con combinaciones diseñadas para modo claro y
                  oscuro.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetVisualDefaults}
              className="rounded-xl text-xs"
            >
              <RotateCcw data-icon="inline-start" aria-hidden="true" />
              Restablecer todo
            </Button>
          </div>

          <div
            role="radiogroup"
            aria-label="Seleccionar paleta de color"
            className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {COLOR_PALETTES.map((pal) => {
              const isSelected = settings.palette === pal.id;
              return (
                <button
                  key={pal.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleSelectPalette(pal.id, pal.label)}
                  className={cn(
                    "siga-glass-inner group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
                    isSelected
                      ? "border-primary/70 ring-2 ring-primary/35 shadow-md"
                      : "hover:border-primary/40"
                  )}
                >
                  {/* Mini vista previa atmosférica */}
                  <div
                    style={{ background: pal.previewGradient }}
                    className="relative mb-3 flex h-16 w-full items-end justify-between overflow-hidden rounded-xl p-2.5 shadow-inner"
                  >
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -top-6 -right-6 size-20 rounded-full bg-white/25 blur-xl"
                    />
                    <div className="flex items-center gap-1.5">
                      {pal.swatches.map((hex) => (
                        <span
                          key={hex}
                          style={{ backgroundColor: hex }}
                          className="size-4 rounded-full border border-white/75 shadow-xs"
                          aria-hidden="true"
                        />
                      ))}
                    </div>

                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-slate-900 shadow-xs">
                        <Check className="size-3" aria-hidden="true" />
                        Activa
                      </span>
                    ) : null}
                  </div>

                  <p className="text-xs font-semibold text-foreground">
                    {pal.label}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    {pal.tagline}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Tema y Barra lateral */}
          <section
            aria-label="Tema visual y comportamiento de navegación"
            className="siga-glass-surface space-y-5 rounded-[28px] border p-5 sm:p-6 lg:col-span-5"
          >
            <div>
              <h3 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                Tema y navegación
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Ajusta el modo claro u oscuro y la barra lateral en este
                navegador.
              </p>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-medium text-foreground">
                Modo de apariencia
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  aria-pressed={!isDark}
                  onClick={() => handleSetTheme("light")}
                  className={cn(
                    "siga-glass-inner flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-4 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
                    !isDark
                      ? "border-primary/60 ring-2 ring-primary/35 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sun className="size-5" aria-hidden="true" />
                  <span>Tema Claro</span>
                </button>
                <button
                  type="button"
                  aria-pressed={isDark}
                  onClick={() => handleSetTheme("dark")}
                  className={cn(
                    "siga-glass-inner flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-4 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
                    isDark
                      ? "border-primary/60 ring-2 ring-primary/35 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Moon className="size-5" aria-hidden="true" />
                  <span>Tema Oscuro</span>
                </button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2.5">
              <p className="text-xs font-medium text-foreground">
                Barra lateral en escritorio
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  aria-pressed={!sidebarExpandedPref}
                  onClick={() => handleToggleSidebarPref(false)}
                  className={cn(
                    "siga-glass-inner cursor-pointer rounded-xl border px-3 py-2.5 text-xs font-medium transition-all",
                    !sidebarExpandedPref
                      ? "border-primary/60 ring-2 ring-primary/30 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Compacta (íconos)
                </button>
                <button
                  type="button"
                  aria-pressed={sidebarExpandedPref}
                  onClick={() => handleToggleSidebarPref(true)}
                  className={cn(
                    "siga-glass-inner cursor-pointer rounded-xl border px-3 py-2.5 text-xs font-medium transition-all",
                    sidebarExpandedPref
                      ? "border-primary/60 ring-2 ring-primary/30 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Expandida (etiquetas)
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Se aplicará la próxima vez que abras el portal en pantalla de
                escritorio.
              </p>
            </div>
          </section>

          {/* Efecto Glassmorphism */}
          <section
            aria-label="Personalización de efecto cristal"
            className="siga-glass-surface space-y-5 rounded-[28px] border p-5 sm:p-6 lg:col-span-7"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="siga-glass-inner flex size-9 shrink-0 items-center justify-center rounded-xl border text-primary">
                  <Sparkles className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                    Efecto Cristal (Glassmorphism)
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Personaliza en tiempo real la transparencia y el desenfoque
                    de las tarjetas del portal.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetVisualDefaults}
                className="rounded-xl text-xs"
              >
                <RotateCcw data-icon="inline-start" aria-hidden="true" />
                Restablecer
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted/60 p-1.5">
              {(["solido", "glass", "cristal"] as const).map((presetKey) => {
                const active = settings.preset === presetKey;
                return (
                  <button
                    key={presetKey}
                    type="button"
                    aria-pressed={active}
                    onClick={() => applyPreset(presetKey)}
                    className={cn(
                      "cursor-pointer rounded-xl py-2 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none",
                      active
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {GLASS_PRESETS[presetKey].label}
                  </button>
                );
              })}
            </div>

            <div className="siga-glass-inner space-y-4 rounded-2xl border p-4.5">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <label
                    htmlFor="profile-glass-opacity"
                    className="flex items-center gap-1.5 font-medium text-foreground"
                  >
                    <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                    Opacidad de tarjetas
                  </label>
                  <span className="font-semibold text-primary tabular-nums">
                    {settings.opacityPct}%
                  </span>
                </div>
                <input
                  id="profile-glass-opacity"
                  type="range"
                  min={16}
                  max={92}
                  step={2}
                  value={settings.opacityPct}
                  onChange={(e) => setOpacityPct(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer accent-primary"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <label
                    htmlFor="profile-glass-blur"
                    className="font-medium text-foreground"
                  >
                    Desenfoque de fondo
                  </label>
                  <span className="font-semibold text-primary tabular-nums">
                    {settings.blurPx} px
                  </span>
                </div>
                <input
                  id="profile-glass-blur"
                  type="range"
                  min={4}
                  max={24}
                  step={1}
                  value={settings.blurPx}
                  onChange={(e) => setBlurPx(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer accent-primary"
                />
              </div>
            </div>
          </section>
        </div>
      </TabsContent>
    </Tabs>
  );
}
