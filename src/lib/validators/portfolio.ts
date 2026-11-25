import { z } from "zod";

export const PORTFOLIO_TEMPLATE_IDS = [
  "clasico-ejecutivo",
  "tecnico-moderno",
  "editorial-minimalista",
  "creativo-bellista",
  "ats-compacto",
  "ingenieria-telematica",
  "comercio-aduanas",
  "hospitalidad-turismo",
  "timeline-academico",
  "dos-columnas-ejecutivo",
  "custom",
] as const;

export type PortfolioTemplateId = (typeof PORTFOLIO_TEMPLATE_IDS)[number];

export const PORTFOLIO_LAYOUT_MODES = [
  "single",
  "sidebar_left",
  "sidebar_right",
] as const;

export type PortfolioLayoutMode = (typeof PORTFOLIO_LAYOUT_MODES)[number];

export const PORTFOLIO_HEADER_STYLES = [
  "banner",
  "split",
  "centered",
  "minimal",
  "gradient",
] as const;

export type PortfolioHeaderStyle = (typeof PORTFOLIO_HEADER_STYLES)[number];

export const PORTFOLIO_FONT_STYLES = [
  "modern",
  "editorial",
  "technical",
] as const;

export type PortfolioFontStyle = (typeof PORTFOLIO_FONT_STYLES)[number];

export const PORTFOLIO_DENSITIES = [
  "compact",
  "balanced",
  "spacious",
] as const;

export type PortfolioDensity = (typeof PORTFOLIO_DENSITIES)[number];

export const PORTFOLIO_SECTION_KEYS = [
  "about",
  "education",
  "projects",
  "experience",
  "skills",
  "languages",
  "certifications",
  "custom",
] as const;

export type PortfolioSectionKey = (typeof PORTFOLIO_SECTION_KEYS)[number];

export const PORTFOLIO_SECTION_LABELS: Record<PortfolioSectionKey, string> = {
  about: "Perfil Profesional",
  education: "Formación Verificada",
  projects: "Proyectos Técnicos",
  experience: "Experiencia y Prácticas",
  skills: "Habilidades y Herramientas",
  languages: "Idiomas",
  certifications: "Cursos y Certificaciones",
  custom: "Secciones Personalizadas",
};

export interface PortfolioDesignConfig {
  layout: PortfolioLayoutMode;
  headerStyle: PortfolioHeaderStyle;
  accentColor: string;
  fontStyle: PortfolioFontStyle;
  density: PortfolioDensity;
  showPhoto: boolean;
  showQrSeal: boolean;
  sectionOrder: PortfolioSectionKey[];
}

export interface PortfolioTemplatePreset {
  id: Exclude<PortfolioTemplateId, "custom">;
  name: string;
  tagline: string;
  recommendedFor: string;
  badge: string;
  design: PortfolioDesignConfig;
}

export const PORTFOLIO_ACCENT_SWATCHES = [
  { label: "Azul Bellista", hex: "#1c47c4" },
  { label: "Marino Ejecutivo", hex: "#1e3a8a" },
  { label: "Cian Telemática", hex: "#0284c7" },
  { label: "Esmeralda Aduana", hex: "#0f766e" },
  { label: "Ámbar Turismo", hex: "#b45309" },
  { label: "Índigo Académico", hex: "#4338ca" },
  { label: "Grafito Editorial", hex: "#0f172a" },
  { label: "Borgoña Formal", hex: "#9f1239" },
] as const;

export const DEFAULT_SECTION_ORDER: PortfolioSectionKey[] = [
  "about",
  "projects",
  "experience",
  "education",
  "skills",
  "languages",
  "certifications",
  "custom",
];

export const PORTFOLIO_TEMPLATES: readonly PortfolioTemplatePreset[] = [
  {
    id: "tecnico-moderno",
    name: "Técnico Moderno",
    tagline: "Barra lateral izquierda estructurada con habilidades y cabecera nítida.",
    recommendedFor: "Pasantías técnicas y primer empleo",
    badge: "Popular",
    design: {
      layout: "sidebar_left",
      headerStyle: "banner",
      accentColor: "#1c47c4",
      fontStyle: "modern",
      density: "balanced",
      showPhoto: true,
      showQrSeal: true,
      sectionOrder: [...DEFAULT_SECTION_ORDER],
    },
  },
  {
    id: "clasico-ejecutivo",
    name: "Clásico Ejecutivo",
    tagline: "Una columna sobria de alta formalidad con encabezado centrado.",
    recommendedFor: "Banca, empresas básicas y administración",
    badge: "Formal",
    design: {
      layout: "single",
      headerStyle: "centered",
      accentColor: "#1e3a8a",
      fontStyle: "editorial",
      density: "balanced",
      showPhoto: false,
      showQrSeal: true,
      sectionOrder: ["about", "education", "experience", "projects", "skills", "certifications", "languages", "custom"],
    },
  },
  {
    id: "editorial-minimalista",
    name: "Editorial Minimalista",
    tagline: "Estética suiza limpia, tipografía contrastada y máximo respiro visual.",
    recommendedFor: "Perfiles versátiles y presentaciones directas",
    badge: "Limpio",
    design: {
      layout: "single",
      headerStyle: "minimal",
      accentColor: "#0f172a",
      fontStyle: "editorial",
      density: "spacious",
      showPhoto: false,
      showQrSeal: true,
      sectionOrder: ["about", "projects", "experience", "skills", "education", "languages", "certifications", "custom"],
    },
  },
  {
    id: "creativo-bellista",
    name: "Creativo Bellista",
    tagline: "Cabecera con degradado institucional, identidad visual fuerte y dos columnas.",
    recommendedFor: "Destacar identidad de la E.T.C. Andrés Bello",
    badge: "Institucional",
    design: {
      layout: "sidebar_left",
      headerStyle: "gradient",
      accentColor: "#1c47c4",
      fontStyle: "modern",
      density: "balanced",
      showPhoto: true,
      showQrSeal: true,
      sectionOrder: [...DEFAULT_SECTION_ORDER],
    },
  },
  {
    id: "ats-compacto",
    name: "ATS Corporativo",
    tagline: "Una columna compacta optimizada para lectura rápida y filtros de RRHH.",
    recommendedFor: "Postulaciones en portales web y multinacionales",
    badge: "ATS",
    design: {
      layout: "single",
      headerStyle: "minimal",
      accentColor: "#1e293b",
      fontStyle: "modern",
      density: "compact",
      showPhoto: false,
      showQrSeal: true,
      sectionOrder: ["about", "skills", "projects", "experience", "education", "certifications", "languages", "custom"],
    },
  },
  {
    id: "ingenieria-telematica",
    name: "Perfil Telemática & TI",
    tagline: "Enfoque en stack técnico, laboratorios, redes, código y proyectos demostrables.",
    recommendedFor: "Mención Telemática y soporte TI",
    badge: "Telemática",
    design: {
      layout: "sidebar_left",
      headerStyle: "split",
      accentColor: "#0284c7",
      fontStyle: "technical",
      density: "balanced",
      showPhoto: true,
      showQrSeal: true,
      sectionOrder: ["about", "projects", "skills", "experience", "certifications", "education", "languages", "custom"],
    },
  },
  {
    id: "comercio-aduanas",
    name: "Comercio & Aduanas",
    tagline: "Columna derecha de competencias normativas y foco en logística y documentación.",
    recommendedFor: "Mención Aduana y agencias navieras",
    badge: "Aduana",
    design: {
      layout: "sidebar_right",
      headerStyle: "split",
      accentColor: "#0f766e",
      fontStyle: "modern",
      density: "balanced",
      showPhoto: true,
      showQrSeal: true,
      sectionOrder: ["about", "experience", "projects", "education", "skills", "certifications", "languages", "custom"],
    },
  },
  {
    id: "hospitalidad-turismo",
    name: "Hospitalidad & Turismo",
    tagline: "Diseño cálido y elegante destacando idiomas, protocolo y organización de eventos.",
    recommendedFor: "Mención Turismo, hotelería y eventos",
    badge: "Turismo",
    design: {
      layout: "sidebar_right",
      headerStyle: "banner",
      accentColor: "#b45309",
      fontStyle: "editorial",
      density: "balanced",
      showPhoto: true,
      showQrSeal: true,
      sectionOrder: ["about", "experience", "projects", "languages", "skills", "education", "certifications", "custom"],
    },
  },
  {
    id: "timeline-academico",
    name: "Trayectoria Académica",
    tagline: "Resalta formación 1.º–6.º año, proyectos socioproductivos PEST y distinciones.",
    recommendedFor: "Becas universitarias y primer ingreso a pasantías",
    badge: "Académico",
    design: {
      layout: "single",
      headerStyle: "split",
      accentColor: "#4338ca",
      fontStyle: "modern",
      density: "balanced",
      showPhoto: true,
      showQrSeal: true,
      sectionOrder: ["about", "education", "projects", "certifications", "skills", "experience", "languages", "custom"],
    },
  },
  {
    id: "dos-columnas-ejecutivo",
    name: "Ejecutivo Invertido",
    tagline: "Columna principal amplia a la izquierda y ficha técnica verificada a la derecha.",
    recommendedFor: "Pasantías corporativas y entrevistas presenciales",
    badge: "Balanceado",
    design: {
      layout: "sidebar_right",
      headerStyle: "centered",
      accentColor: "#334155",
      fontStyle: "editorial",
      density: "balanced",
      showPhoto: true,
      showQrSeal: true,
      sectionOrder: ["about", "experience", "projects", "education", "skills", "languages", "certifications", "custom"],
    },
  },
];

export function resolvePortfolioDesign(
  templateId: PortfolioTemplateId,
  customDesign?: Partial<PortfolioDesignConfig> | null
): PortfolioDesignConfig {
  const preset =
    PORTFOLIO_TEMPLATES.find((t) => t.id === templateId) ?? PORTFOLIO_TEMPLATES[0];
  const base = preset.design;
  if (!customDesign) return { ...base, sectionOrder: [...base.sectionOrder] };

  const rawOrder = Array.isArray(customDesign.sectionOrder)
    ? customDesign.sectionOrder.filter((k): k is PortfolioSectionKey =>
        (PORTFOLIO_SECTION_KEYS as readonly string[]).includes(k)
      )
    : [];
  const dedupedOrder: PortfolioSectionKey[] = [];
  for (const key of [...rawOrder, ...base.sectionOrder]) {
    if (!dedupedOrder.includes(key)) dedupedOrder.push(key);
  }

  return {
    layout:
      customDesign.layout &&
      (PORTFOLIO_LAYOUT_MODES as readonly string[]).includes(customDesign.layout)
        ? customDesign.layout
        : base.layout,
    headerStyle:
      customDesign.headerStyle &&
      (PORTFOLIO_HEADER_STYLES as readonly string[]).includes(
        customDesign.headerStyle
      )
        ? customDesign.headerStyle
        : base.headerStyle,
    accentColor:
      typeof customDesign.accentColor === "string" &&
      /^#[0-9a-f]{6}$/i.test(customDesign.accentColor.trim())
        ? customDesign.accentColor.trim()
        : base.accentColor,
    fontStyle:
      customDesign.fontStyle &&
      (PORTFOLIO_FONT_STYLES as readonly string[]).includes(customDesign.fontStyle)
        ? customDesign.fontStyle
        : base.fontStyle,
    density:
      customDesign.density &&
      (PORTFOLIO_DENSITIES as readonly string[]).includes(customDesign.density)
        ? customDesign.density
        : base.density,
    showPhoto:
      typeof customDesign.showPhoto === "boolean"
        ? customDesign.showPhoto
        : base.showPhoto,
    showQrSeal:
      typeof customDesign.showQrSeal === "boolean"
        ? customDesign.showQrSeal
        : base.showQrSeal,
    sectionOrder: dedupedOrder,
  };
}

export const MENTION_SUGGESTED_SKILLS: Record<string, string[]> = {
  TELEMATICA: [
    "Redes LAN / TCP-IP",
    "Cableado estructurado T568A/B",
    "Soporte técnico de hardware y software",
    "Administración Windows y Linux",
    "Bases de datos SQL",
    "HTML, CSS y JavaScript",
    "Mantenimiento preventivo de equipos",
    "Diagnóstico de conectividad Wi-Fi",
  ],
  ADUANA: [
    "Clasificación Arancelaria (Sistema Armonizado)",
    "Valoración Aduanera (CIF / FOB)",
    "Incoterms vigentes",
    "Documentación de Importación / Exportación (DUA, B/L)",
    "Contabilidad comercial básica",
    "Legislación mercantil y aduanera",
    "Logística portuaria y despacho",
    "Microsoft Excel intermedio",
  ],
  TURISMO: [
    "Guiatura patrimonial y ecoturística",
    "Protocolo y organización de eventos",
    "Recepción hotelera (Check-in / Check-out)",
    "Atención al cliente y anfitrionía",
    "Diseño de rutas turísticas de Guayana",
    "Inglés turístico conversacional",
    "Gestión de agencias de viaje",
    "Muestras culturales y gastronómicas",
  ],
  GENERAL: [
    "Trabajo en equipo",
    "Comunicación efectiva",
    "Resolución de problemas",
    "Ofimática (Word, Excel, PowerPoint)",
    "Organización y gestión del tiempo",
    "Redacción de informes técnicos",
  ],
};

const safeHttpsUrlSchema = z
  .string()
  .trim()
  .max(240, "El enlace es demasiado largo.")
  .refine(
    (val) => val === "" || /^https:\/\/[^\s]+$/i.test(val),
    "Solo se permiten enlaces seguros que comiencen con https://"
  );

export const portfolioLinkSchema = z.object({
  id: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1, "Agrega un nombre al enlace.").max(40),
  url: z
    .string()
    .trim()
    .max(240)
    .refine(
      (val) => /^https:\/\/[^\s]+$/i.test(val),
      "El enlace debe iniciar con https://"
    ),
});

export const portfolioSkillSchema = z.object({
  id: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1, "Indica la habilidad.").max(64),
  category: z.enum(["tecnica", "herramienta", "blanda"]).default("tecnica"),
  level: z.enum(["basico", "intermedio", "avanzado"]).default("intermedio"),
});

export const portfolioLanguageSchema = z.object({
  id: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1, "Indica el idioma.").max(40),
  level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2", "Nativo"]).default("B1"),
});

export const portfolioProjectSchema = z.object({
  id: z.string().trim().min(1).max(40),
  title: z.string().trim().min(2, "Indica el título del proyecto.").max(100),
  role: z.string().trim().max(70).default(""),
  period: z.string().trim().max(40).default(""),
  summary: z.string().trim().max(550).default(""),
  tools: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  impact: z.string().trim().max(260).default(""),
  url: safeHttpsUrlSchema.optional().default(""),
});

export const portfolioExperienceSchema = z.object({
  id: z.string().trim().min(1).max(40),
  organization: z.string().trim().min(2, "Indica la organización o espacio.").max(100),
  role: z.string().trim().min(2, "Indica tu rol o cargo.").max(80),
  period: z.string().trim().max(40).default(""),
  summary: z.string().trim().max(500).default(""),
  achievements: z.array(z.string().trim().min(1).max(200)).max(6).default([]),
});

export const portfolioCertificationSchema = z.object({
  id: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2, "Indica el nombre del curso o logro.").max(110),
  issuer: z.string().trim().max(90).default(""),
  year: z.string().trim().max(16).default(""),
  credentialUrl: safeHttpsUrlSchema.optional().default(""),
});

export const portfolioCustomSectionItemSchema = z.object({
  id: z.string().trim().min(1).max(40),
  heading: z.string().trim().min(1, "Agrega un título al elemento.").max(100),
  subtitle: z.string().trim().max(80).default(""),
  period: z.string().trim().max(40).default(""),
  description: z.string().trim().max(450).default(""),
});

export const portfolioCustomSectionSchema = z.object({
  id: z.string().trim().min(1).max(40),
  title: z.string().trim().min(2, "Indica el nombre de la sección.").max(60),
  items: z.array(portfolioCustomSectionItemSchema).max(10).default([]),
});

export const portfolioPrivacySchema = z.object({
  show_photo: z.boolean().default(true),
  show_email: z.boolean().default(false),
  show_phone: z.boolean().default(false),
  show_average: z.boolean().default(false),
  show_medals: z.boolean().default(true),
});

export const portfolioDesignConfigSchema = z.object({
  layout: z.enum(PORTFOLIO_LAYOUT_MODES).default("sidebar_left"),
  headerStyle: z.enum(PORTFOLIO_HEADER_STYLES).default("banner"),
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-f]{6}$/i, "Color hexadecimal inválido.")
    .default("#1c47c4"),
  fontStyle: z.enum(PORTFOLIO_FONT_STYLES).default("modern"),
  density: z.enum(PORTFOLIO_DENSITIES).default("balanced"),
  showPhoto: z.boolean().default(true),
  showQrSeal: z.boolean().default(true),
  sectionOrder: z
    .array(z.enum(PORTFOLIO_SECTION_KEYS))
    .min(1)
    .max(PORTFOLIO_SECTION_KEYS.length)
    .default([...DEFAULT_SECTION_ORDER]),
});

export const portfolioContactMetaSchema = z.object({
  city: z.string().trim().max(80).default("Puerto Ordaz, Estado Bolívar"),
  availability: z.string().trim().max(80).default(""),
  links: z.array(portfolioLinkSchema).max(6).default([]),
});

export const studentPortfolioDraftSchema = z.object({
  templateId: z.enum(PORTFOLIO_TEMPLATE_IDS).default("tecnico-moderno"),
  designConfig: portfolioDesignConfigSchema,
  headline: z.string().trim().max(140, "Máximo 140 caracteres.").default(""),
  aboutSummary: z.string().trim().max(1200, "Máximo 1200 caracteres.").default(""),
  contactMeta: portfolioContactMetaSchema,
  skills: z.array(portfolioSkillSchema).max(24).default([]),
  languages: z.array(portfolioLanguageSchema).max(8).default([]),
  projects: z.array(portfolioProjectSchema).max(10).default([]),
  experience: z.array(portfolioExperienceSchema).max(10).default([]),
  certifications: z.array(portfolioCertificationSchema).max(12).default([]),
  customSections: z.array(portfolioCustomSectionSchema).max(6).default([]),
  isPublic: z.boolean().default(false),
  publicSlug: z
    .string()
    .trim()
    .toLowerCase()
    .max(48)
    .refine(
      (val) => val === "" || /^[a-z0-9][a-z0-9-]{2,46}[a-z0-9]$/.test(val),
      "Usa entre 4 y 48 caracteres con letras minúsculas, números y guiones."
    )
    .default(""),
  privacySettings: portfolioPrivacySchema,
});

export type PortfolioLinkItem = z.infer<typeof portfolioLinkSchema>;
export type PortfolioSkillItem = z.infer<typeof portfolioSkillSchema>;
export type PortfolioLanguageItem = z.infer<typeof portfolioLanguageSchema>;
export type PortfolioProjectItem = z.infer<typeof portfolioProjectSchema>;
export type PortfolioExperienceItem = z.infer<typeof portfolioExperienceSchema>;
export type PortfolioCertificationItem = z.infer<typeof portfolioCertificationSchema>;
export type PortfolioCustomSectionItem = z.infer<typeof portfolioCustomSectionItemSchema>;
export type PortfolioCustomSection = z.infer<typeof portfolioCustomSectionSchema>;
export type PortfolioPrivacySettings = z.infer<typeof portfolioPrivacySchema>;
export type PortfolioContactMeta = z.infer<typeof portfolioContactMetaSchema>;
export type StudentPortfolioDraft = z.infer<typeof studentPortfolioDraftSchema>;

export const portfolioAiCoachRequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("coach"),
    sectionKey: z.enum([
      "headline",
      "about",
      "skills",
      "projects",
      "experience",
      "certifications",
      "custom",
      "general",
    ]),
    focusItemTitle: z.string().trim().max(120).optional().default(""),
    message: z
      .string()
      .trim()
      .min(2, "Escribe una respuesta o pregunta para tu Coach IA.")
      .max(1000, "El mensaje no puede exceder los 1000 caracteres."),
    mencionName: z.string().trim().max(80).optional().default(""),
    gradeYear: z.number().int().min(1).max(6).nullable().optional().default(null),
    currentBlockText: z.string().trim().max(1600).optional().default(""),
    history: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().trim().min(1).max(700),
        })
      )
      .max(6)
      .optional()
      .default([]),
  }),
  z.object({
    mode: z.literal("import_pdf"),
    extractedText: z
      .string()
      .trim()
      .min(40, "El PDF no contiene suficiente texto seleccionable para extraer un currículum.")
      .max(14000, "El texto extraído del PDF es demasiado largo (máximo 14.000 caracteres)."),
    mencionName: z.string().trim().max(80).optional().default(""),
    gradeYear: z.number().int().min(1).max(6).nullable().optional().default(null),
  }),
]);

export type PortfolioAiCoachRequest = z.infer<typeof portfolioAiCoachRequestSchema>;

export interface PortfolioCoachResponsePayload {
  ok: true;
  mode: "coach";
  reply: string;
  whyItMatters: string | null;
  guidingQuestions: string[];
  suggestedText: string | null;
  suggestedSkills: string[];
  remainingQuota?: number;
}

export interface PortfolioPdfImportResponsePayload {
  ok: true;
  mode: "import_pdf";
  summary: string;
  suggestedTemplateId: PortfolioTemplateId;
  detectedFieldsCount: number;
  extracted: {
    headline?: string;
    aboutSummary?: string;
    city?: string;
    skills?: Array<{ name: string; category: "tecnica" | "herramienta" | "blanda"; level: "basico" | "intermedio" | "avanzado" }>;
    languages?: Array<{ name: string; level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "Nativo" }>;
    projects?: Array<{ title: string; role: string; period: string; summary: string; tools: string[]; impact: string }>;
    experience?: Array<{ organization: string; role: string; period: string; summary: string; achievements: string[] }>;
    certifications?: Array<{ name: string; issuer: string; year: string }>;
    customSections?: Array<{ title: string; items: Array<{ heading: string; subtitle: string; period: string; description: string }> }>;
  };
  remainingQuota?: number;
}

/**
 * Redacta datos personales sensibles (cédulas venezolanas, correos, teléfonos)
 * antes de enviar texto al Coach IA (OWASP LLM02).
 */
export function scrubPortfolioTextForLlm(raw: string): string {
  return raw
    .replace(/\b[VvEeJj]-?\d{6,9}\b/g, "[CEDULA_PROTEGIDA]")
    .replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
      "[CORREO_PROTEGIDO]"
    )
    .replace(
      /(?:\+?58[\s-]?)?0?(?:412|414|416|424|426|286)[\s-]?\d{3}[\s-]?\d{4}\b/g,
      "[TELEFONO_PROTEGIDO]"
    )
    .replace(/\u0000/g, "")
    .trim();
}

export function sanitizePortfolioPlainText(raw: string, maxLen: number): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, maxLen);
}
