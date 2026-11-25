"use client";

import {
  Document,
  Image as PdfImage,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import QRCode from "qrcode";
import type { PortfolioSheetVerifiedInfo } from "@/components/portafolio/PortfolioLiveSheet";
import {
  resolvePortfolioDesign,
  type PortfolioSectionKey,
  type StudentPortfolioDraft,
} from "@/lib/validators/portfolio";

const SIDEBAR_SECTIONS = new Set<PortfolioSectionKey>([
  "skills",
  "languages",
  "certifications",
]);

function resolvePdfFontFamily(fontStyle: "modern" | "editorial" | "technical"): {
  regular: string;
  bold: string;
} {
  if (fontStyle === "editorial") {
    return { regular: "Times-Roman", bold: "Times-Bold" };
  }
  if (fontStyle === "technical") {
    return { regular: "Courier", bold: "Courier-Bold" };
  }
  return { regular: "Helvetica", bold: "Helvetica-Bold" };
}

function buildPdfDocument(params: {
  draft: StudentPortfolioDraft;
  verified: PortfolioSheetVerifiedInfo;
  verificationCode: string | null;
  qrDataUrl: string | null;
}) {
  const { draft, verified, verificationCode, qrDataUrl } = params;
  const design = resolvePortfolioDesign(draft.templateId, draft.designConfig);
  const accent = design.accentColor;
  const fonts = resolvePdfFontFamily(design.fontStyle);
  const isBanner =
    design.headerStyle === "banner" || design.headerStyle === "gradient";

  const baseFontSize =
    design.density === "compact" ? 9 : design.density === "spacious" ? 10.5 : 9.8;
  const sectionGap =
    design.density === "compact" ? 10 : design.density === "spacious" ? 16 : 13;

  const styles = StyleSheet.create({
    page: {
      fontFamily: fonts.regular,
      fontSize: baseFontSize,
      color: "#1e293b",
      backgroundColor: "#ffffff",
      paddingBottom: 34,
    },
    header: {
      paddingHorizontal: 30,
      paddingVertical: 20,
      backgroundColor: isBanner
        ? accent
        : design.headerStyle === "split"
          ? "#f8fafc"
          : "#ffffff",
      borderBottomWidth: isBanner ? 0 : 1,
      borderBottomColor: "#e2e8f0",
      borderLeftWidth: design.headerStyle === "split" ? 5 : 0,
      borderLeftColor: accent,
      flexDirection: design.headerStyle === "centered" ? "column" : "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    headerIdentity: {
      flex: 1,
      alignItems: design.headerStyle === "centered" ? "center" : "flex-start",
    },
    name: {
      fontFamily: fonts.bold,
      fontSize: 19,
      color: isBanner ? "#ffffff" : "#0f172a",
    },
    headline: {
      marginTop: 3,
      fontFamily: fonts.bold,
      fontSize: 10.5,
      color: isBanner ? "#e2e8f0" : accent,
    },
    metaLine: {
      marginTop: 6,
      fontSize: 8.5,
      color: isBanner ? "#f1f5f9" : "#475569",
    },
    qrCard: {
      backgroundColor: "#ffffff",
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "#cbd5e1",
      padding: 5,
      alignItems: "center",
      width: 68,
    },
    qrImg: {
      width: 48,
      height: 48,
    },
    qrCodeText: {
      marginTop: 2,
      fontSize: 6.2,
      fontFamily: "Helvetica-Bold",
      color: "#0f172a",
      textAlign: "center",
    },
    bodyWrap: {
      paddingHorizontal: 30,
      paddingTop: 16,
    },
    twoCol: {
      flexDirection: "row",
      gap: 16,
    },
    sidebar: {
      width: "33%",
      backgroundColor: "#f8fafc",
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: "#e2e8f0",
    },
    mainCol: {
      width: "67%",
    },
    section: {
      marginBottom: sectionGap,
    },
    sectionHeading: {
      fontFamily: fonts.bold,
      fontSize: 9.5,
      color: accent,
      textTransform: "uppercase",
      letterSpacing: 0.7,
      borderBottomWidth: 1,
      borderBottomColor: "#e2e8f0",
      paddingBottom: 3,
      marginBottom: 6,
    },
    itemBlock: {
      marginBottom: 7,
    },
    itemHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 8,
    },
    itemTitle: {
      fontFamily: fonts.bold,
      fontSize: baseFontSize,
      color: "#0f172a",
    },
    itemPeriod: {
      fontSize: 8.2,
      color: "#64748b",
    },
    paragraph: {
      lineHeight: 1.45,
      color: "#334155",
      marginTop: 2,
    },
    pillRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 4,
      marginTop: 4,
    },
    pill: {
      backgroundColor: "#f1f5f9",
      borderWidth: 0.8,
      borderColor: "#cbd5e1",
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2.5,
      fontSize: 8.2,
      color: "#1e293b",
    },
    verifiedBox: {
      backgroundColor: "#f8fafc",
      borderWidth: 1,
      borderColor: "#dbe4f0",
      borderRadius: 6,
      padding: 8,
    },
    footer: {
      position: "absolute",
      bottom: 14,
      left: 30,
      right: 30,
      borderTopWidth: 0.8,
      borderTopColor: "#e2e8f0",
      paddingTop: 6,
      flexDirection: "row",
      justifyContent: "space-between",
      fontSize: 7.5,
      color: "#64748b",
    },
  });

  const contactBits: string[] = [];
  if (draft.contactMeta.city) contactBits.push(draft.contactMeta.city);
  if (draft.privacySettings.show_email && verified.institutionalEmail) {
    contactBits.push(verified.institutionalEmail);
  }
  if (draft.privacySettings.show_phone && verified.phone) {
    contactBits.push(verified.phone);
  }
  if (draft.contactMeta.availability) {
    contactBits.push(draft.contactMeta.availability);
  }
  for (const link of draft.contactMeta.links) {
    contactBits.push(`${link.label}: ${link.url.replace(/^https?:\/\//i, "")}`);
  }

  const renderSection = (key: PortfolioSectionKey) => {
    switch (key) {
      case "about":
        if (!draft.aboutSummary.trim()) return null;
        return (
          <View key="about" style={styles.section}>
            <Text style={styles.sectionHeading}>Perfil Profesional</Text>
            <Text style={styles.paragraph}>{draft.aboutSummary}</Text>
          </View>
        );

      case "education":
        return (
          <View key="education" style={styles.section}>
            <Text style={styles.sectionHeading}>Formación Académica Verificada</Text>
            <View style={styles.verifiedBox}>
              <Text style={styles.itemTitle}>
                Técnico Medio · Mención {verified.mencionName ?? "Educación Media Técnica"}
              </Text>
              <Text style={styles.paragraph}>
                Escuela Técnica Comercial &quot;Andrés Bello&quot; · Unare II, Puerto Ordaz (DEA OD01340701)
              </Text>
              <Text style={styles.itemPeriod}>
                {[
                  verified.mencionSpecialty ? `Especialidad: ${verified.mencionSpecialty}` : null,
                  verified.gradeYear
                    ? `${verified.gradeYear}.º Año${verified.sectionLetter ? ` · Sección ${verified.sectionLetter}` : ""}`
                    : null,
                  verified.schoolYearName ? `Período ${verified.schoolYearName}` : null,
                  draft.privacySettings.show_average && verified.averageGrade !== null
                    ? `Promedio verificado: ${verified.averageGrade}/20`
                    : null,
                ]
                  .filter(Boolean)
                  .join("  |  ")}
              </Text>
              {draft.privacySettings.show_medals &&
              (verified.medalsUnlocked?.length ?? 0) > 0 ? (
                <View style={styles.pillRow}>
                  {verified.medalsUnlocked?.map((m) => (
                    <Text key={m.id} style={styles.pill}>
                      ★ {m.title}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        );

      case "projects":
        if (draft.projects.length === 0) return null;
        return (
          <View key="projects" style={styles.section}>
            <Text style={styles.sectionHeading}>Proyectos Técnicos y Socioproductivos</Text>
            {draft.projects.map((p) => (
              <View key={p.id} style={styles.itemBlock}>
                <View style={styles.itemHeaderRow}>
                  <Text style={styles.itemTitle}>
                    {p.title}
                    {p.role ? ` — ${p.role}` : ""}
                  </Text>
                  {p.period ? <Text style={styles.itemPeriod}>{p.period}</Text> : null}
                </View>
                {p.summary ? <Text style={styles.paragraph}>{p.summary}</Text> : null}
                {p.impact ? (
                  <Text style={styles.paragraph}>Impacto: {p.impact}</Text>
                ) : null}
                {p.tools.length > 0 ? (
                  <View style={styles.pillRow}>
                    {p.tools.map((t) => (
                      <Text key={t} style={styles.pill}>
                        {t}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        );

      case "experience":
        if (draft.experience.length === 0) return null;
        return (
          <View key="experience" style={styles.section}>
            <Text style={styles.sectionHeading}>Experiencia y Prácticas</Text>
            {draft.experience.map((exp) => (
              <View key={exp.id} style={styles.itemBlock}>
                <View style={styles.itemHeaderRow}>
                  <Text style={styles.itemTitle}>
                    {exp.role} · {exp.organization}
                  </Text>
                  {exp.period ? (
                    <Text style={styles.itemPeriod}>{exp.period}</Text>
                  ) : null}
                </View>
                {exp.summary ? (
                  <Text style={styles.paragraph}>{exp.summary}</Text>
                ) : null}
                {exp.achievements.map((ach, idx) => (
                  <Text key={idx} style={styles.paragraph}>
                    • {ach}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        );

      case "skills":
        if (draft.skills.length === 0) return null;
        return (
          <View key="skills" style={styles.section}>
            <Text style={styles.sectionHeading}>Habilidades</Text>
            <View style={styles.pillRow}>
              {draft.skills.map((s) => (
                <Text key={s.id} style={styles.pill}>
                  {s.name}
                </Text>
              ))}
            </View>
          </View>
        );

      case "languages":
        if (draft.languages.length === 0) return null;
        return (
          <View key="languages" style={styles.section}>
            <Text style={styles.sectionHeading}>Idiomas</Text>
            {draft.languages.map((l) => (
              <Text key={l.id} style={styles.paragraph}>
                • {l.name} — {l.level}
              </Text>
            ))}
          </View>
        );

      case "certifications":
        if (draft.certifications.length === 0) return null;
        return (
          <View key="certifications" style={styles.section}>
            <Text style={styles.sectionHeading}>Cursos y Certificaciones</Text>
            {draft.certifications.map((c) => (
              <View key={c.id} style={styles.itemBlock}>
                <Text style={styles.itemTitle}>{c.name}</Text>
                <Text style={styles.itemPeriod}>
                  {[c.issuer, c.year].filter(Boolean).join(" · ")}
                </Text>
              </View>
            ))}
          </View>
        );

      case "custom": {
        const nonEmpty = draft.customSections.filter((s) => s.items.length > 0);
        if (nonEmpty.length === 0) return null;
        return (
          <View key="custom">
            {nonEmpty.map((sec) => (
              <View key={sec.id} style={styles.section}>
                <Text style={styles.sectionHeading}>{sec.title}</Text>
                {sec.items.map((item) => (
                  <View key={item.id} style={styles.itemBlock}>
                    <View style={styles.itemHeaderRow}>
                      <Text style={styles.itemTitle}>
                        {item.heading}
                        {item.subtitle ? ` · ${item.subtitle}` : ""}
                      </Text>
                      {item.period ? (
                        <Text style={styles.itemPeriod}>{item.period}</Text>
                      ) : null}
                    </View>
                    {item.description ? (
                      <Text style={styles.paragraph}>{item.description}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ))}
          </View>
        );
      }
    }
  };

  const sidebarKeys = design.sectionOrder.filter((k) => SIDEBAR_SECTIONS.has(k));
  const mainKeys = design.sectionOrder.filter((k) => !SIDEBAR_SECTIONS.has(k));

  return (
    <Document
      title={`CV Técnico — ${verified.fullName}`}
      author={verified.fullName}
      subject='Portafolio Técnico Verificado — E.T.C. "Andrés Bello"'
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerIdentity}>
            <Text style={styles.name}>{verified.fullName}</Text>
            <Text style={styles.headline}>
              {draft.headline.trim() ||
                `Técnico Medio en ${verified.mencionName ?? "Comercio y Servicios"}`}
            </Text>
            {contactBits.length > 0 ? (
              <Text style={styles.metaLine}>{contactBits.join("  •  ")}</Text>
            ) : null}
          </View>

          {design.showQrSeal && qrDataUrl && verificationCode ? (
            <View style={styles.qrCard}>
              <PdfImage src={qrDataUrl} style={styles.qrImg} />
              <Text style={styles.qrCodeText}>{verificationCode}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.bodyWrap}>
          {design.layout === "single" ? (
            design.sectionOrder.map((key) => renderSection(key))
          ) : (
            <View style={styles.twoCol}>
              {design.layout === "sidebar_left" ? (
                <>
                  <View style={styles.sidebar}>
                    {sidebarKeys.map((key) => renderSection(key))}
                  </View>
                  <View style={styles.mainCol}>
                    {mainKeys.map((key) => renderSection(key))}
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.mainCol}>
                    {mainKeys.map((key) => renderSection(key))}
                  </View>
                  <View style={styles.sidebar}>
                    {sidebarKeys.map((key) => renderSection(key))}
                  </View>
                </>
              )}
            </View>
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text>
            E.T.C. &quot;Andrés Bello&quot; · Unare II, Puerto Ordaz · Código DEA OD01340701
          </Text>
          <Text>
            {verificationCode
              ? `Verifica este documento con código ${verificationCode}`
              : "Emitido desde S.I.G.A."}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/**
 * Genera y descarga el PDF del Portafolio Técnico 100 % en el navegador (0 MB en servidor)
 * respetando la plantilla elegida e incrustando el código QR verificable oficial.
 */
export async function downloadStudentTechnicalCvPdf(params: {
  draft: StudentPortfolioDraft;
  verified: PortfolioSheetVerifiedInfo;
  verificationCode: string | null;
}): Promise<void> {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://siga.etcandresbello.org";
  let qrDataUrl: string | null = null;
  if (params.verificationCode) {
    const verifyUrl = `${origin}/verificar?code=${encodeURIComponent(params.verificationCode)}`;
    qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: "M",
    });
  }

  const doc = buildPdfDocument({
    draft: params.draft,
    verified: params.verified,
    verificationCode: params.verificationCode,
    qrDataUrl,
  });

  const blob = await pdf(doc).toBlob();
  const safeName = params.verified.fullName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `CV-Tecnico-${safeName || "estudiante"}-ETC-Andres-Bello.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
