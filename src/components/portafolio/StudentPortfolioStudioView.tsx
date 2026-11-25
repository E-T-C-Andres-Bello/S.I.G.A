"use client";

import * as React from "react";
import {
  Briefcase,
  Download,
  FileUp,
  FolderKanban,
  Globe,
  Languages,
  Layers,
  Loader2,
  Lock,
  Palette,
  Plus,
  Save,
  Sparkles,
  Trash2,
  UserRound,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { downloadStudentTechnicalCvPdf } from "@/components/pdf/StudentTechnicalCvPdf";
import { PortfolioCoachPanel } from "@/components/portafolio/PortfolioCoachPanel";
import { PortfolioLiveSheet } from "@/components/portafolio/PortfolioLiveSheet";
import { PortfolioPdfImportDialog } from "@/components/portafolio/PortfolioPdfImportDialog";
import { PortfolioPublicSettingsDialog } from "@/components/portafolio/PortfolioPublicSettingsDialog";
import { PortfolioScoreMeter } from "@/components/portafolio/PortfolioScoreMeter";
import { PortfolioTemplateGallery } from "@/components/portafolio/PortfolioTemplateGallery";
import {
  evaluateStudentPortfolio,
  type SelectiveCoachSignal,
} from "@/features/portafolio/cv-scoring";
import { saveStudentPortfolioAction } from "@/features/portafolio/portfolio-actions";
import type { StudentPortfolioWorkspaceData } from "@/features/portafolio/portfolio-data";
import {
  MENTION_SUGGESTED_SKILLS,
  resolvePortfolioDesign,
  type PortfolioPdfImportResponsePayload,
  type StudentPortfolioDraft,
} from "@/lib/validators/portfolio";

export interface StudentPortfolioStudioViewProps {
  initialData: StudentPortfolioWorkspaceData;
}

function makeUid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function buildSuggestedSlug(fullName: string, mencionName: string | null): string {
  const base = `${fullName} ${mencionName ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);
  return base.length >= 4 ? base : "estudiante-bellista";
}

function resolveMentionKey(mencionCode: string | null, mencionName: string | null): string {
  const norm = `${mencionCode ?? ""} ${mencionName ?? ""}`.toLowerCase();
  if (norm.includes("telem") || norm.includes("inform")) return "TELEMATICA";
  if (norm.includes("aduan")) return "ADUANA";
  if (norm.includes("turis")) return "TURISMO";
  return "GENERAL";
}

export function StudentPortfolioStudioView({
  initialData,
}: StudentPortfolioStudioViewProps) {
  const [draft, setDraft] = React.useState<StudentPortfolioDraft>(initialData.draft);
  const [verificationCode, setVerificationCode] = React.useState<string | null>(
    initialData.verificationCode
  );
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(
    initialData.updatedAt
  );
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [downloadingPdf, setDownloadingPdf] = React.useState(false);
  const [leftTab, setLeftTab] = React.useState<"content" | "design" | "coach">("content");
  const [contentGroup, setContentGroup] = React.useState<
    "profile" | "skills" | "projects" | "experience" | "extras" | "custom"
  >("profile");
  const [activeSignal, setActiveSignal] = React.useState<SelectiveCoachSignal | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [privacyOpen, setPrivacyOpen] = React.useState(false);
  const [aiQuotaRemaining, setAiQuotaRemaining] = React.useState(
    initialData.aiQuotaRemaining
  );
  const [newSkillName, setNewSkillName] = React.useState("");
  const [newSkillCategory, setNewSkillCategory] = React.useState<
    "tecnica" | "herramienta" | "blanda"
  >("tecnica");
  const [newSkillLevel, setNewSkillLevel] = React.useState<
    "basico" | "intermedio" | "avanzado"
  >("intermedio");
  const [newCustomSectionTitle, setNewCustomSectionTitle] = React.useState("");

  const saveLockRef = React.useRef(false);
  const verified = initialData.verifiedProfile;

  const updateDraft = React.useCallback(
    (updater: (prev: StudentPortfolioDraft) => StudentPortfolioDraft) => {
      setDraft((prev) => updater(prev));
      setDirty(true);
    },
    []
  );

  const evaluation = React.useMemo(
    () =>
      evaluateStudentPortfolio(draft, {
        mencionCode: verified.mencionCode,
        mencionName: verified.mencionName,
        gradeYear: verified.gradeYear,
      }),
    [draft, verified.gradeYear, verified.mencionCode, verified.mencionName]
  );

  const mentionKey = resolveMentionKey(verified.mencionCode, verified.mencionName);
  const suggestedSkills = React.useMemo(() => {
    const existing = new Set(draft.skills.map((s) => s.name.toLowerCase()));
    const pool = [
      ...(MENTION_SUGGESTED_SKILLS[mentionKey] ?? []),
      ...MENTION_SUGGESTED_SKILLS.GENERAL,
    ];
    return pool.filter((item) => !existing.has(item.toLowerCase()));
  }, [draft.skills, mentionKey]);

  const handleSave = React.useCallback(async (): Promise<string | null> => {
    if (saveLockRef.current) return verificationCode;
    saveLockRef.current = true;
    setSaving(true);
    try {
      const res = await saveStudentPortfolioAction(draft, {
        mencionCode: verified.mencionCode,
        mencionName: verified.mencionName,
        gradeYear: verified.gradeYear,
      });
      if (!res.ok) {
        toast.error(res.message);
        return verificationCode;
      }
      if (res.verificationCode) {
        setVerificationCode(res.verificationCode);
      }
      if (res.updatedAt) {
        setLastSavedAt(res.updatedAt);
      }
      setDirty(false);
      toast.success("Portafolio técnico guardado correctamente.");
      return res.verificationCode ?? verificationCode;
    } catch {
      toast.error("No se pudo guardar el portafolio. Intenta de nuevo.");
      return verificationCode;
    } finally {
      setSaving(false);
      saveLockRef.current = false;
    }
  }, [draft, verificationCode, verified.gradeYear, verified.mencionCode, verified.mencionName]);

  const handleDownloadPdf = async () => {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      let effectiveCode = verificationCode;
      if (!effectiveCode || dirty) {
        effectiveCode = await handleSave();
      }
      await downloadStudentTechnicalCvPdf({
        draft,
        verified,
        verificationCode: effectiveCode,
      });
      toast.success("Hoja de vida PDF descargada con sello verificable.");
    } catch {
      toast.error("No se pudo generar el PDF en este momento.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSelectSignal = (sig: SelectiveCoachSignal) => {
    setActiveSignal(sig);
    setLeftTab("coach");
  };

  const handleApplyCoachSuggestion = (sectionKey: string, text: string) => {
    const clean = text.trim();
    if (!clean) return;
    if (sectionKey === "headline") {
      updateDraft((prev) => ({ ...prev, headline: clean.slice(0, 140) }));
      toast.success("Titular actualizado con tu propuesta.");
      return;
    }
    if (sectionKey === "about") {
      updateDraft((prev) => ({ ...prev, aboutSummary: clean.slice(0, 1200) }));
      toast.success("Perfil profesional actualizado.");
      return;
    }
    if (sectionKey === "projects" && draft.projects.length > 0) {
      updateDraft((prev) => ({
        ...prev,
        projects: prev.projects.map((p, idx) =>
          idx === 0 ? { ...p, summary: clean.slice(0, 550) } : p
        ),
      }));
      toast.success("Descripción del proyecto actualizada.");
      return;
    }
    if (sectionKey === "experience" && draft.experience.length > 0) {
      updateDraft((prev) => ({
        ...prev,
        experience: prev.experience.map((e, idx) =>
          idx === 0 ? { ...e, summary: clean.slice(0, 500) } : e
        ),
      }));
      toast.success("Descripción de experiencia actualizada.");
      return;
    }
    updateDraft((prev) => ({ ...prev, aboutSummary: clean.slice(0, 1200) }));
    toast.success("Texto aplicado a tu perfil profesional.");
  };

  const addSkill = (
    name: string,
    category: "tecnica" | "herramienta" | "blanda" = "tecnica",
    level: "basico" | "intermedio" | "avanzado" = "intermedio"
  ) => {
    const clean = name.trim();
    if (!clean) return;
    if (draft.skills.some((s) => s.name.toLowerCase() === clean.toLowerCase())) {
      toast.info("Esa habilidad ya está en tu lista.");
      return;
    }
    if (draft.skills.length >= 24) {
      toast.error("Puedes incluir hasta 24 habilidades clave.");
      return;
    }
    updateDraft((prev) => ({
      ...prev,
      skills: [
        ...prev.skills,
        { id: makeUid("sk"), name: clean.slice(0, 64), category, level },
      ],
    }));
  };

  const handleApplyPdfImport = (
    result: PortfolioPdfImportResponsePayload,
    applyTemplate: boolean
  ) => {
    const ext = result.extracted;
    updateDraft((prev) => ({
      ...prev,
      templateId: applyTemplate ? result.suggestedTemplateId : prev.templateId,
      designConfig: applyTemplate
        ? resolvePortfolioDesign(result.suggestedTemplateId)
        : prev.designConfig,
      headline: ext.headline || prev.headline,
      aboutSummary: ext.aboutSummary || prev.aboutSummary,
      contactMeta: {
        ...prev.contactMeta,
        city: ext.city || prev.contactMeta.city,
      },
      skills:
        ext.skills && ext.skills.length > 0
          ? ext.skills.map((s) => ({ id: makeUid("sk"), ...s }))
          : prev.skills,
      languages:
        ext.languages && ext.languages.length > 0
          ? ext.languages.map((l) => ({ id: makeUid("lg"), ...l }))
          : prev.languages,
      projects:
        ext.projects && ext.projects.length > 0
          ? ext.projects.map((p) => ({ id: makeUid("pr"), ...p, url: "" }))
          : prev.projects,
      experience:
        ext.experience && ext.experience.length > 0
          ? ext.experience.map((e) => ({ id: makeUid("ex"), ...e }))
          : prev.experience,
      certifications:
        ext.certifications && ext.certifications.length > 0
          ? ext.certifications.map((c) => ({
              id: makeUid("ce"),
              ...c,
              credentialUrl: "",
            }))
          : prev.certifications,
      customSections:
        ext.customSections && ext.customSections.length > 0
          ? ext.customSections.map((sec) => ({
              id: makeUid("cs"),
              title: sec.title,
              items: sec.items.map((it) => ({ id: makeUid("ci"), ...it })),
            }))
          : prev.customSections,
    }));
  };

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 pb-10">
      {/* Barra superior del Estudio de Portafolio */}
      <header className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/90 p-4 shadow-xs backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Portafolio Técnico y Hoja de Vida
            </h1>
            {verified.mencionName ? (
              <Badge variant="secondary" className="font-medium">
                Mención {verified.mencionName}
              </Badge>
            ) : null}
            {draft.isPublic && draft.publicSlug ? (
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                <Globe className="mr-1 size-3" aria-hidden="true" />
                Enlace público activo
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                <Lock className="mr-1 size-3" aria-hidden="true" />
                Privado
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Construye tu currículum con 10 plantillas o tu propio diseño, guíate
            con el Coach socrático y descarga tu PDF con código QR verificado por
            la E.T.C. &ldquo;Andrés Bello&rdquo;.
            {lastSavedAt ? " · Cambios sincronizados." : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            className="gap-1.5"
          >
            <FileUp className="size-4" aria-hidden="true" />
            Importar PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPrivacyOpen(true)}
            className="gap-1.5"
          >
            {draft.isPublic ? (
              <Globe className="size-4 text-emerald-600" aria-hidden="true" />
            ) : (
              <Lock className="size-4" aria-hidden="true" />
            )}
            Privacidad y Enlace
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={downloadingPdf}
            onClick={() => void handleDownloadPdf()}
            className="gap-1.5"
          >
            {downloadingPdf ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="size-4" aria-hidden="true" />
            )}
            Descargar PDF + QR
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() => void handleSave()}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            {dirty ? "Guardar cambios" : "Guardar"}
          </Button>
        </div>
      </header>

      {/* Termómetro de nivel del CV en vivo */}
      <PortfolioScoreMeter
        evaluation={evaluation}
        onSelectSignal={handleSelectSignal}
      />

      {/* Estudio dividido: Editor / Plantillas / Coach IA a la izquierda + Hoja A4 viva a la derecha */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-5">
          <Tabs
            value={leftTab}
            onValueChange={(v) =>
              setLeftTab(v as "content" | "design" | "coach")
            }
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="content" className="gap-1.5 text-xs">
                <UserRound className="size-3.5" aria-hidden="true" />
                Contenido
              </TabsTrigger>
              <TabsTrigger value="design" className="gap-1.5 text-xs">
                <Palette className="size-3.5" aria-hidden="true" />
                Diseño (10+)
              </TabsTrigger>
              <TabsTrigger value="coach" className="gap-1.5 text-xs">
                <Sparkles className="size-3.5" aria-hidden="true" />
                Coach IA
                {evaluation.signals.length > 0 ? (
                  <span className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                    {evaluation.signals.length}
                  </span>
                ) : null}
              </TabsTrigger>
            </TabsList>

            {/* PESTAÑA 1: CONTENIDO COMPLETO + BLOQUES LIBRES */}
            <TabsContent value="content" className="mt-4 space-y-4">
              {/* Selector de sub-sección */}
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: "profile", label: "Perfil", icon: UserRound },
                    { id: "skills", label: `Habilidades (${draft.skills.length})`, icon: Wrench },
                    { id: "projects", label: `Proyectos (${draft.projects.length})`, icon: FolderKanban },
                    { id: "experience", label: `Experiencia (${draft.experience.length})`, icon: Briefcase },
                    { id: "extras", label: "Idiomas y Cursos", icon: Languages },
                    { id: "custom", label: `Libres (${draft.customSections.length})`, icon: Layers },
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  const active = contentGroup === item.id;
                  return (
                    <Button
                      key={item.id}
                      type="button"
                      variant={active ? "default" : "outline"}
                      size="sm"
                      onClick={() => setContentGroup(item.id)}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <Icon className="size-3.5" aria-hidden="true" />
                      {item.label}
                    </Button>
                  );
                })}
              </div>

              {/* Subsección: Perfil y Contacto */}
              {contentGroup === "profile" ? (
                <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="cv-headline"
                      className="text-xs font-semibold text-foreground"
                    >
                      Titular profesional
                    </label>
                    <Input
                      id="cv-headline"
                      value={draft.headline}
                      maxLength={140}
                      onChange={(e) =>
                        updateDraft((prev) => ({
                          ...prev,
                          headline: e.target.value,
                        }))
                      }
                      placeholder="Ej. Técnico Medio en Telemática · Soporte TI, Redes LAN y SQL"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Une tu mención técnica con las 2 o 3 cosas que mejor haces.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="cv-summary"
                      className="text-xs font-semibold text-foreground"
                    >
                      Resumen profesional
                    </label>
                    <Textarea
                      id="cv-summary"
                      rows={5}
                      maxLength={1200}
                      value={draft.aboutSummary}
                      onChange={(e) =>
                        updateDraft((prev) => ({
                          ...prev,
                          aboutSummary: e.target.value,
                        }))
                      }
                      placeholder="Cuéntale a la empresa qué has practicado en tu mención, qué proyecto o competencia te distingue y qué buscas aportar en tus pasantías."
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="cv-city"
                        className="text-xs font-semibold text-foreground"
                      >
                        Ciudad / Zona
                      </label>
                      <Input
                        id="cv-city"
                        value={draft.contactMeta.city}
                        maxLength={80}
                        onChange={(e) =>
                          updateDraft((prev) => ({
                            ...prev,
                            contactMeta: {
                              ...prev.contactMeta,
                              city: e.target.value,
                            },
                          }))
                        }
                        placeholder="Puerto Ordaz, Estado Bolívar"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label
                        htmlFor="cv-availability"
                        className="text-xs font-semibold text-foreground"
                      >
                        Disponibilidad
                      </label>
                      <Input
                        id="cv-availability"
                        value={draft.contactMeta.availability}
                        maxLength={80}
                        onChange={(e) =>
                          updateDraft((prev) => ({
                            ...prev,
                            contactMeta: {
                              ...prev.contactMeta,
                              availability: e.target.value,
                            },
                          }))
                        }
                        placeholder="Ej. Disponible para pasantías 6.º año"
                      />
                    </div>
                  </div>

                  {/* Enlaces profesionales */}
                  <div className="space-y-2 border-t border-border/60 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        Enlaces profesionales (GitHub, LinkedIn, Behance, Web)
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-[11px]"
                        disabled={draft.contactMeta.links.length >= 6}
                        onClick={() =>
                          updateDraft((prev) => ({
                            ...prev,
                            contactMeta: {
                              ...prev.contactMeta,
                              links: [
                                ...prev.contactMeta.links,
                                {
                                  id: makeUid("ln"),
                                  label: "GitHub",
                                  url: "https://",
                                },
                              ],
                            },
                          }))
                        }
                      >
                        <Plus className="size-3" aria-hidden="true" />
                        Añadir enlace
                      </Button>
                    </div>
                    {draft.contactMeta.links.map((link, idx) => (
                      <div key={link.id} className="flex items-center gap-2">
                        <Input
                          value={link.label}
                          maxLength={40}
                          placeholder="Nombre"
                          className="w-32 text-xs"
                          onChange={(e) =>
                            updateDraft((prev) => ({
                              ...prev,
                              contactMeta: {
                                ...prev.contactMeta,
                                links: prev.contactMeta.links.map((l, i) =>
                                  i === idx ? { ...l, label: e.target.value } : l
                                ),
                              },
                            }))
                          }
                        />
                        <Input
                          value={link.url}
                          maxLength={240}
                          placeholder="https://..."
                          className="flex-1 text-xs"
                          onChange={(e) =>
                            updateDraft((prev) => ({
                              ...prev,
                              contactMeta: {
                                ...prev.contactMeta,
                                links: prev.contactMeta.links.map((l, i) =>
                                  i === idx ? { ...l, url: e.target.value } : l
                                ),
                              },
                            }))
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            updateDraft((prev) => ({
                              ...prev,
                              contactMeta: {
                                ...prev.contactMeta,
                                links: prev.contactMeta.links.filter(
                                  (_, i) => i !== idx
                                ),
                              },
                            }))
                          }
                          aria-label="Eliminar enlace"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Subsección: Habilidades */}
              {contentGroup === "skills" ? (
                <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-4">
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-foreground">
                      Agregar habilidad o herramienta
                    </span>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={newSkillName}
                        maxLength={64}
                        placeholder="Ej. Cableado T568B, Excel, Valoración CIF..."
                        onChange={(e) => setNewSkillName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addSkill(newSkillName, newSkillCategory, newSkillLevel);
                            setNewSkillName("");
                          }
                        }}
                      />
                      <select
                        value={newSkillCategory}
                        onChange={(e) =>
                          setNewSkillCategory(
                            e.target.value as "tecnica" | "herramienta" | "blanda"
                          )
                        }
                        className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                        aria-label="Categoría de habilidad"
                      >
                        <option value="tecnica">Técnica</option>
                        <option value="herramienta">Herramienta</option>
                        <option value="blanda">Blanda</option>
                      </select>
                      <select
                        value={newSkillLevel}
                        onChange={(e) =>
                          setNewSkillLevel(
                            e.target.value as "basico" | "intermedio" | "avanzado"
                          )
                        }
                        className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                        aria-label="Nivel de dominio"
                      >
                        <option value="basico">Básico</option>
                        <option value="intermedio">Intermedio</option>
                        <option value="avanzado">Avanzado</option>
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          addSkill(newSkillName, newSkillCategory, newSkillLevel);
                          setNewSkillName("");
                        }}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  {/* Lista actual */}
                  {draft.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {draft.skills.map((skill) => (
                        <span
                          key={skill.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs"
                        >
                          <span className="font-medium text-foreground">
                            {skill.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            ({skill.level})
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft((prev) => ({
                                ...prev,
                                skills: prev.skills.filter((s) => s.id !== skill.id),
                              }))
                            }
                            className="ml-0.5 text-muted-foreground hover:text-destructive"
                            aria-label={`Quitar ${skill.name}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {/* Sugeridas según su mención oficial */}
                  {suggestedSkills.length > 0 ? (
                    <div className="space-y-1.5 border-t border-border/60 pt-3">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Sugeridas para {verified.mencionName ?? "tu perfil técnico"} (clic para sumar):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestedSkills.slice(0, 10).map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => addSkill(suggestion, "tecnica", "intermedio")}
                            className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/12"
                          >
                            <Plus className="size-3" aria-hidden="true" />
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Subsección: Proyectos */}
              {contentGroup === "projects" ? (
                <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold text-foreground">
                        Proyectos Técnicos y Socioproductivos (PEST)
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Incluye proyectos escolares, prototipos, laboratorios o ferias.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-xs"
                      disabled={draft.projects.length >= 10}
                      onClick={() =>
                        updateDraft((prev) => ({
                          ...prev,
                          projects: [
                            ...prev.projects,
                            {
                              id: makeUid("pr"),
                              title: "",
                              role: "",
                              period: "2026",
                              summary: "",
                              tools: [],
                              impact: "",
                              url: "",
                            },
                          ],
                        }))
                      }
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      Nuevo proyecto
                    </Button>
                  </div>

                  {draft.projects.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      Aún no agregas proyectos. Añade tu proyecto socioproductivo o tu
                      mejor práctica de laboratorio para destacar.
                    </p>
                  ) : (
                    draft.projects.map((proj, idx) => (
                      <div
                        key={proj.id}
                        className="space-y-2.5 rounded-xl border border-border/75 bg-muted/20 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            Proyecto #{idx + 1}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              updateDraft((prev) => ({
                                ...prev,
                                projects: prev.projects.filter((p) => p.id !== proj.id),
                              }))
                            }
                            aria-label="Eliminar proyecto"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </Button>
                        </div>

                        <Input
                          value={proj.title}
                          maxLength={100}
                          placeholder="Título del proyecto"
                          onChange={(e) =>
                            updateDraft((prev) => ({
                              ...prev,
                              projects: prev.projects.map((p) =>
                                p.id === proj.id ? { ...p, title: e.target.value } : p
                              ),
                            }))
                          }
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={proj.role}
                            maxLength={70}
                            placeholder="Tu rol (ej. Líder técnico)"
                            onChange={(e) =>
                              updateDraft((prev) => ({
                                ...prev,
                                projects: prev.projects.map((p) =>
                                  p.id === proj.id ? { ...p, role: e.target.value } : p
                                ),
                              }))
                            }
                          />
                          <Input
                            value={proj.period}
                            maxLength={40}
                            placeholder="Período (ej. 2025 - 2026)"
                            onChange={(e) =>
                              updateDraft((prev) => ({
                                ...prev,
                                projects: prev.projects.map((p) =>
                                  p.id === proj.id ? { ...p, period: e.target.value } : p
                                ),
                              }))
                            }
                          />
                        </div>
                        <Textarea
                          rows={3}
                          maxLength={550}
                          value={proj.summary}
                          placeholder="¿Qué problema resolviste y qué hiciste paso a paso?"
                          onChange={(e) =>
                            updateDraft((prev) => ({
                              ...prev,
                              projects: prev.projects.map((p) =>
                                p.id === proj.id ? { ...p, summary: e.target.value } : p
                              ),
                            }))
                          }
                        />
                        <Input
                          value={proj.impact}
                          maxLength={260}
                          placeholder="Resultado o impacto logrado (ej. Redujo fallas en 20 equipos)"
                          onChange={(e) =>
                            updateDraft((prev) => ({
                              ...prev,
                              projects: prev.projects.map((p) =>
                                p.id === proj.id ? { ...p, impact: e.target.value } : p
                              ),
                            }))
                          }
                        />
                        <Input
                          value={proj.tools.join(", ")}
                          placeholder="Herramientas separadas por coma (ej. Linux, SQL, Excel)"
                          onChange={(e) =>
                            updateDraft((prev) => ({
                              ...prev,
                              projects: prev.projects.map((p) =>
                                p.id === proj.id
                                  ? {
                                      ...p,
                                      tools: e.target.value
                                        .split(",")
                                        .map((t) => t.trim())
                                        .filter(Boolean)
                                        .slice(0, 10),
                                    }
                                  : p
                              ),
                            }))
                          }
                        />
                      </div>
                    ))
                  )}
                </div>
              ) : null}

              {/* Subsección: Experiencia */}
              {contentGroup === "experience" ? (
                <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold text-foreground">
                        Experiencia, Prácticas o Voluntariado
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Pasantías, preparadurías, apoyos técnicos o actividades comunitarias.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-xs"
                      disabled={draft.experience.length >= 10}
                      onClick={() =>
                        updateDraft((prev) => ({
                          ...prev,
                          experience: [
                            ...prev.experience,
                            {
                              id: makeUid("ex"),
                              organization: "",
                              role: "",
                              period: "",
                              summary: "",
                              achievements: [],
                            },
                          ],
                        }))
                      }
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      Añadir
                    </Button>
                  </div>

                  {draft.experience.map((exp, idx) => (
                    <div
                      key={exp.id}
                      className="space-y-2 rounded-xl border border-border/75 bg-muted/20 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          Experiencia #{idx + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            updateDraft((prev) => ({
                              ...prev,
                              experience: prev.experience.filter((e) => e.id !== exp.id),
                            }))
                          }
                          aria-label="Eliminar experiencia"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Input
                          value={exp.role}
                          maxLength={80}
                          placeholder="Rol o cargo"
                          onChange={(e) =>
                            updateDraft((prev) => ({
                              ...prev,
                              experience: prev.experience.map((item) =>
                                item.id === exp.id
                                  ? { ...item, role: e.target.value }
                                  : item
                              ),
                            }))
                          }
                        />
                        <Input
                          value={exp.organization}
                          maxLength={100}
                          placeholder="Empresa / Espacio"
                          onChange={(e) =>
                            updateDraft((prev) => ({
                              ...prev,
                              experience: prev.experience.map((item) =>
                                item.id === exp.id
                                  ? { ...item, organization: e.target.value }
                                  : item
                              ),
                            }))
                          }
                        />
                      </div>
                      <Input
                        value={exp.period}
                        maxLength={40}
                        placeholder="Período (ej. Ene 2026 - Actualidad)"
                        onChange={(e) =>
                          updateDraft((prev) => ({
                            ...prev,
                            experience: prev.experience.map((item) =>
                              item.id === exp.id
                                ? { ...item, period: e.target.value }
                                : item
                            ),
                          }))
                        }
                      />
                      <Textarea
                        rows={3}
                        maxLength={500}
                        value={exp.summary}
                        placeholder="Describe tus responsabilidades concretas y resultados."
                        onChange={(e) =>
                          updateDraft((prev) => ({
                            ...prev,
                            experience: prev.experience.map((item) =>
                              item.id === exp.id
                                ? { ...item, summary: e.target.value }
                                : item
                            ),
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Subsección: Idiomas y Cursos */}
              {contentGroup === "extras" ? (
                <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        Idiomas
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-[11px]"
                        disabled={draft.languages.length >= 8}
                        onClick={() =>
                          updateDraft((prev) => ({
                            ...prev,
                            languages: [
                              ...prev.languages,
                              { id: makeUid("lg"), name: "Inglés", level: "B1" },
                            ],
                          }))
                        }
                      >
                        <Plus className="size-3" aria-hidden="true" />
                        Añadir idioma
                      </Button>
                    </div>
                    {draft.languages.map((lang) => (
                      <div key={lang.id} className="flex items-center gap-2">
                        <Input
                          value={lang.name}
                          maxLength={40}
                          className="flex-1 text-xs"
                          onChange={(e) =>
                            updateDraft((prev) => ({
                              ...prev,
                              languages: prev.languages.map((l) =>
                                l.id === lang.id ? { ...l, name: e.target.value } : l
                              ),
                            }))
                          }
                        />
                        <select
                          value={lang.level}
                          onChange={(e) =>
                            updateDraft((prev) => ({
                              ...prev,
                              languages: prev.languages.map((l) =>
                                l.id === lang.id
                                  ? {
                                      ...l,
                                      level: e.target.value as typeof lang.level,
                                    }
                                  : l
                              ),
                            }))
                          }
                          className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                          aria-label="Nivel de idioma"
                        >
                          {["A1", "A2", "B1", "B2", "C1", "C2", "Nativo"].map((lv) => (
                            <option key={lv} value={lv}>
                              {lv}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            updateDraft((prev) => ({
                              ...prev,
                              languages: prev.languages.filter((l) => l.id !== lang.id),
                            }))
                          }
                          aria-label="Eliminar idioma"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 border-t border-border/60 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        Cursos, Talleres y Certificaciones
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-[11px]"
                        disabled={draft.certifications.length >= 12}
                        onClick={() =>
                          updateDraft((prev) => ({
                            ...prev,
                            certifications: [
                              ...prev.certifications,
                              {
                                id: makeUid("ce"),
                                name: "",
                                issuer: "",
                                year: "2026",
                                credentialUrl: "",
                              },
                            ],
                          }))
                        }
                      >
                        <Plus className="size-3" aria-hidden="true" />
                        Añadir curso
                      </Button>
                    </div>
                    {draft.certifications.map((cert) => (
                      <div
                        key={cert.id}
                        className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <Input
                            value={cert.name}
                            maxLength={110}
                            placeholder="Nombre del curso o certificación"
                            className="flex-1 text-xs"
                            onChange={(e) =>
                              updateDraft((prev) => ({
                                ...prev,
                                certifications: prev.certifications.map((c) =>
                                  c.id === cert.id ? { ...c, name: e.target.value } : c
                                ),
                              }))
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              updateDraft((prev) => ({
                                ...prev,
                                certifications: prev.certifications.filter(
                                  (c) => c.id !== cert.id
                                ),
                              }))
                            }
                            aria-label="Eliminar curso"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            value={cert.issuer}
                            maxLength={90}
                            placeholder="Institución"
                            className="col-span-2 text-xs"
                            onChange={(e) =>
                              updateDraft((prev) => ({
                                ...prev,
                                certifications: prev.certifications.map((c) =>
                                  c.id === cert.id ? { ...c, issuer: e.target.value } : c
                                ),
                              }))
                            }
                          />
                          <Input
                            value={cert.year}
                            maxLength={16}
                            placeholder="Año"
                            className="text-xs"
                            onChange={(e) =>
                              updateDraft((prev) => ({
                                ...prev,
                                certifications: prev.certifications.map((c) =>
                                  c.id === cert.id ? { ...c, year: e.target.value } : c
                                ),
                              }))
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Subsección: Secciones Personalizadas 100 % Libres */}
              {contentGroup === "custom" ? (
                <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-4">
                  <div>
                    <h3 className="text-xs font-semibold text-foreground">
                      Secciones Personalizadas Libres
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Agrega cualquier bloque adicional que quieras lucir: Premios,
                      Deportes, Publicaciones, Voluntariado, Referencias o Logros.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      value={newCustomSectionTitle}
                      maxLength={60}
                      placeholder="Nombre de nueva sección (ej. Reconocimientos)"
                      onChange={(e) => setNewCustomSectionTitle(e.target.value)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        draft.customSections.length >= 6 ||
                        newCustomSectionTitle.trim().length < 2
                      }
                      onClick={() => {
                        const title = newCustomSectionTitle.trim();
                        updateDraft((prev) => ({
                          ...prev,
                          customSections: [
                            ...prev.customSections,
                            {
                              id: makeUid("cs"),
                              title,
                              items: [
                                {
                                  id: makeUid("ci"),
                                  heading: "",
                                  subtitle: "",
                                  period: "",
                                  description: "",
                                },
                              ],
                            },
                          ],
                        }));
                        setNewCustomSectionTitle("");
                      }}
                    >
                      <Plus className="mr-1 size-3.5" aria-hidden="true" />
                      Crear
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {["Reconocimientos", "Actividades Extracurriculares", "Referencias", "Publicaciones"].map(
                      (quick) => (
                        <button
                          key={quick}
                          type="button"
                          disabled={draft.customSections.length >= 6}
                          onClick={() =>
                            updateDraft((prev) => ({
                              ...prev,
                              customSections: [
                                ...prev.customSections,
                                {
                                  id: makeUid("cs"),
                                  title: quick,
                                  items: [
                                    {
                                      id: makeUid("ci"),
                                      heading: "",
                                      subtitle: "",
                                      period: "",
                                      description: "",
                                    },
                                  ],
                                },
                              ],
                            }))
                          }
                          className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-primary"
                        >
                          + {quick}
                        </button>
                      )
                    )}
                  </div>

                  {draft.customSections.map((sec) => (
                    <div
                      key={sec.id}
                      className="space-y-2.5 rounded-xl border border-border/80 bg-muted/20 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Input
                          value={sec.title}
                          maxLength={60}
                          className="h-8 font-semibold text-xs"
                          onChange={(e) =>
                            updateDraft((prev) => ({
                              ...prev,
                              customSections: prev.customSections.map((s) =>
                                s.id === sec.id ? { ...s, title: e.target.value } : s
                              ),
                            }))
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0 text-[11px]"
                          disabled={sec.items.length >= 10}
                          onClick={() =>
                            updateDraft((prev) => ({
                              ...prev,
                              customSections: prev.customSections.map((s) =>
                                s.id === sec.id
                                  ? {
                                      ...s,
                                      items: [
                                        ...s.items,
                                        {
                                          id: makeUid("ci"),
                                          heading: "",
                                          subtitle: "",
                                          period: "",
                                          description: "",
                                        },
                                      ],
                                    }
                                  : s
                              ),
                            }))
                          }
                        >
                          <Plus className="mr-1 size-3" aria-hidden="true" />
                          Ítem
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            updateDraft((prev) => ({
                              ...prev,
                              customSections: prev.customSections.filter(
                                (s) => s.id !== sec.id
                              ),
                            }))
                          }
                          aria-label={`Eliminar sección ${sec.title}`}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>

                      {sec.items.map((item) => (
                        <div
                          key={item.id}
                          className="space-y-1.5 rounded-lg border border-border/60 bg-background p-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <Input
                              value={item.heading}
                              maxLength={100}
                              placeholder="Título del logro o elemento"
                              className="flex-1 text-xs"
                              onChange={(e) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  customSections: prev.customSections.map((s) =>
                                    s.id === sec.id
                                      ? {
                                          ...s,
                                          items: s.items.map((it) =>
                                            it.id === item.id
                                              ? { ...it, heading: e.target.value }
                                              : it
                                          ),
                                        }
                                      : s
                                  ),
                                }))
                              }
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  customSections: prev.customSections.map((s) =>
                                    s.id === sec.id
                                      ? {
                                          ...s,
                                          items: s.items.filter(
                                            (it) => it.id !== item.id
                                          ),
                                        }
                                      : s
                                  ),
                                }))
                              }
                              aria-label="Eliminar elemento"
                            >
                              <Trash2 className="size-3" aria-hidden="true" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              value={item.subtitle}
                              maxLength={80}
                              placeholder="Entidad o subtítulo"
                              className="text-xs"
                              onChange={(e) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  customSections: prev.customSections.map((s) =>
                                    s.id === sec.id
                                      ? {
                                          ...s,
                                          items: s.items.map((it) =>
                                            it.id === item.id
                                              ? { ...it, subtitle: e.target.value }
                                              : it
                                          ),
                                        }
                                      : s
                                  ),
                                }))
                              }
                            />
                            <Input
                              value={item.period}
                              maxLength={40}
                              placeholder="Año / Fecha"
                              className="text-xs"
                              onChange={(e) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  customSections: prev.customSections.map((s) =>
                                    s.id === sec.id
                                      ? {
                                          ...s,
                                          items: s.items.map((it) =>
                                            it.id === item.id
                                              ? { ...it, period: e.target.value }
                                              : it
                                          ),
                                        }
                                      : s
                                  ),
                                }))
                              }
                            />
                          </div>
                          <Textarea
                            rows={2}
                            maxLength={450}
                            value={item.description}
                            placeholder="Detalle breve (opcional)"
                            className="text-xs"
                            onChange={(e) =>
                              updateDraft((prev) => ({
                                ...prev,
                                customSections: prev.customSections.map((s) =>
                                  s.id === sec.id
                                    ? {
                                        ...s,
                                        items: s.items.map((it) =>
                                          it.id === item.id
                                            ? { ...it, description: e.target.value }
                                            : it
                                        ),
                                      }
                                    : s
                                ),
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
            </TabsContent>

            {/* PESTAÑA 2: 10 PLANTILLAS + CONSTRUCTOR PROPIO */}
            <TabsContent value="design" className="mt-4">
              <div className="rounded-2xl border border-border/80 bg-card p-4">
                <PortfolioTemplateGallery
                  templateId={draft.templateId}
                  designConfig={draft.designConfig}
                  onSelectTemplate={(nextId, nextDesign) =>
                    updateDraft((prev) => ({
                      ...prev,
                      templateId: nextId,
                      designConfig: nextDesign,
                    }))
                  }
                  onUpdateDesign={(patch) =>
                    updateDraft((prev) => ({
                      ...prev,
                      designConfig: { ...prev.designConfig, ...patch },
                    }))
                  }
                />
              </div>
            </TabsContent>

            {/* PESTAÑA 3: COACH SOCRÁTICO IA */}
            <TabsContent value="coach" className="mt-4">
              <PortfolioCoachPanel
                activeSignal={activeSignal}
                mencionName={verified.mencionName}
                gradeYear={verified.gradeYear}
                remainingQuota={aiQuotaRemaining}
                quotaLimit={initialData.aiQuotaLimit}
                onQuotaChange={setAiQuotaRemaining}
                onApplySuggestion={handleApplyCoachSuggestion}
                onAddSuggestedSkill={(name) => {
                  addSkill(name, "tecnica", "intermedio");
                  toast.success(`Habilidad "${name}" agregada.`);
                }}
                onClearSignal={() => setActiveSignal(null)}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Columna derecha: Vista Previa A4 Viva con flechas editoriales discretas */}
        <div className="xl:col-span-7">
          <div className="sticky top-5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
              <span>
                Vista previa en vivo · Exacta al PDF descargable
              </span>
              {evaluation.signals.length > 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="size-3" aria-hidden="true" />
                  Haz clic en una señal para mejorar ese bloque con el Coach
                </span>
              ) : (
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  Sin observaciones pendientes — CV sólido
                </span>
              )}
            </div>

            <div className="rounded-3xl border border-border/70 bg-muted/35 p-3 sm:p-5">
              <PortfolioLiveSheet
                draft={draft}
                verified={verified}
                verificationCode={verificationCode}
                verificationBaseUrl={origin}
                signals={evaluation.signals}
                interactive
                onSelectSignal={handleSelectSignal}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modal de importación de CV en PDF */}
      <PortfolioPdfImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        mencionName={verified.mencionName}
        gradeYear={verified.gradeYear}
        onApplyImport={handleApplyPdfImport}
        onQuotaChange={setAiQuotaRemaining}
      />

      {/* Modal de privacidad K12 y enlace compartible */}
      <PortfolioPublicSettingsDialog
        open={privacyOpen}
        onOpenChange={setPrivacyOpen}
        isPublic={draft.isPublic}
        publicSlug={draft.publicSlug}
        privacySettings={draft.privacySettings}
        suggestedSlug={buildSuggestedSlug(verified.fullName, verified.mencionName)}
        onChange={(patch) =>
          updateDraft((prev) => ({
            ...prev,
            isPublic: patch.isPublic ?? prev.isPublic,
            publicSlug: patch.publicSlug ?? prev.publicSlug,
            privacySettings: patch.privacySettings ?? prev.privacySettings,
          }))
        }
        onSaveNow={async () => {
          await handleSave();
        }}
        saving={saving}
      />
    </div>
  );
}
