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
import type { StudentScheduleBlock } from "@/features/estudiante/dashboard-data";
import {
  SCHEDULE_WEEKDAYS,
  buildScheduleMatrix,
  formatCompactTeacherLabel,
  formatScheduleBannerTitle,
} from "@/features/estudiante/schedule-grid";

export interface StudentSchedulePdfContext {
  studentName: string;
  cedulaDisplay: string;
  sectionLabel: string;
  schoolYearName: string | null;
  gradeYear?: number | null;
  mencionName?: string | null;
  sectionLetter?: string | null;
}

const TIME_COL_WIDTH = "11.5%";
const NAVY = "#0b1d59";
const COBALT = "#1c47c4";
const BORDER_DARK = "#334155";
const BORDER_GRID = "#94a3b8";

const styles = StyleSheet.create({
  page: {
    paddingTop: 22,
    paddingBottom: 20,
    paddingHorizontal: 26,
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 10,
  },
  brandLeft: {
    flexDirection: "row",
    alignItems: "center",
    width: "30%",
    gap: 7,
  },
  logo: {
    width: 34,
    height: 34,
  },
  schoolName: {
    fontSize: 9.2,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  schoolMeta: {
    fontSize: 6.8,
    color: "#475569",
    marginTop: 1.5,
  },
  bannerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerTitle: {
    fontSize: 21,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    letterSpacing: 0.7,
    textAlign: "center",
  },
  bannerSubtitle: {
    fontSize: 7.2,
    color: COBALT,
    fontFamily: "Helvetica-Bold",
    marginTop: 2,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  metaRight: {
    width: "30%",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  metaSchoolYear: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  metaRoomBadge: {
    marginTop: 3,
    backgroundColor: "#e8eefb",
    color: COBALT,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 7.4,
    fontFamily: "Helvetica-Bold",
  },
  tableOuter: {
    borderWidth: 1.25,
    borderColor: NAVY,
    backgroundColor: "#ffffff",
  },
  dayHeaderRow: {
    flexDirection: "row",
    height: 28,
    backgroundColor: NAVY,
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
  },
  cornerCell: {
    width: TIME_COL_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 0.8,
    borderRightColor: "#3358b8",
  },
  cornerText: {
    fontSize: 7.2,
    fontFamily: "Helvetica-Bold",
    color: "#cbd5e1",
    letterSpacing: 0.6,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 0.75,
    borderRightColor: "#3358b8",
  },
  dayHeaderCellLast: {
    borderRightWidth: 0,
  },
  dayHeaderText: {
    fontSize: 12.5,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    letterSpacing: 0.4,
  },
  recessRow: {
    flexDirection: "row",
    backgroundColor: "#eef3fc",
    borderBottomWidth: 0.85,
    borderBottomColor: COBALT,
  },
  recessTimeCell: {
    width: TIME_COL_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: NAVY,
    paddingHorizontal: 2,
  },
  recessLabel: {
    fontSize: 6.8,
    fontFamily: "Helvetica-Bold",
    color: COBALT,
    letterSpacing: 0.4,
  },
  recessTime: {
    fontSize: 6.4,
    color: "#334155",
    marginTop: 1,
  },
  recessSpanCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  recessSpanText: {
    fontSize: 6.8,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    letterSpacing: 3,
  },
  slotsBandRow: {
    flexDirection: "row",
  },
  timeColumn: {
    width: TIME_COL_WIDTH,
    backgroundColor: "#f8fafc",
    borderRightWidth: 1,
    borderRightColor: NAVY,
  },
  timeSlotCell: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderBottomWidth: 0.65,
    borderBottomColor: BORDER_GRID,
  },
  timeSlotBlockCode: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  timeSlotRange: {
    fontSize: 6.8,
    color: BORDER_DARK,
    marginTop: 1.5,
    textAlign: "center",
  },
  dayColumn: {
    flex: 1,
    borderRightWidth: 0.75,
    borderRightColor: BORDER_GRID,
  },
  dayColumnLast: {
    borderRightWidth: 0,
  },
  classCell: {
    borderBottomWidth: 0.65,
    borderBottomColor: BORDER_GRID,
    paddingHorizontal: 5,
    paddingVertical: 3.5,
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
  },
  emptyCell: {
    borderBottomWidth: 0.65,
    borderBottomColor: BORDER_GRID,
    backgroundColor: "#ffffff",
  },
  cellRoomRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  cellRoomText: {
    fontSize: 6.7,
    fontFamily: "Helvetica-Bold",
    color: COBALT,
    textAlign: "right",
  },
  cellSubjectBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  cellSubjectText: {
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    textAlign: "center",
    lineHeight: 1.18,
  },
  cellTeacherText: {
    fontSize: 6.6,
    color: "#334155",
    textAlign: "left",
  },
  footer: {
    marginTop: 7,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 7.4,
    color: "#475569",
  },
  footerBrand: {
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
});

function formatVenezuelanDateShort(date: Date): string {
  const parts = new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  return `${d}/${m}/${y}`;
}

function SchedulePdfDocument({
  scheduleBlocks,
  context,
  generatedDateShort,
  logoDataUrl,
}: {
  scheduleBlocks: StudentScheduleBlock[];
  context: StudentSchedulePdfContext;
  generatedDateShort: string;
  logoDataUrl: string | null;
}) {
  const matrix = buildScheduleMatrix(scheduleBlocks);
  const bannerTitle = formatScheduleBannerTitle({
    gradeYear: context.gradeYear,
    mencionName: context.mencionName,
    sectionLetter: context.sectionLetter,
    fallbackLabel: context.sectionLabel,
  });

  // Escala vertical determinista para garantizar 1 sola página Carta Horizontal
  const recessH = 22;
  const maxGridBodyHeight = 456;
  const availableForSlots = Math.max(
    180,
    maxGridBodyHeight - matrix.totalRecessRows * recessH
  );
  const rowH = Math.min(
    74,
    Math.max(30, Math.floor(availableForSlots / Math.max(1, matrix.totalSlotRows)))
  );

  return (
    <Document
      title={`Horario Escolar - ${bannerTitle}`}
      author='E.T.C. "Andrés Bello" — S.I.G.A.'
    >
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        {/* Encabezado institucional + Título grande centrado estilo horario oficial */}
        <View style={styles.header}>
          <View style={styles.brandLeft}>
            {logoDataUrl ? (
              <PdfImage src={logoDataUrl} style={styles.logo} />
            ) : null}
            <View>
              <Text style={styles.schoolName}>
                E.T.C. &ldquo;Andrés Bello&rdquo;
              </Text>
              <Text style={styles.schoolMeta}>Unare II, Puerto Ordaz</Text>
              <Text style={styles.schoolMeta}>Código DEA: OD01340701</Text>
            </View>
          </View>

          <View style={styles.bannerCenter}>
            <Text style={styles.bannerTitle}>{bannerTitle}</Text>
            <Text style={styles.bannerSubtitle}>
              Horario Escolar Oficial de Sección
            </Text>
          </View>

          <View style={styles.metaRight}>
            <Text style={styles.metaSchoolYear}>
              {context.schoolYearName
                ? `Año Escolar ${context.schoolYearName}`
                : "Período Escolar Vigente"}
            </Text>
            {matrix.primaryRoomLabel ? (
              <Text style={styles.metaRoomBadge}>
                {matrix.primaryRoomLabel.toUpperCase()}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Tabla matricial clásica (Lu · Ma · Mi · Ju · Vi) con bloques fusionados y recesos */}
        <View style={styles.tableOuter}>
          <View style={styles.dayHeaderRow}>
            <View style={styles.cornerCell}>
              <Text style={styles.cornerText}>BLOQUE</Text>
            </View>
            {SCHEDULE_WEEKDAYS.map((weekday, idx) => (
              <View
                key={weekday.day}
                style={[
                  styles.dayHeaderCell,
                  idx === SCHEDULE_WEEKDAYS.length - 1
                    ? styles.dayHeaderCellLast
                    : {},
                ]}
              >
                <Text style={styles.dayHeaderText}>{weekday.short}</Text>
              </View>
            ))}
          </View>

          {matrix.bands.map((band, bandIdx) => {
            const isLastBand = bandIdx === matrix.bands.length - 1;

            if (band.kind === "recess") {
              return (
                <View
                  key={band.key}
                  style={[
                    styles.recessRow,
                    { height: recessH },
                    isLastBand ? { borderBottomWidth: 0 } : {},
                  ]}
                  wrap={false}
                >
                  <View style={styles.recessTimeCell}>
                    <Text style={styles.recessLabel}>{band.label}</Text>
                    <Text style={styles.recessTime}>
                      {band.startLabel} - {band.endLabel}
                    </Text>
                  </View>
                  <View style={styles.recessSpanCell}>
                    <Text style={styles.recessSpanText}>RECESO</Text>
                  </View>
                </View>
              );
            }

            return (
              <View key={band.key} style={styles.slotsBandRow} wrap={false}>
                {/* Columna izquierda de bloques y rangos horarios */}
                <View style={styles.timeColumn}>
                  {band.rows.map((row, rowIdx) => {
                    const isVeryLastRow =
                      isLastBand && rowIdx === band.rows.length - 1;
                    return (
                      <View
                        key={`time-${row.index}`}
                        style={[
                          styles.timeSlotCell,
                          { height: rowH },
                          isVeryLastRow ? { borderBottomWidth: 0 } : {},
                        ]}
                      >
                        <Text style={styles.timeSlotBlockCode}>
                          {row.blockCode}
                        </Text>
                        <Text style={styles.timeSlotRange}>
                          {row.startLabel} - {row.endLabel}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* 5 columnas de días (Lu–Vi) con celdas fusionadas exactamente a rowSpan * rowH */}
                {SCHEDULE_WEEKDAYS.map((weekday, colIdx) => {
                  const cells = band.columnsByDay[weekday.day] ?? [];
                  return (
                    <View
                      key={`col-${band.key}-${weekday.day}`}
                      style={[
                        styles.dayColumn,
                        colIdx === SCHEDULE_WEEKDAYS.length - 1
                          ? styles.dayColumnLast
                          : {},
                      ]}
                    >
                      {cells.map((cell, cellIdx) => {
                        const cellHeight = rowH * cell.rowSpan;
                        const isVeryLastCell =
                          isLastBand && cellIdx === cells.length - 1;

                        if (!cell.block) {
                          return (
                            <View
                              key={cell.key}
                              style={[
                                styles.emptyCell,
                                { height: cellHeight },
                                isVeryLastCell ? { borderBottomWidth: 0 } : {},
                              ]}
                            />
                          );
                        }

                        const subjectFontSize =
                          cellHeight >= 64
                            ? 8.8
                            : cellHeight >= 46
                              ? 7.8
                              : 7.1;

                        return (
                          <View
                            key={cell.key}
                            style={[
                              styles.classCell,
                              { height: cellHeight },
                              isVeryLastCell ? { borderBottomWidth: 0 } : {},
                            ]}
                          >
                            <View style={styles.cellRoomRow}>
                              <Text style={styles.cellRoomText}>
                                {cell.block.roomLabel.toUpperCase()}
                              </Text>
                            </View>

                            <View style={styles.cellSubjectBox}>
                              <Text
                                style={[
                                  styles.cellSubjectText,
                                  { fontSize: subjectFontSize },
                                ]}
                              >
                                {cell.block.subjectName.toUpperCase()}
                              </Text>
                            </View>

                            <Text style={styles.cellTeacherText}>
                              {formatCompactTeacherLabel(cell.block.teacherName)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>

        {/* Pie institucional limpio */}
        <View style={styles.footer}>
          <Text>Horario generado: {generatedDateShort}</Text>
          <Text style={styles.footerBrand}>
            S.I.G.A. · E.T.C. &ldquo;Andrés Bello&rdquo;
          </Text>
        </View>
      </Page>
    </Document>
  );
}

function buildScheduleFilename(bannerTitle: string): string {
  const safe = bannerTitle
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `SIGA-Horario-${safe || "Seccion"}.pdf`;
}

/**
 * Genera el Horario Escolar institucional en PDF horizontal desde el navegador
 * (`0 MB` de carga en servidor) para imprimir o descargar.
 */
export async function exportStudentSchedulePdf(
  scheduleBlocks: StudentScheduleBlock[],
  context: StudentSchedulePdfContext,
  mode: "print" | "download" = "print"
): Promise<{ openedInTab: boolean }> {
  const logoDataUrl = await loadLogoAsPngDataUrl();
  const generatedDateShort = formatVenezuelanDateShort(new Date());
  const bannerTitle = formatScheduleBannerTitle({
    gradeYear: context.gradeYear,
    mencionName: context.mencionName,
    sectionLetter: context.sectionLetter,
    fallbackLabel: context.sectionLabel,
  });

  const blob = await pdf(
    <SchedulePdfDocument
      scheduleBlocks={scheduleBlocks}
      context={context}
      generatedDateShort={generatedDateShort}
      logoDataUrl={logoDataUrl}
    />
  ).toBlob();

  const objectUrl = URL.createObjectURL(blob);

  if (mode === "print") {
    const popup = window.open(objectUrl, "_blank", "noopener,noreferrer");
    if (popup) {
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      return { openedInTab: true };
    }
  }

  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = buildScheduleFilename(bannerTitle);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  return { openedInTab: false };
}
