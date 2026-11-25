import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SECTION_ORDER,
  PORTFOLIO_TEMPLATES,
  resolvePortfolioDesign,
  sanitizePortfolioPlainText,
  scrubPortfolioTextForLlm,
  studentPortfolioDraftSchema,
  type StudentPortfolioDraft,
} from "@/lib/validators/portfolio";
import { evaluateStudentPortfolio } from "@/features/portafolio/cv-scoring";

function makeBaseDraft(overrides: Partial<StudentPortfolioDraft> = {}): StudentPortfolioDraft {
  return {
    templateId: "tecnico-moderno",
    designConfig: resolvePortfolioDesign("tecnico-moderno"),
    headline: "",
    aboutSummary: "",
    contactMeta: {
      city: "Puerto Ordaz, Estado Bolívar",
      availability: "",
      links: [],
    },
    skills: [],
    languages: [],
    projects: [],
    experience: [],
    certifications: [],
    customSections: [],
    isPublic: false,
    publicSlug: "",
    privacySettings: {
      show_photo: true,
      show_email: false,
      show_phone: false,
      show_average: false,
      show_medals: true,
    },
    ...overrides,
  };
}

describe("Módulo 1.14 — Validadores, 10 plantillas y seguridad OWASP LLM", () => {
  it("incluye exactamente 10 plantillas predefinidas con diseños distintos y orden válido", () => {
    assert.equal(PORTFOLIO_TEMPLATES.length, 10);
    const ids = new Set(PORTFOLIO_TEMPLATES.map((t) => t.id));
    assert.equal(ids.size, 10);
    for (const preset of PORTFOLIO_TEMPLATES) {
      assert.equal(preset.design.sectionOrder.length, DEFAULT_SECTION_ORDER.length);
      assert.match(preset.design.accentColor, /^#[0-9a-f]{6}$/i);
    }
  });

  it("redacta cédulas, correos y teléfonos venezolanos antes de salir al Coach IA (LLM02)", () => {
    const raw =
      "Soy V-31456789, mi correo es estudiante@gmail.com y mi número es +58 414-555-8899.";
    const scrubbed = scrubPortfolioTextForLlm(raw);
    assert.ok(!scrubbed.includes("31456789"));
    assert.ok(!scrubbed.includes("estudiante@gmail.com"));
    assert.ok(!scrubbed.includes("555-8899"));
    assert.ok(scrubbed.includes("[CEDULA_PROTEGIDA]"));
    assert.ok(scrubbed.includes("[CORREO_PROTEGIDO]"));
    assert.ok(scrubbed.includes("[TELEFONO_PROTEGIDO]"));
  });

  it("elimina HTML y scripts en salidas del modelo (LLM05)", () => {
    const dirty = `<script>alert(1)</script><b>Técnico en Telemática</b> con experiencia en redes.`;
    const clean = sanitizePortfolioPlainText(dirty, 200);
    assert.equal(clean, "Técnico en Telemática con experiencia en redes.");
  });

  it("rechaza enlaces no HTTPS y slugs inválidos en el esquema del portafolio", () => {
    const bad = makeBaseDraft({
      publicSlug: "INVALID SLUG!!",
      contactMeta: {
        city: "Puerto Ordaz",
        availability: "",
        links: [{ id: "l1", label: "Web", url: "javascript:alert(1)" }],
      },
    });
    const parsed = studentPortfolioDraftSchema.safeParse(bad);
    assert.equal(parsed.success, false);
  });
});

describe("Módulo 1.14 — Termómetro de nivel y señales editoriales selectivas", () => {
  it("detecta clichés genéricos y dispara señales sobrias de alto impacto en borrador inicial", () => {
    const weakDraft = makeBaseDraft({
      headline: "Estudiante",
      aboutSummary: "Soy una persona responsable, puntual y honesta con ganas de trabajar.",
    });
    const evaluation = evaluateStudentPortfolio(weakDraft, {
      mencionCode: "TELEMATICA",
      mencionName: "Telemática",
      gradeYear: 6,
    });
    assert.ok(evaluation.totalScore < 35);
    assert.equal(evaluation.levelCode, "borrador");
    assert.ok(evaluation.signals.some((s) => s.sectionKey === "headline"));
    assert.ok(evaluation.signals.some((s) => s.sectionKey === "about"));
    assert.ok(evaluation.signals.length <= 3);
  });

  it("alcanza Nivel Excelencia y silencia señales cuando el CV es sólido y completo", () => {
    const strongDraft = makeBaseDraft({
      headline: "Técnico Medio en Telemática · Redes LAN, Linux y Soporte TI",
      aboutSummary:
        "Estudiante de 6.º año en la mención Telemática de la E.T.C. Andrés Bello con formación práctica en cableado estructurado T568A/B, mantenimiento de laboratorios y bases de datos SQL. Busco integrarme a un equipo de soporte TI en Ciudad Guayana para aportar orden técnico y diagnóstico rápido.",
      contactMeta: {
        city: "Puerto Ordaz, Estado Bolívar",
        availability: "Disponible para pasantías 6.º año",
        links: [{ id: "gh", label: "GitHub", url: "https://github.com/demo-bellista" }],
      },
      skills: [
        { id: "s1", name: "Redes LAN / TCP-IP", category: "tecnica", level: "avanzado" },
        { id: "s2", name: "Cableado estructurado T568A/B", category: "tecnica", level: "intermedio" },
        { id: "s3", name: "Bases de datos SQL", category: "herramienta", level: "intermedio" },
        { id: "s4", name: "Administración Linux y Windows", category: "tecnica", level: "intermedio" },
        { id: "s5", name: "Mantenimiento preventivo de equipos", category: "tecnica", level: "avanzado" },
        { id: "s6", name: "Trabajo en equipo", category: "blanda", level: "avanzado" },
      ],
      languages: [
        { id: "lg1", name: "Español", level: "Nativo" },
        { id: "lg2", name: "Inglés Técnico", level: "B1" },
      ],
      projects: [
        {
          id: "p1",
          title: "Inventario y diagnóstico de red del Laboratorio de Informática",
          role: "Coordinador técnico del equipo PEST",
          period: "2025 - 2026",
          summary:
            "Implementé el mapeo de puntos de red, ponchado de patch cords T568B y mantenimiento preventivo a 24 estaciones de trabajo del laboratorio escolar.",
          tools: ["Cisco Packet Tracer", "Linux", "T568B"],
          impact: "Redujo en 40 % las fallas de conectividad durante prácticas de 5.º año.",
          url: "",
        },
        {
          id: "p2",
          title: "Sistema de registro de préstamos de equipos en SQL",
          role: "Desarrollador de base de datos",
          period: "2026",
          summary:
            "Diseñé el esquema relacional y consultas de control para organizar el inventario de proyectores y cables del módulo TI.",
          tools: ["PostgreSQL", "SQL", "HTML"],
          impact: "Permitió consultar disponibilidad en menos de 10 segundos.",
          url: "",
        },
      ],
      experience: [
        {
          id: "e1",
          organization: "Laboratorio TI · E.T.C. Andrés Bello",
          role: "Preparador estudiantil de soporte",
          period: "Oct 2025 - Actualidad",
          summary:
            "Apoyé a docentes y estudiantes de 1.º a 3.º año en la configuración inicial de equipos y resolución de incidencias básicas.",
          achievements: ["Atendí más de 30 equipos durante jornadas de cierre de lapso."],
        },
      ],
      certifications: [
        {
          id: "c1",
          name: "Fundamentos de Redes CCNA Intro",
          issuer: "Cisco Networking Academy",
          year: "2026",
          credentialUrl: "",
        },
      ],
      customSections: [
        {
          id: "cs1",
          title: "Reconocimientos",
          items: [
            {
              id: "ci1",
              heading: "1.er Lugar Feria Socioproductiva de Telemática",
              subtitle: "E.T.C. Andrés Bello",
              period: "2026",
              description: "Reconocimiento al mejor prototipo de monitoreo de red local.",
            },
          ],
        },
      ],
    });

    const evaluation = evaluateStudentPortfolio(strongDraft, {
      mencionCode: "TELEMATICA",
      mencionName: "Telemática",
      gradeYear: 6,
    });
    assert.ok(evaluation.totalScore >= 90, `Esperado >= 90, recibido ${evaluation.totalScore}`);
    assert.equal(evaluation.levelCode, "excelencia");
    assert.equal(evaluation.signals.length, 0);
  });
});
