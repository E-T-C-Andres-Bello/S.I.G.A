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
import {
  formatPromedioDisplay,
  getHistorySubjectStatusLabel,
  type AcademicHistoryMomentValue,
} from "@/features/estudiante/academic-history";
import type { StudentCurriculumOverviewData } from "@/features/estudiante/subjects-data";

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 38,
    paddingHorizontal: 34,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: "#1c47c4",
    paddingBottom: 9,
    marginBottom: 12,
    gap: 10,
  },
  logo: {
    width: 38,
    height: 38,
  },
  headerTextBlock: {
    flex: 1,
  },
  ministryText: {
    fontSize: 7.5,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  schoolName: {
    fontSize: 11.5,
    fontFamily: "Helvetica-Bold",
    color: "#0b1d59",
    marginTop: 2,
  },
  schoolMeta: {
    fontSize: 7.5,
    color: "#475569",
    marginTop: 1.5,
  },
  badge: {
    backgroundColor: "#e8eefb",
    color: "#1c47c4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
  },
  title: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#090d16",
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 8.5,
    color: "#475569",
    marginBottom: 12,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    borderWidth: 0.75,
    borderColor: "#cbd5e1",
    borderRadius: 5,
    padding: 8,
    backgroundColor: "#f8fafc",
  },
  kpiLabel: {
    fontSize: 7.5,
    color: "#475569",
    marginBottom: 3,
  },
  kpiValue: {
    fontSize: 12.5,
    fontFamily: "Helvetica-Bold",
    color: "#0b1d59",
  },
  kpiSub: {
    fontSize: 7,
    color: "#64748b",
    marginTop: 2,
  },
  periodBlock: {
    borderWidth: 0.75,
    borderColor: "#cbd5e1",
    borderRadius: 5,
    padding: 8,
    marginBottom: 10,
    backgroundColor: "#ffffff",
  },
  periodHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.6,
    borderBottomColor: "#cbd5e1",
    paddingBottom: 5,
    marginBottom: 5,
  },
  periodTitle: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: "#0b1d59",
  },
  periodMeta: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#1c47c4",
  },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 0.6,
    borderBottomColor: "#cbd5e1",
    paddingBottom: 3,
    marginBottom: 2,
    backgroundColor: "#f8fafc",
    paddingVertical: 3,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 0.4,
    borderBottomColor: "#e2e8f0",
  },
  colArea: {
    width: "44%",
    fontSize: 8,
    color: "#0f172a",
    paddingRight: 4,
  },
  colAreaHead: {
    width: "44%",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    paddingRight: 4,
  },
  colMoment: {
    width: "10%",
    fontSize: 8,
    textAlign: "center",
    color: "#334155",
  },
  colMomentHead: {
    width: "10%",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    color: "#475569",
  },
  colDef: {
    width: "12%",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    color: "#0b1d59",
  },
  colDefHead: {
    width: "12%",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    color: "#475569",
  },
  colStatus: {
    width: "14%",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    color: "#1c47c4",
  },
  colStatusHead: {
    width: "14%",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    color: "#475569",
  },
  pendingSection: {
    borderWidth: 0.75,
    borderColor: "#f59e0b",
    borderRadius: 5,
    padding: 8,
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: "#fffbeb",
  },
  pendingTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#92400e",
    marginBottom: 4,
  },
  pendingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2.5,
    borderBottomWidth: 0.4,
    borderBottomColor: "#fde68a",
  },
  footerNote: {
    marginTop: 10,
    borderTopWidth: 0.75,
    borderTopColor: "#cbd5e1",
    paddingTop: 7,
    fontSize: 7.5,
    color: "#64748b",
    lineHeight: 1.4,
  },
});

function formatMomentCell(m: AcademicHistoryMomentValue | null): string {
  if (!m) return "—";
  if (m.numeric !== null) return String(m.numeric);
  if (m.literal) return m.literal;
  return "—";
}

function AcademicRecordDocumentLayout({
  data,
  generatedAt,
  logoDataUrl,
}: {
  data: StudentCurriculumOverviewData;
  generatedAt: string;
  logoDataUrl: string | null;
}) {
  const { academicHistory } = data;

  return (
    <Document title={`Récord Académico - ${data.studentFullName}`}>
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
          <Text style={styles.badge}>RÉCORD ACADÉMICO</Text>
        </View>

        <Text style={styles.title}>
          Historial de Calificaciones y Promedio General
        </Text>
        <Text style={styles.subtitle}>
          Estudiante: {data.studentFullName} ({data.cedulaDisplay})
          {data.hasEnrollment && data.gradeYear
            ? ` · Matrícula vigente: ${data.gradeYear}.º Año Sección ${data.sectionLetter ?? "—"} · Mención ${data.mencionName ?? "Técnica"}`
            : ""}
          {` · Emitido el ${generatedAt}`}
        </Text>

        {/* Resumen de 4 indicadores */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Promedio general acumulado</Text>
            <Text style={styles.kpiValue}>
              {academicHistory.overallCumulativeAverage !== null
                ? `${formatPromedioDisplay(academicHistory.overallCumulativeAverage)} / 20`
                : "Sin notas"}
            </Text>
            <Text style={styles.kpiSub}>
              {academicHistory.overallEvaluatedNumericCount} área(s) evaluada(s)
            </Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Promedio del año actual</Text>
            <Text style={styles.kpiValue}>
              {academicHistory.currentYearAverage !== null
                ? `${formatPromedioDisplay(academicHistory.currentYearAverage)} / 20`
                : "Sin notas"}
            </Text>
            <Text style={styles.kpiSub}>
              {academicHistory.currentYearLabel ?? "Sin matrícula vigente"}
            </Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Áreas aprobadas</Text>
            <Text style={styles.kpiValue}>
              {academicHistory.totalApprovedSubjectsCount} /{" "}
              {academicHistory.totalTrackedSubjectsCount}
            </Text>
            <Text style={styles.kpiSub}>Trayectoria registrada</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Materias pendientes</Text>
            <Text style={styles.kpiValue}>
              {academicHistory.pendingRecoveryCount}
            </Text>
            <Text style={styles.kpiSub}>
              {academicHistory.pendingRecoveryCount === 0
                ? "Al día sin arrastres"
                : "En recuperación"}
            </Text>
          </View>
        </View>

        {/* Tablas por período escolar */}
        {academicHistory.periods.map((period) => (
          <View key={period.enrollmentId} style={styles.periodBlock} wrap={false}>
            <View style={styles.periodHeader}>
              <Text style={styles.periodTitle}>
                {period.schoolYearName} · {period.gradeYear}.º Año
                {period.sectionLetter ? ` Sección ${period.sectionLetter}` : ""}
                {period.mencionName ? ` · Mención ${period.mencionName}` : ""} (
                {period.enrollmentStatusLabel})
              </Text>
              <Text style={styles.periodMeta}>
                Promedio:{" "}
                {period.periodAverage !== null
                  ? `${formatPromedioDisplay(period.periodAverage)} pts`
                  : "—"}
                {` · ${period.passedCount}/${period.totalSubjects} aprob.`}
              </Text>
            </View>

            <View style={styles.tableHead}>
              <Text style={styles.colAreaHead}>Área de formación</Text>
              <Text style={styles.colMomentHead}>I Mom.</Text>
              <Text style={styles.colMomentHead}>II Mom.</Text>
              <Text style={styles.colMomentHead}>III Mom.</Text>
              <Text style={styles.colDefHead}>Definitiva</Text>
              <Text style={styles.colStatusHead}>Estado</Text>
            </View>

            {period.subjects.map((sub) => {
              const defLabel =
                sub.definitiveNumeric !== null
                  ? `${sub.definitiveNumeric} pts`
                  : sub.definitiveLiteral
                    ? `Lit. ${sub.definitiveLiteral}`
                    : "—";
              return (
                <View key={sub.curriculumSubjectId} style={styles.tableRow}>
                  <Text style={styles.colArea}>{sub.subjectName}</Text>
                  <Text style={styles.colMoment}>
                    {formatMomentCell(sub.moment1)}
                  </Text>
                  <Text style={styles.colMoment}>
                    {formatMomentCell(sub.moment2)}
                  </Text>
                  <Text style={styles.colMoment}>
                    {formatMomentCell(sub.moment3)}
                  </Text>
                  <Text style={styles.colDef}>{defLabel}</Text>
                  <Text style={styles.colStatus}>
                    {getHistorySubjectStatusLabel(sub.status)}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}

        {/* Materias pendientes (si aplica) */}
        {academicHistory.pendingAttempts.length > 0 ? (
          <View style={styles.pendingSection} wrap={false}>
            <Text style={styles.pendingTitle}>
              Historial de Materias Pendientes / Recuperación
            </Text>
            {academicHistory.pendingAttempts.map((att) => (
              <View key={att.id} style={styles.pendingRow}>
                <Text style={{ fontSize: 8, color: "#0f172a", width: "52%" }}>
                  {att.subjectName} ({att.subjectCode})
                </Text>
                <Text style={{ fontSize: 8, color: "#475569", width: "22%" }}>
                  Intento #{att.attemptNumber} · {att.examDate}
                </Text>
                <Text
                  style={{
                    fontSize: 8,
                    fontFamily: "Helvetica-Bold",
                    color: att.passed ? "#047857" : "#b45309",
                    width: "26%",
                    textAlign: "right",
                  }}
                >
                  {att.finalNumeric}/20 ·{" "}
                  {att.passed ? "Aprobada" : "En recuperación"}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.footerNote}>
          Documento informativo de consulta estudiantil generado en el navegador
          desde S.I.G.A. Para certificaciones de notas con firma oficial y
          código QR verificable, solicítelas en la sección Trámites ante Control
          de Estudios y Secretaría.
        </Text>
      </Page>
    </Document>
  );
}

/**
 * Genera y descarga el Récord Académico e Historial de Calificaciones en PDF
 * desde el navegador (`0 MB` en servidor).
 */
export async function downloadAcademicRecordPdf(
  data: StudentCurriculumOverviewData
): Promise<void> {
  const logoDataUrl = await loadLogoAsPngDataUrl();
  const generatedAt = new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    dateStyle: "medium",
  }).format(new Date());

  const blob = await pdf(
    <AcademicRecordDocumentLayout
      data={data}
      generatedAt={generatedAt}
      logoDataUrl={logoDataUrl}
    />
  ).toBlob();

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  const safeCedula = data.cedulaDisplay.replace(/[^A-Za-z0-9]/g, "");
  link.download = `SIGA-Record-Academico-${safeCedula || "Estudiante"}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}
