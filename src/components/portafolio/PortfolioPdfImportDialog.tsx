"use client";

import * as React from "react";
import { CheckCircle2, FileUp, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PORTFOLIO_TEMPLATES,
  type PortfolioPdfImportResponsePayload,
} from "@/lib/validators/portfolio";

export interface PortfolioPdfImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mencionName: string | null;
  gradeYear: number | null;
  onApplyImport: (
    result: PortfolioPdfImportResponsePayload,
    applyTemplate: boolean
  ) => void;
  onQuotaChange: (remaining: number) => void;
}

const MAX_PDF_BYTES = 5 * 1024 * 1024;

async function extractSelectableTextFromPdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const header = new Uint8Array(buffer.slice(0, 5));
  const magic = String.fromCharCode(...header);
  if (magic !== "%PDF-") {
    throw new Error("El archivo seleccionado no es un documento PDF válido.");
  }

  // Carga diferida en cliente: 0 KB en el bundle inicial de la página
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }

  const loadingTask = pdfjs.getDocument({ data: buffer });
  const pdfDoc = await loadingTask.promise;
  const maxPages = Math.min(pdfDoc.numPages, 5);
  const pageTexts: string[] = [];

  for (let p = 1; p <= maxPages; p += 1) {
    const page = await pdfDoc.getPage(p);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean);
    pageTexts.push(strings.join(" "));
  }

  return pageTexts.join("\n\n").replace(/\s+/g, " ").trim();
}

export function PortfolioPdfImportDialog({
  open,
  onOpenChange,
  mencionName,
  gradeYear,
  onApplyImport,
  onQuotaChange,
}: PortfolioPdfImportDialogProps) {
  const [status, setStatus] = React.useState<
    "idle" | "extracting" | "structuring" | "ready" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [importResult, setImportResult] =
    React.useState<PortfolioPdfImportResponsePayload | null>(null);
  const [applySuggestedTemplate, setApplySuggestedTemplate] =
    React.useState(true);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const reset = () => {
    setStatus("idle");
    setErrorMsg(null);
    setFileName(null);
    setImportResult(null);
  };

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    setImportResult(null);

    if (file.size > MAX_PDF_BYTES) {
      setErrorMsg("El PDF supera el límite máximo de 5 MB.");
      setStatus("error");
      return;
    }

    setFileName(file.name);
    setStatus("extracting");

    let text: string;
    try {
      text = await extractSelectableTextFromPdf(file);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "No se pudo leer el contenido de este PDF."
      );
      setStatus("error");
      return;
    }

    if (text.length < 40) {
      setErrorMsg(
        "Este PDF parece ser una imagen escaneada sin texto seleccionable. Sube un PDF exportado desde Word, Google Docs o Canva, o empieza con una de nuestras 10 plantillas."
      );
      setStatus("error");
      return;
    }

    setStatus("structuring");
    try {
      const response = await fetch("/api/estudiante/portafolio/ai-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "import_pdf",
          extractedText: text.slice(0, 14000),
          mencionName: mencionName ?? "",
          gradeYear,
        }),
      });

      const payload = (await response.json()) as
        | PortfolioPdfImportResponsePayload
        | { ok: false; message?: string };

      if (!response.ok || !payload.ok) {
        setErrorMsg(
          (!payload.ok && payload.message) ||
            "No fue posible estructurar el currículum en este momento."
        );
        setStatus("error");
        return;
      }

      if (typeof payload.remainingQuota === "number") {
        onQuotaChange(payload.remainingQuota);
      }

      setImportResult(payload);
      setStatus("ready");
    } catch {
      setErrorMsg("Error de conexión al analizar tu PDF.");
      setStatus("error");
    }
  };

  const suggestedPreset = importResult
    ? PORTFOLIO_TEMPLATES.find((t) => t.id === importResult.suggestedTemplateId)
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="size-5 text-primary" aria-hidden="true" />
            Importar Currículum en PDF
          </DialogTitle>
          <DialogDescription>
            Sube un CV en PDF que ya tengas (Word, Google Docs o Canva). Extraemos
            el texto en tu navegador sin guardar el archivo en el servidor y
            convertimos cada sección a campos editables.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />

          {status === "idle" || status === "error" ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/80 bg-muted/20 px-6 py-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Upload className="size-5" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                Haz clic para seleccionar tu PDF
              </p>
              <p className="text-xs text-muted-foreground">
                PDF digital con texto seleccionable · Máximo 5 MB (hasta 5 páginas)
              </p>
            </button>
          ) : null}

          {status === "extracting" || status === "structuring" ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 px-6 py-8 text-center">
              <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {status === "extracting"
                    ? "Leyendo texto del PDF en tu navegador..."
                    : "Organizando tus secciones y habilidades con IA..."}
                </p>
                {fileName ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{fileName}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {errorMsg ? (
            <Alert variant="destructive">
              <AlertTitle>No se pudo importar este archivo</AlertTitle>
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          ) : null}

          {status === "ready" && importResult ? (
            <div className="space-y-3 rounded-2xl border border-emerald-500/35 bg-emerald-500/8 p-4">
              <div className="flex items-start gap-2.5">
                <CheckCircle2
                  className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Contenido listo para editar
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {importResult.summary}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {importResult.extracted.headline ? (
                  <Badge variant="secondary">Titular</Badge>
                ) : null}
                {importResult.extracted.aboutSummary ? (
                  <Badge variant="secondary">Perfil profesional</Badge>
                ) : null}
                {importResult.extracted.skills?.length ? (
                  <Badge variant="secondary">
                    {importResult.extracted.skills.length} habilidades
                  </Badge>
                ) : null}
                {importResult.extracted.projects?.length ? (
                  <Badge variant="secondary">
                    {importResult.extracted.projects.length} proyectos
                  </Badge>
                ) : null}
                {importResult.extracted.experience?.length ? (
                  <Badge variant="secondary">
                    {importResult.extracted.experience.length} experiencias
                  </Badge>
                ) : null}
                {importResult.extracted.certifications?.length ? (
                  <Badge variant="secondary">
                    {importResult.extracted.certifications.length} cursos
                  </Badge>
                ) : null}
                {importResult.extracted.customSections?.length ? (
                  <Badge variant="secondary">
                    {importResult.extracted.customSections.length} secciones extra
                  </Badge>
                ) : null}
              </div>

              {suggestedPreset ? (
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/70 bg-background/80 p-2.5 text-xs">
                  <input
                    type="checkbox"
                    checked={applySuggestedTemplate}
                    onChange={(e) => setApplySuggestedTemplate(e.target.checked)}
                    className="size-4 accent-primary"
                  />
                  <span>
                    <Sparkles
                      className="mr-1 inline size-3.5 text-primary"
                      aria-hidden="true"
                    />
                    Aplicar plantilla sugerida:{" "}
                    <strong>{suggestedPreset.name}</strong>
                  </span>
                </label>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          {status === "ready" && importResult ? (
            <Button
              type="button"
              onClick={() => {
                onApplyImport(importResult, applySuggestedTemplate);
                toast.success(
                  "Datos del PDF importados a tu editor. Revisa y guarda los cambios."
                );
                onOpenChange(false);
              }}
            >
              Cargar en mi editor
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
