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
import type { StudentOfficialDocumentItem } from "@/features/estudiante/tramites-data";
import { OFFICIAL_DOCUMENT_TYPE_LABELS } from "@/lib/validators/student-portal";

export interface PdfStudentContext {
  fullName: string;
  cedulaDisplay: string;
  institutionalEmail: string | null;
  mencionName: string | null;
  gradeYear: number | null;
  sectionLetter: string | null;
  schoolYearName: string | null;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingBottom: 48,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    fontSize: 10.5,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: "#1c47c4",
    paddingBottom: 12,
    marginBottom: 20,
    gap: 12,
  },
  logo: {
    width: 48,
    height: 48,
  },
  headerTextBlock: {
    flex: 1,
  },
  ministryText: {
    fontSize: 8.5,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  schoolName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#0b1d59",
    marginTop: 2,
  },
  schoolMeta: {
    fontSize: 8.5,
    color: "#475569",
    marginTop: 2,
  },
  docBadge: {
    backgroundColor: "#e8eefb",
    color: "#1c47c4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
  },
  title: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    color: "#090d16",
    marginTop: 6,
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bodyParagraph: {
    fontSize: 11,
    lineHeight: 1.65,
    textAlign: "justify",
    marginBottom: 14,
  },
  infoCard: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    padding: 12,
    backgroundColor: "#f8fafc",
    marginBottom: 18,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
  },
  infoRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 9.5,
    color: "#475569",
  },
  infoValue: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  footer: {
    marginTop: "auto",
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    paddingTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  qrImage: {
    width: 82,
    height: 82,
  },
  verifyTextBlock: {
    flex: 1,
  },
  verifyTitle: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: "#0b1d59",
    marginBottom: 3,
  },
  verifyDetail: {
    fontSize: 8.5,
    color: "#475569",
    lineHeight: 1.45,
  },
  verifyCode: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: "#1c47c4",
    marginTop: 4,
  },
});

export async function loadLogoAsPngDataUrl(): Promise<string | null> {
  try {
    const response = await fetch("/images/institucion/logotipo.webp");
    if (!response.ok) return null;
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function formatIssuedDate(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    dateStyle: "long",
  }).format(dt);
}

function OfficialDocumentLayout({
  doc,
  student,
  qrDataUrl,
  logoDataUrl,
  verifyUrl,
}: {
  doc: StudentOfficialDocumentItem;
  student: PdfStudentContext;
  qrDataUrl: string;
  logoDataUrl: string | null;
  verifyUrl: string;
}) {
  const docTitle =
    OFFICIAL_DOCUMENT_TYPE_LABELS[doc.documentType] ??
    "Documento Oficial S.I.G.A.";
  const snapshotEntries = Object.entries(doc.payloadSnapshot).filter(
    ([key, value]) =>
      !["cedula", "phone", "address"].includes(key) &&
      value !== null &&
      value !== undefined &&
      String(value).trim().length > 0
  );

  return (
    <Document title={`${docTitle} - ${doc.verificationCode}`}>
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
          <Text style={styles.docBadge}>
            {doc.status === "valid" ? "OFICIAL" : "REVOCADO"}
          </Text>
        </View>

        <Text style={styles.title}>{docTitle}</Text>

        <Text style={styles.bodyParagraph}>
          Quien suscribe, la Coordinación de Control de Estudios y Secretaría de
          la Escuela Técnica Comercial &ldquo;Andrés Bello&rdquo; (Código DEA
          OD01340701), hace constar por medio de la presente que el estudiante{" "}
          {student.fullName}, titular de la Cédula de Identidad{" "}
          {student.cedulaDisplay}, figura registrado en el Sistema Integral de
          Gestión Académica (S.I.G.A.) para el período escolar{" "}
          {student.schoolYearName ?? "vigente"}
          {student.gradeYear
            ? `, cursando el ${student.gradeYear}.º Año en la Mención ${student.mencionName ?? "Técnica"}, Sección ${student.sectionLetter ?? "—"}`
            : ""}
          .
        </Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Estudiante</Text>
            <Text style={styles.infoValue}>{student.fullName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cédula de Identidad</Text>
            <Text style={styles.infoValue}>{student.cedulaDisplay}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fecha de emisión</Text>
            <Text style={styles.infoValue}>{formatIssuedDate(doc.issuedAt)}</Text>
          </View>
          {snapshotEntries.map(([key, val], idx) => (
            <View
              key={key}
              style={
                idx === snapshotEntries.length - 1
                  ? styles.infoRowLast
                  : styles.infoRow
              }
            >
              <Text style={styles.infoLabel}>{key.replaceAll("_", " ")}</Text>
              <Text style={styles.infoValue}>{String(val)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.bodyParagraph}>
          Documento emitido electrónicamente por el sistema académico
          institucional S.I.G.A. Su integridad y vigencia pueden validarse en
          tiempo real mediante el código QR institucional adjunto.
        </Text>

        <View style={styles.footer}>
          <PdfImage src={qrDataUrl} style={styles.qrImage} />
          <View style={styles.verifyTextBlock}>
            <Text style={styles.verifyTitle}>
              Verificación Anti-Forjamiento S.I.G.A.
            </Text>
            <Text style={styles.verifyDetail}>
              Escanea este código QR o consulta la autenticidad del documento en:{" "}
              {verifyUrl}
            </Text>
            <Text style={styles.verifyCode}>
              Código: {doc.verificationCode}
            </Text>
            {doc.documentHash ? (
              <Text style={styles.verifyDetail}>
                Firma digital SHA-256: {doc.documentHash.slice(0, 24)}…
              </Text>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}

/**
 * Genera y descarga el PDF oficial directamente en el navegador (`0 MB` en servidor).
 */
export async function downloadOfficialDocumentPdf(
  doc: StudentOfficialDocumentItem,
  student: PdfStudentContext
): Promise<void> {
  const verifyUrl = `${window.location.origin}/verificar?code=${encodeURIComponent(doc.verificationCode)}`;
  const [qrDataUrl, logoDataUrl] = await Promise.all([
    QRCode.toDataURL(verifyUrl, {
      width: 240,
      margin: 1,
      color: { dark: "#090d16", light: "#ffffff" },
    }),
    loadLogoAsPngDataUrl(),
  ]);

  const blob = await pdf(
    <OfficialDocumentLayout
      doc={doc}
      student={student}
      qrDataUrl={qrDataUrl}
      logoDataUrl={logoDataUrl}
      verifyUrl={verifyUrl}
    />
  ).toBlob();

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `${doc.verificationCode}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}
