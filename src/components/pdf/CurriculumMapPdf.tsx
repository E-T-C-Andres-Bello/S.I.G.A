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
import { loadLogoAsPngDataUrl } from "@/components/pdf/OfficialDocumentPdf";
import { getCurriculumStatusLabel } from "@/features/estudiante/curriculum-tracks";
import type {
  CurriculumMencionCatalog,
  StudentCurriculumOverviewData,
} from "@/features/estudiante/subjects-data";

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 38,
    paddingHorizontal: 36,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: "#1c47c4",
    paddingBottom: 10,
    marginBottom: 14,
    gap: 10,
  },
  logo: {
    width: 40,
    height: 40,
  },
  headerTextBlock: {
    flex: 1,
  },
  ministryText: {
    fontSize: 8,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  schoolName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#0b1d59",
    marginTop: 2,
  },
  schoolMeta: {
    fontSize: 8,
    color: "#475569",
    marginTop: 1.5,
  },
  badge: {
    backgroundColor: "#e8eefb",
    color: "#1c47c4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  title: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#090d16",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9,
    color: "#475569",
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#0b1d59",
    marginTop: 10,
    marginBottom: 6,
  },
  yearBlock: {
    borderWidth: 0.8,
    borderColor: "#cbd5e1",
    borderRadius: 5,
    padding: 8,
    marginBottom: 8,
    backgroundColor: "#f8fafc",
  },
  yearHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: "#cbd5e1",
    paddingBottom: 4,
    marginBottom: 4,
  },
  yearTitle: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: "#0b1d59",
  },
  yearHours: {
    fontSize: 8.5,
    color: "#1c47c4",
    fontFamily: "Helvetica-Bold",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2.5,
    borderBottomWidth: 0.4,
    borderBottomColor: "#e2e8f0",
  },
  colCode: {
    width: "16%",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#334155",
  },
  colName: {
    width: "46%",
    fontSize: 8.5,
    color: "#0f172a",
  },
  colAxis: {
    width: "18%",
    fontSize: 8,
    color: "#475569",
  },
  colHours: {
    width: "8%",
    fontSize: 8,
    textAlign: "right",
    color: "#334155",
  },
  colStatus: {
    width: "12%",
    fontSize: 8,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    color: "#1c47c4",
  },
  footerNote: {
    marginTop: 12,
    borderTopWidth: 0.75,
    borderTopColor: "#cbd5e1",
    paddingTop: 8,
    fontSize: 7.5,
    color: "#64748b",
    lineHeight: 1.4,
  },
});

function CurriculumMapDocumentLayout({
  data,
  mencion,
  generatedAt,
  logoDataUrl,
}: {
  data: StudentCurriculumOverviewData;
  mencion: CurriculumMencionCatalog;
  generatedAt: string;
  logoDataUrl: string | null;
}) {
  return (
    <Document title={`Pensum ${mencion.name} - ${data.studentFullName}`}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          {logoDataUrl ? (
            <PdfImage src={logoDataUrl} style={styles.logo} />
          ) : null}
          <View style={styles.headerTextBlock}>
            <Text style={styles.ministryText}>
              República Bolivariana de Venezuela · MPPE
            </Text>
            <Text style={styles.schoolName}>
              Escuela Técnica Comercial &ldquo;Andrés Bello&rdquo;
            </Text>
            <Text style={styles.schoolMeta}>
              Unare II, Puerto Ordaz, Estado Bolívar · Código DEA: OD01340701
            </Text>
          </View>
          <Text style={styles.badge}>PENSUM 1.º–6.º</Text>
        </View>

        <Text style={styles.title}>
          Mapa Curricular · Mención {mencion.name}
        </Text>
        <Text style={styles.subtitle}>
          Estudiante: {data.studentFullName} ({data.cedulaDisplay})
          {data.hasEnrollment && data.gradeYear
            ? ` · Matrícula activa: ${data.gradeYear}.º Año Sección ${data.sectionLetter ?? "—"} (${data.schoolYearName ?? "Período vigente"})`
            : ""}
          {` · Generado el ${generatedAt}`}
        </Text>

        {mencion.years.map((yr) => (
          <View key={yr.gradeYear} style={styles.yearBlock} wrap={false}>
            <View style={styles.yearHeader}>
              <Text style={styles.yearTitle}>
                {yr.gradeYear}.º Año de Educación Media Técnica
                {yr.gradeYear === 6 ? " (Pasantías)" : ""}
              </Text>
              <Text style={styles.yearHours}>
                {yr.subjectsCount} asignaturas · {yr.totalWeeklyHours} h/sem
              </Text>
            </View>

            {yr.subjects.map((sub) => {
              const gradeLabel =
                sub.finalNumeric !== null
                  ? `${sub.finalNumeric} pts`
                  : sub.finalLiteral
                    ? `Lit. ${sub.finalLiteral}`
                    : getCurriculumStatusLabel(sub.status);
              return (
                <View key={sub.curriculumSubjectId} style={styles.row}>
                  <Text style={styles.colCode}>{sub.subjectCode}</Text>
                  <Text style={styles.colName}>{sub.subjectName}</Text>
                  <Text style={styles.colAxis}>
                    {sub.isTechnicalCore ? "Núcleo Técnico" : "Formación Común"}
                  </Text>
                  <Text style={styles.colHours}>{sub.weeklyHours}h</Text>
                  <Text style={styles.colStatus}>{gradeLabel}</Text>
                </View>
              );
            })}
          </View>
        ))}

        <Text style={styles.footerNote}>
          Documento informativo de orientación académica generado directamente en
          el navegador del estudiante desde S.I.G.A. Para constancias o
          certificaciones oficiales con código QR verificable, utilice la
          sección Trámites ante Control de Estudios y Secretaría.
        </Text>
      </Page>
    </Document>
  );
}

/**
 * Genera y descarga el Mapa Curricular completo en PDF desde el navegador (`0 MB` en servidor).
 */
export async function downloadCurriculumMapPdf(
  data: StudentCurriculumOverviewData,
  mencion: CurriculumMencionCatalog
): Promise<void> {
  const logoDataUrl = await loadLogoAsPngDataUrl();
  const generatedAt = new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    dateStyle: "medium",
  }).format(new Date());

  const blob = await pdf(
    <CurriculumMapDocumentLayout
      data={data}
      mencion={mencion}
      generatedAt={generatedAt}
      logoDataUrl={logoDataUrl}
    />
  ).toBlob();

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `SIGA-Pensum-${mencion.code}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}
