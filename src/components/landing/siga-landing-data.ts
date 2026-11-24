export interface RoleModule {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  summary: string;
  features: string[];
  previewTitle: string;
  previewSubtitle: string;
  previewItems: { label: string; value: string; status?: "ok" | "accent" | "neutral" }[];
}

export interface CoreHighlightRow {
  index: string;
  name: string;
  description: string;
  href: string;
}

export type WarpDetail = "slider" | "ring" | "wave" | "cross";

export interface SponsorItem {
  id: string;
  name: string;
  category: string;
  programTag: string;
  role: string;
  url: string;
  logoSrc: string;
  logoDarkSrc?: string;
  cardLogoSrc: string;
  logoLockup?: boolean;
  logoPadded?: boolean;
  logoBadge?: boolean;
  cardTitle: string;
  value: string;
  unit?: string;
  footer: string;
  detail: WarpDetail;
  labels?: string[];
  numeral: [string, string];
  glow: string;
  accent: string;
  mesh: string[];
}

export const ROLE_MODULES: RoleModule[] = [
  {
    id: "estudiantes",
    label: "Estudiantes",
    eyebrow: "Tu año escolar al día",
    title: "Notas, aulas virtuales y constancias en un solo lugar",
    summary:
      "Consulta tus calificaciones por lapso, entrega tus actividades de clase y descarga tus documentos sin hacer filas.",
    features: [
      "Horario interactivo, calendario de evaluaciones y progreso por momento",
      "Calculadora \"¿Cuánto necesito para aprobar?\" con tus notas reales",
      "Carnet digital inteligente para biblioteca y trámites del plantel",
      "Tutor de estudio 24/7 entrenado únicamente con las guías de tus profesores",
    ],
    previewTitle: "Vista del Estudiante",
    previewSubtitle: "Momento Pedagógico Activo",
    previewItems: [
      { label: "Promedio del lapso", value: "17.8 pts · Al día", status: "ok" },
      { label: "Próxima evaluación", value: "Calculadora activa", status: "accent" },
      { label: "Tutor de Estudio", value: "Disponible con tus guías", status: "neutral" },
      { label: "Carnet Digital", value: "Activo · Biblioteca", status: "ok" },
    ],
  },
  {
    id: "representantes",
    label: "Representantes",
    eyebrow: "Tranquilidad familiar",
    title: "Acompaña a tus hijos desde el teléfono sin perder horas de trabajo",
    summary:
      "Un solo inicio de sesión para ver a todos tus representados inscritos, recibir avisos inmediatos y confirmar citaciones.",
    features: [
      "Perfil unificado para consultar a varios hijos desde una misma cuenta",
      "Alertas tempranas por correo o Telegram ante inasistencias o nuevas notas",
      "Citaciones digitales con registro de fecha y hora de lectura",
      "Resumen semanal cada viernes a las 5:00 PM con asistencia y exámenes",
    ],
    previewTitle: "Resumen Semanal · Viernes 5:00 PM",
    previewSubtitle: "Vista unificada del representante",
    previewItems: [
      { label: "Asistencia semanal", value: "5 de 5 días asistidos", status: "ok" },
      { label: "Nuevas calificaciones", value: "Notificación al instante", status: "ok" },
      { label: "Próxima semana", value: "2 evaluaciones programadas", status: "accent" },
      { label: "Citaciones", value: "Sin citaciones pendientes", status: "neutral" },
    ],
  },
  {
    id: "docentes",
    label: "Docentes",
    eyebrow: "Menos papeleo repetido",
    title: "Pasa asistencia en segundos y olvídate de transcribir notas dos veces",
    summary:
      "Registra la asistencia desde tu celular incluso si falla el internet o la electricidad, y sincroniza tus evaluaciones del Aula Virtual directo a Control de Estudios.",
    features: [
      "Pase de lista en 30 segundos desde el móvil (funciona sin conexión y sincroniza luego)",
      "Paso automático de notas del Aula Virtual a la planilla oficial",
      "Creación de bancos de preguntas y rúbricas a partir de tus propias guías PDF",
      "Redacción asistida de observaciones personalizadas para los boletines",
    ],
    previewTitle: "Jornada Docente",
    previewSubtitle: "Asistencia y evaluación continua",
    previewItems: [
      { label: "Lista de asistencia", value: "32 presentes · Sincronizado", status: "ok" },
      { label: "Plan de Evaluación", value: "Momento I · 100% cargado", status: "ok" },
      { label: "Guía PDF subida", value: "Preguntas listas en aula", status: "accent" },
      { label: "Planilla de notas", value: "Actualizada sin doble tipeo", status: "neutral" },
    ],
  },
  {
    id: "control-estudios",
    label: "Control de Estudios",
    eyebrow: "Orden y respaldo MPPE",
    title: "Inscripciones ágiles, notas auditadas y documentos en un clic",
    summary:
      "Sustituye los procesos manuales por un expediente digital unificado con lectura automática de documentos, formatos oficiales MPPE y seguimiento de Orientación.",
    features: [
      "Inscripción rápida leyendo cédulas o partidas en segundos sin errores de tipeo",
      "Escala 1–20, literales A–E y control automatizado de materias pendientes",
      "Emisión en 1 clic de boletines, constancias y certificación oficial MPPE",
      "Expediente confidencial de Orientación y alertas tempranas de deserción escolar",
    ],
    previewTitle: "Control de Estudios y Secretaría",
    previewSubtitle: "Ciclo Escolar · Código DEA OD01340701",
    previewItems: [
      { label: "Avance de carga docente", value: "En tiempo real por sección", status: "ok" },
      { label: "Boletines y Constancias", value: "Emisión oficial en 1 clic", status: "accent" },
      { label: "Cuadros CDCE", value: "Exportación inmediata", status: "ok" },
      { label: "Orientación escolar", value: "Acceso confidencial protegido", status: "neutral" },
    ],
  },
  {
    id: "pasantias-biblioteca",
    label: "Pasantías y Biblioteca",
    eyebrow: "6.º Año y recursos",
    title: "Seguimiento de pasantías en Guayana y préstamos con carnet digital",
    summary:
      "Acompaña a los estudiantes de 6.º año en sus prácticas profesionales y gestiona el catálogo de libros y equipos audiovisuales del plantel.",
    features: [
      "Asignación de empresa cercana al hogar, bitácora semanal y revisor previo del informe",
      "Evaluación del tutor empresarial desde el celular en 2 minutos mediante enlace seguro",
      "Catálogo digital de libros y proyectos con registro ágil mediante el carnet digital",
      "Reserva controlada de videobeams, laptops y equipos para los docentes",
    ],
    previewTitle: "Pasantías 6.º Año & Biblioteca",
    previewSubtitle: "Integrado en S.I.G.A.",
    previewItems: [
      { label: "Cartas y postulaciones", value: "Generación masiva en 1 clic", status: "ok" },
      { label: "Informe de pasantías", value: "Revisión de normas activa", status: "accent" },
      { label: "Evaluación empresa", value: "Enlace directo sin registro", status: "ok" },
      { label: "Préstamos biblioteca", value: "Control con carnet digital", status: "neutral" },
    ],
  },
];

export const CORE_HIGHLIGHT_ROWS: CoreHighlightRow[] = [
  {
    index: "01",
    name: "Boletines, constancias y planillas oficiales en un clic",
    description:
      "Emite constancias de estudio, boletines por momento y formatos del MPPE directo desde el expediente único de cada estudiante sin transcripciones manuales.",
    href: "/login",
  },
  {
    index: "02",
    name: "Funciona en el aula incluso sin internet ni electricidad",
    description:
      "Se instala directo en cualquier teléfono Android o iPhone; si cae la señal durante la clase, la asistencia y notas se guardan en el equipo y sincronizan al volver la red.",
    href: "/login",
  },
  {
    index: "03",
    name: "Conectado con el portal oficial de la E.T.C. Andrés Bello",
    description:
      "Toda la historia del plantel, recorrido por sus instalaciones y detalle de sus carreras técnicas se consulta en el sitio institucional principal.",
    href: "https://www.etcandresbello.org",
  },
];

export const SPONSORS: SponsorItem[] = [
  {
    id: "github",
    name: "GitHub",
    category: "Código abierto & CI/CD",
    programTag: "Repositorio Open Source",
    role: "Control de versiones, resguardo del código fuente abierto y flujo colaborativo de S.I.G.A.",
    url: "https://github.com/E-T-C-Andres-Bello/S.I.G.A",
    logoSrc: "/images/plataformas/github-lockup-black.svg",
    logoDarkSrc: "/images/plataformas/github-lockup-white.svg",
    cardLogoSrc: "/images/plataformas/github-lockup-white.svg",
    logoLockup: true,
    cardTitle: "GitHub\nOpen Source & CI",
    value: "100",
    unit: "%",
    footer: "Código público E.T.C.",
    detail: "slider",
    labels: ["Abierto", "Seguro"],
    numeral: ["#3ad2ff", "#8cf6ff"],
    glow: "#12b0e8",
    accent: "#7fe8ff",
    mesh: [
      "#022852", "#031e3f", "#031934", "#021831", "#021b36", "#022246",
      "#022345", "#020e1e", "#01040f", "#000416", "#020b31", "#021c57",
      "#01172f", "#01010c", "#03001d", "#0a0f4c", "#112383", "#0b36af",
      "#021142", "#050b47", "#0c2e8f", "#165bd4", "#1675fd", "#167bff",
      "#03288e", "#0438af", "#0d66e7", "#107eec", "#30afff", "#71dcff",
      "#0356e8", "#0259ec", "#0945b0", "#001a49", "#3f7c9d", "#d4ffff",
      "#0365ff", "#0256ea", "#052a87", "#00001f", "#1f4c7b", "#9ee7ff",
    ],
  },
  {
    id: "figma",
    name: "Figma",
    category: "Diseño de interfaz",
    programTag: "Prototipado & UI",
    role: "Prototipado e interfaz académica de S.I.G.A. diseñada con la plataforma Figma.",
    url: "https://www.figma.com",
    logoSrc: "/images/plataformas/figma-icon-black.svg",
    logoDarkSrc: "/images/plataformas/figma-icon-white.svg",
    cardLogoSrc: "/images/plataformas/figma-icon-white.svg",
    logoLockup: false,
    logoPadded: true,
    cardTitle: "Figma\nDiseño Académico",
    value: "72",
    unit: "ui",
    footer: "Sistema de interfaz",
    detail: "cross",
    labels: ["Sistema", "in", "out"],
    numeral: ["#e2a6ff", "#fff6ff"],
    glow: "#62bce8",
    accent: "#d9a8ff",
    mesh: [
      "#4c2d5f", "#3b2245", "#3e285b", "#33204f", "#381844", "#572571",
      "#644096", "#4f3688", "#8358f6", "#8d54f3", "#5e20ac", "#6e24b7",
      "#482e6d", "#261b48", "#825bf6", "#d48cff", "#d07bff", "#b359ff",
      "#2d1837", "#140a1b", "#2c1d66", "#3a2383", "#693bca", "#8b42ef",
      "#411c5b", "#300753", "#3b006e", "#500f79", "#7e31c1", "#9541f3",
      "#44245a", "#3f0c69", "#6f15b9", "#d17cff", "#e2a3ff", "#a668ff",
      "#4b2f60", "#4d2172", "#6819aa", "#9b48dc", "#965dc9", "#7745c4",
    ],
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    category: "Red Edge & Seguridad",
    programTag: "Seguridad perimetral",
    role: "Aceleración global, protección DNS y seguridad web para la infraestructura de S.I.G.A.",
    url: "https://www.cloudflare.com",
    logoSrc: "/images/plataformas/cloudflare-badge.png",
    cardLogoSrc: "/images/plataformas/cloudflare-badge.png",
    logoLockup: true,
    logoBadge: true,
    cardTitle: "Cloudflare\nRed Edge & DNS",
    value: "20",
    unit: "ms",
    footer: "Protección DNS y Edge",
    detail: "ring",
    numeral: ["#fed7aa", "#ffffff"],
    glow: "#3b82f6",
    accent: "#fdba74",
    mesh: [
      "#050b18", "#091329", "#0d1c3d", "#112552", "#162e66", "#1b387a",
      "#040914", "#081226", "#0e1e40", "#142c5c", "#1a3978", "#214694",
      "#060d1f", "#0b1836", "#132959", "#1b3b7d", "#234da3", "#2b60c9",
      "#050b1a", "#0a152e", "#11244d", "#18336e", "#1f428f", "#2753b3",
      "#030814", "#071024", "#0c1b3b", "#112754", "#16326b", "#1c3e85",
      "#02050d", "#050b1a", "#08132b", "#0c1c3d", "#10244f", "#142c61",
      "#01040a", "#030814", "#050d1f", "#08142e", "#0b1a3b", "#0e2047",
    ],
  },
  {
    id: "posthog",
    name: "PostHog",
    category: "Analítica de Producto",
    programTag: "Métricas de uso y desempeño",
    role: "Analítica de uso, métricas de rendimiento y mejora continua de la experiencia estudiantil.",
    url: "https://posthog.com",
    logoSrc: "/images/plataformas/posthog-logo.svg",
    logoDarkSrc: "/images/plataformas/posthog-logo-white.svg",
    cardLogoSrc: "/images/plataformas/posthog-logo-white.svg",
    logoLockup: true,
    cardTitle: "PostHog\nTelemetría Real",
    value: "95",
    unit: "fps",
    footer: "Rendimiento continuo",
    detail: "wave",
    numeral: ["#fffdf8", "#e8603f"],
    glow: "#6cc0ea",
    accent: "#ff6a3d",
    mesh: [
      "#48001c", "#400119", "#41011d", "#4b021e", "#47021a", "#480019",
      "#7e0036", "#8c0033", "#4b0120", "#10000c", "#1f010b", "#390116",
      "#e84396", "#ff568c", "#dc433c", "#0e0705", "#090004", "#2f0213",
      "#ff9fd9", "#ff6f90", "#a53625", "#190d05", "#050002", "#2f0110",
      "#ff67b5", "#b11348", "#000000", "#11000c", "#3e021b", "#8a0c31",
      "#e31771", "#5d0027", "#3a0021", "#620030", "#640627", "#dc184a",
      "#c10b5f", "#920245", "#ab054f", "#910041", "#650226", "#c01240",
    ],
  },
  {
    id: "mailtrap",
    name: "Mailtrap",
    category: "Correo transaccional",
    programTag: "Envío escolar",
    role: "Pruebas seguras y envío confiable de notificaciones académicas y avisos escolares.",
    url: "https://mailtrap.io",
    logoSrc: "/images/plataformas/mailtrap-logo-light.svg",
    logoDarkSrc: "/images/plataformas/mailtrap-logo-dark.svg",
    cardLogoSrc: "/images/plataformas/mailtrap-logo-dark.svg",
    logoLockup: true,
    cardTitle: "Mailtrap\nCorreo Escolar",
    value: "98",
    unit: "%",
    footer: "Entrega escolar directa",
    detail: "wave",
    numeral: ["#86efac", "#ecfdf5"],
    glow: "#22d172",
    accent: "#6ee7b7",
    mesh: [
      "#061b29", "#092536", "#0b2e42", "#0d384f", "#10455e", "#14536f",
      "#04141f", "#07212e", "#0a3342", "#0c4654", "#105c69", "#15757f",
      "#051822", "#092c37", "#0e4d57", "#147272", "#1aa187", "#22d172",
      "#051923", "#0b313b", "#12525b", "#16706d", "#1ca07e", "#34d399",
      "#04121b", "#07202b", "#0d3842", "#114d52", "#166e64", "#1c9475",
      "#030d14", "#061822", "#092530", "#0d323b", "#104347", "#145759",
      "#020a10", "#04121a", "#061b24", "#09242c", "#0c3036", "#0e3d42",
    ],
  },
  {
    id: "google-workspace",
    name: "Google Workspace™",
    category: "Identidad & Educación",
    programTag: "Compatibilidad escolar",
    role: "Compatible con Google Workspace™ para identidad escolar y colaboración académica institucional.",
    url: "https://workspace.google.com",
    logoSrc: "/images/plataformas/google-g-gradient.png",
    cardLogoSrc: "/images/plataformas/google-g-gradient.png",
    logoLockup: false,
    cardTitle: "Google Workspace™\nIdentidad Escolar",
    value: "24",
    unit: "/7",
    footer: "Dominio @etcandresbello",
    detail: "ring",
    numeral: ["#93c5fd", "#e0f2fe"],
    glow: "#4285f4",
    accent: "#93c5fd",
    mesh: [
      "#091329", "#0d1c3d", "#122754", "#17336e", "#1c4087", "#234fa3",
      "#060d1f", "#0c1b3b", "#142e63", "#1c4391", "#2558bd", "#3b76ed",
      "#071124", "#11244d", "#1a3c80", "#2655b3", "#3673e6", "#4285f4",
      "#081226", "#102247", "#193670", "#234ba1", "#2e65d1", "#60a5fa",
      "#060d1c", "#0b1936", "#112754", "#183773", "#204996", "#2a5ec2",
      "#040914", "#081126", "#0d1c3b", "#122752", "#18336b", "#1e4085",
      "#02050d", "#050b1a", "#081229", "#0c1b3b", "#0f234d", "#142c5e",
    ],
  },
  {
    id: "sentry",
    name: "Sentry™",
    category: "Monitoreo & Telemetría",
    programTag: "Monitoreo técnico",
    role: "Monitoreo de errores, trazabilidad técnica y diagnóstico de estabilidad en tiempo real.",
    url: "https://sentry.io",
    logoSrc: "/images/plataformas/sentry-logo-dark.svg",
    logoDarkSrc: "/images/plataformas/sentry-logo-light.svg",
    cardLogoSrc: "/images/plataformas/sentry-logo-light.svg",
    logoLockup: true,
    cardTitle: "Sentry™\nMonitoreo en Vivo",
    value: "0",
    unit: "err",
    footer: "Monitoreo en vivo",
    detail: "cross",
    labels: ["Trazas", "in", "ok"],
    numeral: ["#ddd6fe", "#ffffff"],
    glow: "#8b5cf6",
    accent: "#c4b5fd",
    mesh: [
      "#110c1c", "#181129", "#221738", "#2d1e4a", "#3a255e", "#492d75",
      "#0c0814", "#150e24", "#22163b", "#322057", "#472c7a", "#623ca8",
      "#0e0a17", "#1a122e", "#2c1c4d", "#422773", "#5c36a3", "#8b5cf6",
      "#0d0914", "#171029", "#261842", "#392363", "#50318a", "#7c3aed",
      "#08060d", "#100b1c", "#1a122e", "#261a42", "#342359", "#462f78",
      "#050408", "#0a0712", "#110c1f", "#19112e", "#22173d", "#2c1e4f",
      "#030205", "#06040a", "#0a0712", "#0f0a1c", "#140e26", "#1a1230",
    ],
  },
  {
    id: "neon",
    name: "Neon",
    category: "Base de Datos & Serverless",
    programTag: "PostgreSQL Serverless & RLS",
    role: "Base de datos PostgreSQL principal con seguridad por rol (RLS), almacenamiento de archivos, funciones serverless y ramas SQL aisladas para Telemática.",
    url: "https://neon.com",
    logoSrc: "/images/plataformas/neon-logo-light-color.svg",
    logoDarkSrc: "/images/plataformas/neon-logo-dark-color.svg",
    cardLogoSrc: "/images/plataformas/neon-logo-dark-color.svg",
    logoLockup: true,
    cardTitle: "Neon\nPostgreSQL & RLS",
    value: "100",
    unit: "%",
    footer: "PostgreSQL Serverless y branching",
    detail: "ring",
    numeral: ["#34D59A", "#E4F1EB"],
    glow: "#34D59A",
    accent: "#34D59A",
    mesh: [
      "#020504", "#040b08", "#07140f", "#0a1f17", "#0d2b20", "#11382a",
      "#010403", "#040d0a", "#081a13", "#0d2b20", "#133d2e", "#1a523e",
      "#020605", "#05120d", "#0b241b", "#123b2c", "#1a5942", "#34D59A",
      "#020706", "#05140f", "#0a261c", "#103a2b", "#18543f", "#2bb583",
      "#010504", "#040f0b", "#081c15", "#0d2b20", "#123d2e", "#19523e",
      "#010302", "#030907", "#06120e", "#091d16", "#0d291f", "#113629",
      "#000000", "#020504", "#040a08", "#06100c", "#091712", "#0c1f18",
    ],
  },
];
