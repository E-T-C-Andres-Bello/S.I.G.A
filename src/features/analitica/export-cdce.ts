"use client";

import type { CdceMatrixRow, FilterSubjectItem } from "./schemas";

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function triggerCsvDownload(
  filename: string,
  rows: (string | number | null | undefined)[][]
): void {
  const csvContent =
    "\uFEFF" + rows.map((row) => row.map(escapeCsvCell).join(";")).join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportCdceMatrixCsv(
  rows: CdceMatrixRow[],
  schoolYearName: string
): void {
  const headers = [
    "Plantel",
    "Código DEA",
    "Año Escolar",
    "Mención",
    "Año",
    "Secciones",
    "Matrícula Activa",
    "Preinscritos",
    "Retirados",
    "Promovidos / Egresados",
    "Promedio General",
    "Asistencia (%)",
  ];

  const dataRows = rows.map((r) => [
    'E.T.C. "Andrés Bello"',
    "OD01340701",
    schoolYearName,
    r.mencionName,
    `${r.gradeYear}.º Año`,
    r.totalSections,
    r.activeStudents,
    r.preEnrolledStudents,
    r.withdrawnStudents,
    r.promotedStudents,
    r.avgGrade !== null ? r.avgGrade.toFixed(2) : "—",
    r.attendancePct !== null ? `${r.attendancePct.toFixed(1)}%` : "—",
  ]);

  const safeSlug = schoolYearName.replace(/[^a-zA-Z0-9_-]+/g, "_");
  triggerCsvDownload(`SIGA_Matriz_CDCE_${safeSlug}.csv`, [headers, ...dataRows]);
}

export function exportFilterSubjectsCsv(
  rows: FilterSubjectItem[],
  schoolYearName: string
): void {
  const headers = [
    "Año Escolar",
    "Código Asignatura",
    "Asignatura",
    "Mención",
    "Año",
    "Evaluados",
    "Reprobados",
    "Tasa Reprobación (%)",
    "Promedio Numérico",
    "En Materia Pendiente",
  ];

  const dataRows = rows.map((r) => [
    schoolYearName,
    r.subjectCode,
    r.subjectName,
    r.mencionName,
    `${r.gradeYear}.º Año`,
    r.totalGraded,
    r.failedCount,
    `${r.failureRatePct.toFixed(1)}%`,
    r.avgNumeric !== null ? r.avgNumeric.toFixed(2) : "—",
    r.pendingStudents,
  ]);

  const safeSlug = schoolYearName.replace(/[^a-zA-Z0-9_-]+/g, "_");
  triggerCsvDownload(`SIGA_Materias_Filtro_${safeSlug}.csv`, [
    headers,
    ...dataRows,
  ]);
}
