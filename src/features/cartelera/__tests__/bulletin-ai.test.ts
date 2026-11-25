import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bulletinAiChatRequestSchema,
  sanitizeAiMarkdownText,
  sanitizeBulletinAiSuggestion,
  scrubPotentialPiiForLlm,
} from "../../../lib/validators/bulletin-ai";

describe("Seguridad OWASP LLM 2025 — Asistente IA de La Cartelera Bellista", () => {
  it("redacta cédulas, correos y teléfonos antes de salir hacia n8n (LLM02)", () => {
    const raw =
      "Contactar a V-12345678 o al correo profe.prueba@gmail.com o al 0414-5551234 en el Patio Central.";
    const scrubbed = scrubPotentialPiiForLlm(raw);

    assert.equal(scrubbed.includes("12345678"), false);
    assert.equal(scrubbed.includes("profe.prueba@gmail.com"), false);
    assert.equal(scrubbed.includes("0414-5551234"), false);
    assert.equal(scrubbed.includes("Patio Central"), true);
  });

  it("elimina HTML/scripts y bloquea enlaces javascript: en salidas del LLM (LLM05)", () => {
    const hostile =
      "## Aviso <script>alert(1)</script><img src=x onerror=alert(2)> [clic](javascript:alert(3)) y [portal](https://siga.etcandresbello.org)";
    const sanitized = sanitizeAiMarkdownText(hostile, 500);

    assert.equal(sanitized.includes("<script>"), false);
    assert.equal(sanitized.includes("<img"), false);
    assert.equal(sanitized.includes("javascript:"), false);
    assert.equal(
      sanitized.includes("[portal](https://siga.etcandresbello.org)"),
      true
    );
  });

  it("recorta automáticamente títulos > 80 y etiquetas > 32 y descarta categorías inválidas", () => {
    const suggestion = sanitizeBulletinAiSuggestion({
      title: "<b>" + "X".repeat(120) + "</b>",
      shortNote: "Nota " + "Y".repeat(60),
      category: "categoria_falsa",
      body: "## Encabezado\nContenido oficial listo para revisar por Dirección.",
    });

    assert.ok(suggestion);
    assert.equal(suggestion.title?.length, 80);
    assert.equal(suggestion.shortNote?.length, 32);
    assert.equal(suggestion.category, undefined);
    assert.ok(suggestion.body?.includes("## Encabezado"));
  });

  it("limita historial a 6 turnos y longitud de mensaje a 1200 caracteres (LLM10)", () => {
    const tooManyTurns = bulletinAiChatRequestSchema.safeParse({
      message: "Ayúdame a redactar un aviso.",
      mode: "draft",
      history: Array.from({ length: 7 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Turno ${i}`,
      })),
    });
    assert.equal(tooManyTurns.success, false);

    const tooLong = bulletinAiChatRequestSchema.safeParse({
      message: "A".repeat(1201),
      mode: "chat",
    });
    assert.equal(tooLong.success, false);
  });
});
