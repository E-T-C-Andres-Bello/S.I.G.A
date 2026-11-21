"use client";

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import type {
  AnalyticsBiOverview,
  CdceMatrixRow,
} from "@/features/analitica/schemas";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 36,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  header: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#1c47c4",
    paddingBottom: 10,
    marginBottom: 14,
  },
  ministry: {
    fontSize: 8,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  school: {
    fontSize: 12.5,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginTop: 2,
  },
  subtitle: {
    fontSize: 9,
    color: "#334155",
    marginTop: 2,
  },
  title: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1c47c4",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    backgroundColor: "#f8fafc",
    padding: 8,
    borderRadius: 4,
  },
  metaText: {
    fontSize: 8.5,
    color: "#334155",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1c47c4",
    color: "#ffffff",
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#cbd5e1",
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontSize: 8.5,
  },
  tableRowAlt: {
    backgroundColor: "#f8fafc",
  },
  colMencion: { width: "22%" },
  colYear: { width: "10%", textAlign: "center" },
  colNum: { width: "11.3%", textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderTopColor: "#cbd5e1",
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: "#64748b",
  },
});

function CdcePdfDocument({
  overview,
  rows,
}: {
  overview: AnalyticsBiOverview;
  rows: CdceMatrixRow[];
}) {
  const yearLabel = overview.activeSchoolYear?.name ?? "Período vigente";
  const momentoLabel = overview.activeMomento?.name ?? "Consolidado general";
  const issuedAt = new Date(overview.generatedAt).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.ministry}>
            Ministerio del Poder Popular para la Educación · CDCE / Zona Educativa Bolívar
          </Text>
          <Text style={styles.school}>
            Escuela Técnica Comercial &quot;Andrés Bello&quot; · Código DEA OD01340701
          </Text>
          <Text style={styles.subtitle}>
            Unare II, Puerto Ordaz, Estado Bolívar — Reporte Estadístico Oficial
          </Text>
        </View>

        <Text style={styles.title}>
          Matriz Estadística de Matrícula, Prosecución y Rendimiento
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Año Escolar: {yearLabel}</Text>
          <Text style={styles.metaText}>Corte: {momentoLabel}</Text>
          <Text style={styles.metaText}>
            Matrícula Activa: {overview.summary.activeStudents}
          </Text>
          <Text style={styles.metaText}>Fecha de emisión: {issuedAt}</Text>
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.colMencion}>Mención Técnica</Text>
          <Text style={styles.colYear}>Año</Text>
          <Text style={styles.colNum}>Secciones</Text>
          <Text style={styles.colNum}>Activos</Text>
          <Text style={styles.colNum}>Preinscritos</Text>
          <Text style={styles.colNum}>Retirados</Text>
          <Text style={styles.colNum}>Promovidos</Text>
          <Text style={styles.colNum}>Promedio / Asist.</Text>
        </View>

        {rows.length === 0 ? (
          <View style={styles.tableRow}>
            <Text>No existen registros académicos consolidados para este período.</Text>
          </View>
        ) : (
          rows.map((row, idx) => (
            <View
              key={`${row.mencionId}-${row.gradeYear}`}
              style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={styles.colMencion}>{row.mencionName}</Text>
              <Text style={styles.colYear}>{row.gradeYear}.º</Text>
              <Text style={styles.colNum}>{row.totalSections}</Text>
              <Text style={styles.colNum}>{row.activeStudents}</Text>
              <Text style={styles.colNum}>{row.preEnrolledStudents}</Text>
              <Text style={styles.colNum}>{row.withdrawnStudents}</Text>
              <Text style={styles.colNum}>{row.promotedStudents}</Text>
              <Text style={styles.colNum}>
                {row.avgGrade !== null ? row.avgGrade.toFixed(1) : "—"} /{" "}
                {row.attendancePct !== null ? `${row.attendancePct.toFixed(0)}%` : "—"}
              </Text>
            </View>
          ))
        )}

        <View style={styles.footer}>
          <Text>
            S.I.G.A. — Sistema Integral de Gestión Académica · E.T.C. &quot;Andrés Bello&quot;
          </Text>
          <Text>Documento generado para consignación institucional ante CDCE</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function downloadCdceReportPdf(
  overview: AnalyticsBiOverview,
  rows: CdceMatrixRow[]
): Promise<void> {
  const blob = await pdf(
    <CdcePdfDocument overview={overview} rows={rows} />
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = (overview.activeSchoolYear?.name ?? "periodo").replace(
    /[^a-zA-Z0-9_-]+/g,
    "_"
  );
  link.href = url;
  link.download = `SIGA_Reporte_CDCE_${safeName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

