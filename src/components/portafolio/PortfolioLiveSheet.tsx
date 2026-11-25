"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Award,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "cn";
import type { SelectiveCoachSignal } from "@/features/portafolio/cv-scoring";
import {
  resolvePortfolioDesign,
  type PortfolioSectionKey,
  type StudentPortfolioDraft,
} from "@/lib/validators/portfolio";

export interface PortfolioSheetVerifiedInfo {
  fullName: string;
  avatarUrl: string | null;
  institutionalEmail: string | null;
  phone: string | null;
  mencionName: string | null;
  mencionSpecialty: string | null;
  gradeYear: number | null;
  sectionLetter: string | null;
  schoolYearName: string | null;
  enrollmentStatus: string | null;
  averageGrade: number | null;
  medalsUnlocked?: Array<{ id: string; title: string }>;
}

export interface PortfolioLiveSheetProps {
  draft: StudentPortfolioDraft;
  verified: PortfolioSheetVerifiedInfo;
  verificationCode: string | null;
  verificationBaseUrl?: string;
  signals?: SelectiveCoachSignal[];
  interactive?: boolean;
  onSelectSignal?: (signal: SelectiveCoachSignal) => void;
}

const SIDEBAR_SECTIONS = new Set<PortfolioSectionKey>([
  "skills",
  "languages",
  "certifications",
]);

function SkillLevelLabel(level: "basico" | "intermedio" | "avanzado"): string {
  if (level === "avanzado") return "Avanzado";
  if (level === "intermedio") return "Intermedio";
  return "Básico";
}

/**
 * Señal editorial discreta (flecha fina + globo elegante) que solo aparece
 * junto a un bloque cuando existe una mejora de alto impacto real.
 */
function EditorialSignalCallout({
  signal,
  onSelect,
}: {
  signal: SelectiveCoachSignal;
  onSelect: (sig: SelectiveCoachSignal) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(signal)}
      className="group inline-flex items-center gap-1.5 rounded-full border border-indigo-200/90 bg-indigo-50/95 px-2.5 py-0.5 text-[10.5px] font-medium text-indigo-800 shadow-xs transition-all hover:border-indigo-400 hover:bg-indigo-100"
      title={signal.whyItMatters}
    >
      <svg
        width="16"
        height="12"
        viewBox="0 0 18 12"
        fill="none"
        className="shrink-0 text-indigo-600 transition-transform group-hover:-translate-x-0.5"
        aria-hidden="true"
      >
        <path
          d="M16 6H3M3 6L7.5 1.5M3 6L7.5 10.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <Sparkles className="size-2.5 shrink-0 text-indigo-600" aria-hidden="true" />
      <span>{signal.shortCue}</span>
    </button>
  );
}

export function PortfolioLiveSheet({
  draft,
  verified,
  verificationCode,
  verificationBaseUrl = "",
  signals = [],
  interactive = false,
  onSelectSignal,
}: PortfolioLiveSheetProps) {
  const design = resolvePortfolioDesign(draft.templateId, draft.designConfig);
  const accent = design.accentColor;

  const fontClass =
    design.fontStyle === "editorial"
      ? "font-serif"
      : design.fontStyle === "technical"
        ? "font-mono"
        : "font-sans";

  const spacingClass =
    design.density === "compact"
      ? "space-y-3 text-[11.5px] leading-snug"
      : design.density === "spacious"
        ? "space-y-6 text-[13px] leading-relaxed"
        : "space-y-4.5 text-[12.5px] leading-relaxed";

  const showEmail = draft.privacySettings.show_email && verified.institutionalEmail;
  const showPhone = draft.privacySettings.show_phone && verified.phone;
  const showPhoto = design.showPhoto && draft.privacySettings.show_photo && verified.avatarUrl;
  const showAverage = draft.privacySettings.show_average && verified.averageGrade !== null;
  const showMedals =
    draft.privacySettings.show_medals &&
    (verified.medalsUnlocked?.length ?? 0) > 0;

  const verifyUrl = verificationCode
    ? `${verificationBaseUrl}/verificar?code=${encodeURIComponent(verificationCode)}`
    : null;

  const findSignal = (key: SelectiveCoachSignal["sectionKey"]) =>
    interactive ? signals.find((s) => s.sectionKey === key) ?? null : null;

  const renderSectionHeading = (
    title: string,
    signalKey?: SelectiveCoachSignal["sectionKey"]
  ) => {
    const sig = signalKey ? findSignal(signalKey) : null;
    return (
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-1">
        <h3
          className="text-[11px] font-bold tracking-[0.09em] uppercase"
          style={{ color: accent }}
        >
          {title}
        </h3>
        {sig && onSelectSignal ? (
          <EditorialSignalCallout signal={sig} onSelect={onSelectSignal} />
        ) : null}
      </div>
    );
  };

  const renderSection = (key: PortfolioSectionKey): React.ReactNode => {
    switch (key) {
      case "about": {
        const sig = findSignal("about");
        if (!draft.aboutSummary.trim() && !sig) return null;
        return (
          <section key="about">
            {renderSectionHeading("Perfil Profesional", "about")}
            {draft.aboutSummary.trim() ? (
              <p className="whitespace-pre-line text-slate-700">
                {draft.aboutSummary}
              </p>
            ) : (
              <p className="italic text-slate-400">
                Describe en 3 o 4 líneas tu enfoque técnico y lo que puedes aportar en tu mención.
              </p>
            )}
          </section>
        );
      }

      case "education": {
        return (
          <section key="education">
            {renderSectionHeading("Formación Académica Verificada")}
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">
                    Técnico Medio · Mención {verified.mencionName ?? "Comercio y Servicios"}
                  </p>
                  <p className="text-[11.5px] text-slate-600">
                    Escuela Técnica Comercial &ldquo;Andrés Bello&rdquo; · Código DEA OD01340701
                  </p>
                </div>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    backgroundColor: `${accent}15`,
                    color: accent,
                  }}
                >
                  <ShieldCheck className="size-3" aria-hidden="true" />
                  Verificado S.I.G.A.
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
                {verified.mencionSpecialty ? (
                  <span>Especialidad: {verified.mencionSpecialty}</span>
                ) : null}
                {verified.gradeYear ? (
                  <span>
                    Cursando: {verified.gradeYear}.º Año
                    {verified.sectionLetter ? ` · Sección ${verified.sectionLetter}` : ""}
                  </span>
                ) : null}
                {verified.schoolYearName ? (
                  <span>Período {verified.schoolYearName}</span>
                ) : null}
                {showAverage ? (
                  <span className="font-semibold text-slate-900">
                    Promedio verificado: {verified.averageGrade}/20 pts
                  </span>
                ) : null}
              </div>
              {showMedals ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {verified.medalsUnlocked?.map((medal) => (
                    <span
                      key={medal.id}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700"
                    >
                      <Award className="size-2.5" style={{ color: accent }} aria-hidden="true" />
                      {medal.title}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        );
      }

      case "projects": {
        const sig = findSignal("projects");
        if (draft.projects.length === 0 && !sig) return null;
        return (
          <section key="projects">
            {renderSectionHeading("Proyectos Técnicos y Socioproductivos", "projects")}
            {draft.projects.length === 0 ? (
              <p className="italic text-slate-400">
                Agrega tus proyectos prácticos, prototipos o trabajos de mención.
              </p>
            ) : (
              <div className="space-y-3">
                {draft.projects.map((proj) => (
                  <div key={proj.id} className="space-y-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold text-slate-900">
                        {proj.title}
                        {proj.role ? (
                          <span className="font-normal text-slate-600">
                            {" "}— {proj.role}
                          </span>
                        ) : null}
                      </p>
                      {proj.period ? (
                        <span className="text-[11px] font-medium text-slate-500">
                          {proj.period}
                        </span>
                      ) : null}
                    </div>
                    {proj.summary ? (
                      <p className="text-slate-700">{proj.summary}</p>
                    ) : null}
                    {proj.impact ? (
                      <p className="text-[11.5px] font-medium text-slate-800">
                        Impacto: <span className="font-normal">{proj.impact}</span>
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {proj.tools.map((tool) => (
                        <span
                          key={tool}
                          className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: `${accent}12`,
                            color: accent,
                          }}
                        >
                          {tool}
                        </span>
                      ))}
                      {proj.url ? (
                        <a
                          href={proj.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[10.5px] font-medium underline"
                          style={{ color: accent }}
                        >
                          Ver enlace
                          <ExternalLink className="size-2.5" aria-hidden="true" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      }

      case "experience": {
        const sig = findSignal("experience");
        if (draft.experience.length === 0 && !sig) return null;
        return (
          <section key="experience">
            {renderSectionHeading("Experiencia, Prácticas y Voluntariado", "experience")}
            <div className="space-y-3">
              {draft.experience.map((exp) => (
                <div key={exp.id} className="space-y-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-slate-900">
                      {exp.role}{" "}
                      <span className="font-normal text-slate-600">
                        · {exp.organization}
                      </span>
                    </p>
                    {exp.period ? (
                      <span className="text-[11px] text-slate-500">{exp.period}</span>
                    ) : null}
                  </div>
                  {exp.summary ? (
                    <p className="text-slate-700">{exp.summary}</p>
                  ) : null}
                  {exp.achievements.length > 0 ? (
                    <ul className="list-disc space-y-0.5 pl-4 text-slate-700">
                      {exp.achievements.map((ach, idx) => (
                        <li key={idx}>{ach}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        );
      }

      case "skills": {
        const sig = findSignal("skills");
        if (draft.skills.length === 0 && !sig) return null;
        return (
          <section key="skills">
            {renderSectionHeading("Habilidades y Competencias", "skills")}
            {draft.skills.length === 0 ? (
              <p className="italic text-slate-400">
                Añade habilidades técnicas, herramientas y fortalezas de tu mención.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {draft.skills.map((skill) => (
                  <span
                    key={skill.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-800"
                  >
                    <span>{skill.name}</span>
                    <span className="text-[9.5px] text-slate-500">
                      · {SkillLevelLabel(skill.level)}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </section>
        );
      }

      case "languages": {
        if (draft.languages.length === 0) return null;
        return (
          <section key="languages">
            {renderSectionHeading("Idiomas")}
            <div className="flex flex-wrap gap-2">
              {draft.languages.map((lang) => (
                <div
                  key={lang.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1 text-[11px]"
                >
                  <span className="font-semibold text-slate-800">{lang.name}</span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[9.5px] font-bold"
                    style={{ backgroundColor: `${accent}14`, color: accent }}
                  >
                    {lang.level}
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
      }

      case "certifications": {
        if (draft.certifications.length === 0) return null;
        return (
          <section key="certifications">
            {renderSectionHeading("Cursos y Certificaciones")}
            <div className="space-y-1.5">
              {draft.certifications.map((cert) => (
                <div
                  key={cert.id}
                  className="flex flex-wrap items-baseline justify-between gap-2"
                >
                  <p className="text-slate-800">
                    <span className="font-semibold">{cert.name}</span>
                    {cert.issuer ? (
                      <span className="text-slate-600"> — {cert.issuer}</span>
                    ) : null}
                  </p>
                  {cert.year ? (
                    <span className="text-[11px] text-slate-500">{cert.year}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        );
      }

      case "custom": {
        const nonEmpty = draft.customSections.filter((s) => s.items.length > 0);
        if (nonEmpty.length === 0) return null;
        return (
          <React.Fragment key="custom">
            {nonEmpty.map((sec) => (
              <section key={sec.id}>
                {renderSectionHeading(sec.title)}
                <div className="space-y-2.5">
                  {sec.items.map((item) => (
                    <div key={item.id} className="space-y-0.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-semibold text-slate-900">
                          {item.heading}
                          {item.subtitle ? (
                            <span className="font-normal text-slate-600">
                              {" "}· {item.subtitle}
                            </span>
                          ) : null}
                        </p>
                        {item.period ? (
                          <span className="text-[11px] text-slate-500">
                            {item.period}
                          </span>
                        ) : null}
                      </div>
                      {item.description ? (
                        <p className="text-slate-700">{item.description}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </React.Fragment>
        );
      }
    }
  };

  const headlineSignal = findSignal("headline");
  const isBannerHeader =
    design.headerStyle === "banner" || design.headerStyle === "gradient";

  const sidebarKeys = design.sectionOrder.filter((k) => SIDEBAR_SECTIONS.has(k));
  const mainKeys = design.sectionOrder.filter((k) => !SIDEBAR_SECTIONS.has(k));

  return (
    <article
      className={cn(
        "mx-auto w-full max-w-[760px] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl",
        fontClass
      )}
    >
      {/* Cabecera según estilo elegido */}
      <header
        className={cn(
          "px-7 py-6",
          design.headerStyle === "centered" && "text-center",
          design.headerStyle === "minimal" && "border-b border-slate-200 bg-white",
          design.headerStyle === "split" && "border-b border-slate-200 bg-slate-50/70"
        )}
        style={
          isBannerHeader
            ? {
                background:
                  design.headerStyle === "gradient"
                    ? `linear-gradient(135deg, ${accent} 0%, #0b1d59 100%)`
                    : accent,
                color: "#ffffff",
              }
            : design.headerStyle === "split"
              ? { borderLeft: `6px solid ${accent}` }
              : undefined
        }
      >
        <div
          className={cn(
            "flex gap-4",
            design.headerStyle === "centered"
              ? "flex-col items-center"
              : "flex-col items-start sm:flex-row sm:items-center sm:justify-between"
          )}
        >
          <div
            className={cn(
              "flex items-center gap-4",
              design.headerStyle === "centered" && "flex-col text-center"
            )}
          >
            {showPhoto && verified.avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={verified.avatarUrl}
                alt={verified.fullName}
                className="size-16 shrink-0 rounded-2xl border-2 border-white/80 object-cover shadow-sm"
              />
            ) : null}
            <div>
              <h1
                className={cn(
                  "text-2xl font-bold tracking-tight",
                  isBannerHeader ? "text-white" : "text-slate-900"
                )}
              >
                {verified.fullName}
              </h1>
              <div
                className={cn(
                  "mt-1 flex flex-wrap items-center gap-2",
                  design.headerStyle === "centered" && "justify-center"
                )}
              >
                <p
                  className={cn(
                    "text-sm font-medium",
                    isBannerHeader ? "text-white/90" : "text-slate-600"
                  )}
                  style={!isBannerHeader ? { color: accent } : undefined}
                >
                  {draft.headline.trim() ||
                    `Estudiante de ${verified.mencionName ?? "Educación Media Técnica"}`}
                </p>
                {headlineSignal && onSelectSignal ? (
                  <EditorialSignalCallout
                    signal={headlineSignal}
                    onSelect={onSelectSignal}
                  />
                ) : null}
              </div>

              {/* Metadatos de contacto */}
              <div
                className={cn(
                  "mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px]",
                  isBannerHeader ? "text-white/85" : "text-slate-600",
                  design.headerStyle === "centered" && "justify-center"
                )}
              >
                {draft.contactMeta.city ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" aria-hidden="true" />
                    {draft.contactMeta.city}
                  </span>
                ) : null}
                {showEmail ? (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="size-3" aria-hidden="true" />
                    {verified.institutionalEmail}
                  </span>
                ) : null}
                {showPhone ? (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="size-3" aria-hidden="true" />
                    {verified.phone}
                  </span>
                ) : null}
                {draft.contactMeta.availability ? (
                  <span className="font-medium">
                    · {draft.contactMeta.availability}
                  </span>
                ) : null}
                {draft.contactMeta.links.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center gap-1 underline",
                      isBannerHeader ? "text-white" : "text-slate-700"
                    )}
                  >
                    <Globe className="size-3" aria-hidden="true" />
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Sello QR compacto en cabecera */}
          {design.showQrSeal && verifyUrl ? (
            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200/80 bg-white p-2 text-slate-900 shadow-xs">
              <QRCodeSVG value={verifyUrl} size={52} level="M" />
              <div className="max-w-[92px] text-[9px] leading-tight text-slate-600">
                <p className="font-bold text-slate-900">Verificado S.I.G.A.</p>
                <p className="mt-0.5 font-mono text-[8.5px]">{verificationCode}</p>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {/* Cuerpo del CV */}
      <div className="px-7 py-6">
        {design.layout === "single" ? (
          <div className={spacingClass}>
            {design.sectionOrder.map((key) => renderSection(key))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            {design.layout === "sidebar_left" ? (
              <>
                <aside
                  className={cn(
                    "rounded-xl p-4 md:col-span-4",
                    spacingClass
                  )}
                  style={{ backgroundColor: `${accent}0a` }}
                >
                  {sidebarKeys.map((key) => renderSection(key))}
                </aside>
                <div className={cn("md:col-span-8", spacingClass)}>
                  {mainKeys.map((key) => renderSection(key))}
                </div>
              </>
            ) : (
              <>
                <div className={cn("md:col-span-8", spacingClass)}>
                  {mainKeys.map((key) => renderSection(key))}
                </div>
                <aside
                  className={cn(
                    "rounded-xl p-4 md:col-span-4",
                    spacingClass
                  )}
                  style={{ backgroundColor: `${accent}0a` }}
                >
                  {sidebarKeys.map((key) => renderSection(key))}
                </aside>
              </>
            )}
          </div>
        )}
      </div>

      {/* Pie discreto institucional */}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/70 px-7 py-2.5 text-[10px] text-slate-500">
        <span>
          E.T.C. &ldquo;Andrés Bello&rdquo; · Unare II, Puerto Ordaz · Código DEA OD01340701
        </span>
        <span>
          {verificationCode
            ? `Código de autenticidad: ${verificationCode}`
            : "Guarda tu portafolio para generar tu código QR verificable"}
        </span>
      </footer>
    </article>
  );
}
