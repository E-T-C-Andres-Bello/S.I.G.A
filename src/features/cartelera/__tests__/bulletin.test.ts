import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANNOUNCEMENT_CATEGORY_META,
  MENTION_DEFAULT_PALETTES,
  formatAnnouncementAudience,
  formatAnnouncementCountdown,
  hexToRgba,
  resolveAnnouncementPalette,
  stripRichFormatting,
  upsertAnnouncementSchema,
  type SchoolAnnouncementItem,
} from "../../../lib/validators/bulletin";
import {
  normalizeSearchText,
  searchBulletinAnnouncements,
} from "../search-adapter";

function makeAnnouncement(
  overrides: Partial<SchoolAnnouncementItem> = {}
): SchoolAnnouncementItem {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Feria Socioproductiva de Telemática",
    shortNote: "28 Nov · Feria TI",
    body: "Presentación de proyectos técnicos en el Patio Central desde las 8:00 AM.",
    category: "mencion",
    targetMencionId: null,
    targetMencionCode: "telematica",
    targetMencionName: "Telemática",
    targetGradeYear: 5,
    eventDate: "2026-11-28T12:00:00.000Z",
    locationLabel: "Patio Central",
    coverWebpUrl: null,
    themePalette: MENTION_DEFAULT_PALETTES.telematica,
    isPinned: true,
    isPublished: true,
    publishedAt: "2026-11-24T12:00:00.000Z",
    expiresAt: null,
    createdBy: "22222222-2222-4222-8222-222222222222",
    authorName: "Dirección",
    authorDepartment: "Dirección",
    canEdit: true,
    readCount: 14,
    hasRead: false,
    readAt: null,
    updatedAt: "2026-11-24T12:00:00.000Z",
    ...overrides,
  };
}

describe("Módulo 1.8 — Validadores y paleta de La Cartelera Bellista", () => {
  it("valida un comunicado correcto con paleta hexadecimal", () => {
    const res = upsertAnnouncementSchema.safeParse({
      title: "Semana Aniversario E.T.C. Andrés Bello",
      shortNote: "19 Ene · Aniversario",
      body: "Actividades culturales, lunes cívico especial y muestras de las tres menciones.",
      category: "evento",
      targetMencionId: null,
      targetGradeYear: null,
      eventDate: "2027-01-19T08:00:00-04:00",
      locationLabel: "Patio Central · Unare II",
      coverWebpUrl: "https://storage.example.com/covers/aniversario.webp",
      themePalette: {
        primary: "#1c47c4",
        secondary: "#2e8b3d",
        accent: "#c9a24b",
        glow: "#38bdf8",
      },
      isPinned: true,
      isPublished: true,
      expiresAt: null,
    });
    assert.equal(res.success, true);
  });

  it("rechaza URLs inseguras (http) en portada", () => {
    const res = upsertAnnouncementSchema.safeParse({
      title: "Aviso de contingencia",
      shortNote: "Urgente hoy",
      body: "Cambio temporal de horario de salida por mantenimiento eléctrico.",
      category: "urgente",
      coverWebpUrl: "http://insecure.example.com/foto.webp",
      isPinned: true,
      isPublished: true,
    });
    assert.equal(res.success, false);
  });

  it("resuelve paleta por mención cuando no hay paleta guardada", () => {
    const palette = resolveAnnouncementPalette(null, "mencion", "turismo");
    assert.deepEqual(palette, MENTION_DEFAULT_PALETTES.turismo);

    const catPalette = resolveAnnouncementPalette("invalida", "urgente", null);
    assert.deepEqual(catPalette, ANNOUNCEMENT_CATEGORY_META.urgente.defaultPalette);
  });

  it("convierte hex a rgba de forma segura", () => {
    assert.equal(hexToRgba("#1c47c4", 0.5), "rgba(28, 71, 196, 0.500)");
  });

  it("calcula cuenta regresiva correctamente en zona America/Caracas", () => {
    const now = Date.parse("2026-11-24T15:00:00-04:00");
    assert.equal(
      formatAnnouncementCountdown("2026-11-24T18:00:00-04:00", now)?.label,
      "Hoy"
    );
    assert.equal(
      formatAnnouncementCountdown("2026-11-25T08:00:00-04:00", now)?.label,
      "Mañana"
    );
    assert.equal(
      formatAnnouncementCountdown("2026-11-27T08:00:00-04:00", now)?.label,
      "En 3 días"
    );
    assert.equal(
      formatAnnouncementCountdown("2026-11-20T08:00:00-04:00", now)?.label,
      "Realizado"
    );
  });

  it("formatea audiencia escolar de forma humana", () => {
    assert.equal(
      formatAnnouncementAudience(null, null),
      "Toda la comunidad bellista"
    );
    assert.equal(formatAnnouncementAudience("Aduana", 6), "Aduana · 6.º año");
  });

  it("limpia formato enriquecido para extractos de tarjetas", () => {
    const cleaned = stripRichFormatting(
      "## Aviso\n**Importante**: traer __cédula__ y ver [guía](https://siga.etcandresbello.org)."
    );
    assert.equal(cleaned, "Aviso Importante: traer cédula y ver guía.");
  });

  it("rechaza títulos mayores a 80 caracteres o etiquetas mayores a 32", () => {
    const longTitle = upsertAnnouncementSchema.safeParse({
      title: "A".repeat(81),
      shortNote: "Nota corta",
      body: "Contenido suficientemente largo para pasar validación.",
      category: "evento",
    });
    assert.equal(longTitle.success, false);

    const longNote = upsertAnnouncementSchema.safeParse({
      title: "Título adecuado",
      shortNote: "B".repeat(33),
      body: "Contenido suficientemente largo para pasar validación.",
      category: "evento",
    });
    assert.equal(longNote.success, false);
  });
});

describe("Módulo 1.8 — Motor de búsqueda local (Algolia-ready)", () => {
  it("normaliza tildes y filtra por texto, categoría y sin confirmar", () => {
    assert.equal(normalizeSearchText("Telemática y Áreas"), "telematica y areas");

    const items = [
      makeAnnouncement(),
      makeAnnouncement({
        id: "33333333-3333-4333-8333-333333333333",
        title: "Entrega de boletines I Momento",
        shortNote: "Cierre I lapso",
        body: "Retiro de boletines en coordinación académica durante la mañana.",
        category: "academico",
        targetMencionCode: null,
        targetMencionName: null,
        locationLabel: "Control de Estudios",
        hasRead: true,
      }),
    ];

    const byAccentless = searchBulletinAnnouncements(items, {
      text: "telematica patio",
      category: "all",
      onlyUnread: false,
    });
    assert.equal(byAccentless.length, 1);
    assert.equal(byAccentless[0]?.id, items[0]?.id);

    const onlyUnread = searchBulletinAnnouncements(items, {
      text: "",
      category: "all",
      onlyUnread: true,
    });
    assert.equal(onlyUnread.length, 1);
    assert.equal(onlyUnread[0]?.hasRead, false);
  });
});
