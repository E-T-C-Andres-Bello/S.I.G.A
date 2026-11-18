"use client";

import * as React from "react";
import { CheckCircle2, QrCode, Search, ShieldAlert, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  OFFICIAL_DOCUMENT_TYPE_LABELS,
  verificationCodeSchema,
} from "@/lib/validators/student-portal";

export interface PublicVerificationResult {
  valid: boolean;
  status: string;
  verification_code?: string;
  document_type?: string;
  issued_at?: string;
  revoked_at?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PublicDocumentVerifierProps {
  initialCode?: string;
}

function formatCaracasDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    dateStyle: "long",
    timeStyle: "short",
  }).format(parsed);
}

/**
 * Formulario público y visor de autenticidad para códigos QR de documentos S.I.G.A.
 */
export function PublicDocumentVerifier({
  initialCode = "",
}: PublicDocumentVerifierProps) {
  const [codeInput, setCodeInput] = React.useState(initialCode.toUpperCase());
  const [loading, setLoading] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<PublicVerificationResult | null>(null);
  const submitLockRef = React.useRef(false);

  const runLookup = React.useCallback(async (rawCode: string) => {
    const parsed = verificationCodeSchema.safeParse(rawCode);
    if (!parsed.success) {
      setValidationError(
        parsed.error.issues[0]?.message ?? "Formato de código inválido."
      );
      setResult(null);
      return;
    }

    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setValidationError(null);
    setServerError(null);
    setLoading(true);

    try {
      const response = await fetch(
        `/api/verificar?code=${encodeURIComponent(parsed.data)}`,
        { method: "GET", cache: "no-store" }
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        result?: PublicVerificationResult;
      };

      if (!response.ok || !payload.ok || !payload.result) {
        setServerError(
          payload.message ?? "No se pudo verificar el código en este momento."
        );
        setResult(null);
        return;
      }

      setResult(payload.result);
    } catch {
      setServerError("Error de conexión al consultar el registro público.");
      setResult(null);
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }, []);

  React.useEffect(() => {
    if (initialCode.trim().length > 0) {
      void runLookup(initialCode);
    }
  }, [initialCode, runLookup]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runLookup(codeInput);
  };

  const docTypeLabel = result?.document_type
    ? (OFFICIAL_DOCUMENT_TYPE_LABELS[result.document_type] ?? result.document_type)
    : null;

  const metadataEntries = Object.entries(result?.metadata ?? {}).filter(
    ([, val]) => val !== null && val !== undefined && String(val).trim().length > 0
  );

  return (
    <Card className="w-full max-w-lg rounded-2xl border-border/80 shadow-lg">
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex size-10 items-center justify-center rounded-xl border border-border bg-secondary text-primary">
            <QrCode className="size-5" aria-hidden="true" />
          </div>
          <Badge variant="outline">Código DEA OD01340701</Badge>
        </div>
        <CardTitle className="font-sans text-xl tracking-[-0.02em]">
          Verificación Oficial de Documentos
        </CardTitle>
        <CardDescription>
          Valida la autenticidad de constancias, boletines y certificaciones
          emitidas por la E.T.C. &ldquo;Andrés Bello&rdquo; ingresando el código
          impreso o escaneando su QR.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
          <Field data-invalid={Boolean(validationError) || undefined}>
            <FieldLabel htmlFor="verification-code-input">
              Código de verificación S.I.G.A.
            </FieldLabel>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="verification-code-input"
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value.toUpperCase());
                  if (validationError) setValidationError(null);
                }}
                placeholder="Ej. SIGA-2026-A1B2C3"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(validationError) || undefined}
                className="font-mono tracking-wider uppercase"
              />
              <Button type="submit" disabled={loading} className="shrink-0">
                {loading ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Verificando
                  </>
                ) : (
                  <>
                    <Search data-icon="inline-start" />
                    Validar
                  </>
                )}
              </Button>
            </div>
            <FieldDescription>
              Por protección de datos estudiantiles, esta consulta muestra
              únicamente el estatus de validez y metadatos institucionales no
              sensibles.
            </FieldDescription>
            {validationError ? <FieldError>{validationError}</FieldError> : null}
          </Field>
        </form>

        {serverError ? (
          <Alert variant="destructive">
            <ShieldAlert aria-hidden="true" />
            <AlertTitle>Consulta interrumpida</AlertTitle>
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}

        {result ? (
          result.valid ? (
            <Alert className="border-emerald-500/35 bg-emerald-500/8 text-foreground">
              <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <AlertTitle className="flex flex-wrap items-center justify-between gap-2">
                <span>Documento Auténtico y Vigente</span>
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                  Válido
                </Badge>
              </AlertTitle>
              <AlertDescription className="mt-2 flex w-full flex-col gap-2 text-xs text-foreground/90">
                <div className="grid grid-cols-1 gap-2 rounded-xl border border-border/60 bg-background/70 p-3 sm:grid-cols-2">
                  <div>
                    <span className="block text-[11px] text-muted-foreground">
                      Código verificado
                    </span>
                    <span className="font-mono font-semibold">
                      {result.verification_code}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-muted-foreground">
                      Tipo de documento
                    </span>
                    <span className="font-medium">{docTypeLabel ?? "Documento"}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="block text-[11px] text-muted-foreground">
                      Fecha de emisión oficial
                    </span>
                    <span className="font-medium">
                      {formatCaracasDateTime(result.issued_at)}
                    </span>
                  </div>
                  {metadataEntries.map(([key, value]) => (
                    <div key={key}>
                      <span className="block text-[11px] text-muted-foreground capitalize">
                        {key.replaceAll("_", " ")}
                      </span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <XCircle aria-hidden="true" />
              <AlertTitle className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {result.status === "revoked"
                    ? "Documento Revocado por la Institución"
                    : "Documento No Encontrado"}
                </span>
                <Badge variant="destructive">
                  {result.status === "revoked" ? "Revocado" : "No válido"}
                </Badge>
              </AlertTitle>
              <AlertDescription className="mt-1">
                {result.status === "revoked"
                  ? `Este documento (${result.verification_code ?? ""}) fue anulado por Control de Estudios el ${formatCaracasDateTime(result.revoked_at ?? undefined)}.`
                  : "El código ingresado no corresponde a ningún documento oficial emitido en S.I.G.A."}
              </AlertDescription>
            </Alert>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
