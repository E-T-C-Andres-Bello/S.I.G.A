export type CurriculumAxisId =
  | "formacion_general"
  | "formacion_cientifica_tecnologica"
  | "practica_vocacional_profesional";

export type CurriculumNodeStatus =
  | "enrolled"
  | "approved"
  | "pending_recovery"
  | "prior_stage"
  | "upcoming"
  | "catalog";

export interface CurriculumAxisMeta {
  id: CurriculumAxisId;
  label: string;
  shortLabel: string;
  description: string;
}

export interface CurriculumTrackNodeSummary {
  subjectCode: string;
  subjectName: string;
  gradeYears: number[];
}

export interface SubjectProgressionContext {
  trackTitle: string;
  trackDescription: string;
  nodes: CurriculumTrackNodeSummary[];
  currentIndex: number;
}

export const EVALUATION_TYPE_LABELS: Record<string, string> = {
  exam_online: "Examen Online",
  assignment_lms: "Entrega Aula Virtual",
  lab_mention: "Práctica Mención",
  classroom_activity: "Actividad en Aula",
  project: "Proyecto",
};

export const EVALUATION_SOURCE_LABELS: Record<string, string> = {
  manual: "Registro docente",
  lms_exam_sync: "Examen en línea",
  lms_assignment: "Entrega virtual",
  mention_lab: "Práctica técnica",
};

export const MOMENT_PLAN_STATUS_LABELS: Record<string, string> = {
  draft: "Plan en elaboración",
  published: "Plan publicado",
  locked: "Acta cerrada",
};

export const MOMENT_PERIOD_STATUS_LABELS: Record<string, string> = {
  scheduled: "Programado",
  open: "En curso",
  closed: "Cerrado",
  published: "Publicado",
};

const VOCATIONAL_PRACTICE_CODES = new Set(["OVS", "PPRO"]);
const SCIENTIFIC_TECH_CODES = new Set([
  "PEST",
  "ADU-FTA",
  "TUR-GSTH",
  "TEL-PDSR",
]);

const GENERAL_AXIS_META: CurriculumAxisMeta = {
  id: "formacion_general",
  label: "Formación General",
  shortLabel: "Form. General",
  description:
    "Áreas humanísticas, lingüísticas, deportivas y científico-sociales compartidas.",
};

const SCIENTIFIC_TECH_AXIS_META: CurriculumAxisMeta = {
  id: "formacion_cientifica_tecnologica",
  label: "Formación Científica, Tecnológica y Productiva",
  shortLabel: "Cient. y Tec.",
  description:
    "Competencias técnicas, productivas y especializadas de la mención.",
};

const VOCATIONAL_AXIS_META: CurriculumAxisMeta = {
  id: "practica_vocacional_profesional",
  label: "Práctica Vocacional y Profesional",
  shortLabel: "Práctica Prof.",
  description:
    "Orientación sociolaboral (1.º a 5.º año) y Práctica Profesional de 6.º año.",
};

interface TrackDefinition {
  mencionCode: "ALL" | "TELEMATICA" | "ADUANAS" | "TURISMO";
  title: string;
  description: string;
  codes: string[];
}

const CURRICULUM_TRACK_DEFINITIONS: TrackDefinition[] = [
  {
    mencionCode: "TELEMATICA",
    title: "Formación Técnica Industrial · Telemática",
    description:
      "Continuidad desde proyectos socioproductivos y programación de software y redes hasta la Práctica Profesional de 6.º año.",
    codes: ["PEST", "TEL-PDSR", "OVS", "PPRO"],
  },
  {
    mencionCode: "ADUANAS",
    title: "Economía Social · Aduana",
    description:
      "Integración de proyectos socioproductivos, fundamentos y técnicas de aduana y Práctica Profesional de 6.º año.",
    codes: ["PEST", "ADU-FTA", "OVS", "PPRO"],
  },
  {
    mencionCode: "TURISMO",
    title: "Economía Social · Turismo y Hospitalidad",
    description:
      "Articulación de proyectos socioproductivos, gestión turística-hotelera, idiomas aplicados y Práctica Profesional.",
    codes: ["PEST", "TUR-GSTH", "IDI", "OVS", "PPRO"],
  },
  {
    mencionCode: "ALL",
    title: "Comunicación, Pensamiento Lógico y Lenguas",
    description:
      "Lengua y Literatura, Matemática e Idiomas a lo largo de 1.º a 5.º año.",
    codes: ["LYL", "MAT", "IDI"],
  },
  {
    mencionCode: "ALL",
    title: "Ciencias, Ambiente, Soberanía y Bienestar",
    description:
      "Educación Física (1.º–3.º), Biología, Ambiente y Tecnología y Geografía, Historia y Soberanía Nacional.",
    codes: ["EDF", "BAT", "GHSN"],
  },
];

/**
 * Clasifica un área de formación dentro de su componente oficial del Plan de Estudio.
 */
export function classifyCurriculumAxis(
  subjectCode: string,
  isTechnicalCore: boolean,
  curriculumComponent?: string | null
): CurriculumAxisMeta {
  if (curriculumComponent === "practica_vocacional_profesional") {
    return VOCATIONAL_AXIS_META;
  }
  if (curriculumComponent === "formacion_cientifica_tecnologica") {
    return SCIENTIFIC_TECH_AXIS_META;
  }
  if (curriculumComponent === "formacion_general") {
    return GENERAL_AXIS_META;
  }

  const normalized = subjectCode.trim().toUpperCase();
  if (VOCATIONAL_PRACTICE_CODES.has(normalized)) {
    return VOCATIONAL_AXIS_META;
  }
  if (isTechnicalCore || SCIENTIFIC_TECH_CODES.has(normalized)) {
    return SCIENTIFIC_TECH_AXIS_META;
  }
  return GENERAL_AXIS_META;
}

/**
 * Formatea la carga horaria de un área o de un año escolar (semanal o anual para 6.º año).
 */
export function formatCurriculumWorkload(
  weeklyHours: number,
  annualHours?: number | null,
  style: "short" | "long" = "short"
): string {
  if (annualHours && annualHours > 0 && weeklyHours <= 0) {
    return style === "long"
      ? `${annualHours} horas / año escolar`
      : `${annualHours} h/año`;
  }
  return style === "long"
    ? `${weeklyHours} h / semana`
    : `${weeklyHours} h/sem`;
}

/**
 * Determina el estado académico real y verificable de una materia dentro del
 * Mapa Curricular de 1.º a 6.º año sin inventar historial ni calificaciones.
 */
export function resolveCurriculumNodeStatus(params: {
  gradeYear: number;
  enrolledGradeYear: number | null;
  isSameMencion: boolean;
  isPendingRecovery: boolean;
  historicalPassed: boolean | null;
  currentFinalNumeric: number | null;
  currentFinalLiteral: string | null;
  passingThreshold: number;
}): CurriculumNodeStatus {
  if (params.isPendingRecovery) {
    return "pending_recovery";
  }

  if (!params.isSameMencion || params.enrolledGradeYear === null) {
    return "catalog";
  }

  if (params.gradeYear === params.enrolledGradeYear) {
    return "enrolled";
  }

  if (params.gradeYear < params.enrolledGradeYear) {
    return params.historicalPassed ? "approved" : "prior_stage";
  }

  return "upcoming";
}

/**
 * Ubica la secuencia formativa del pensum a la que pertenece un área de formación
 * para mostrar cómo se articula con el resto del Plan de Estudio.
 */
export function getSubjectProgressionContext(
  mencionCode: string | null,
  subjectCode: string,
  catalogLookup: Map<string, { name: string; gradeYears: number[] }>
): SubjectProgressionContext | null {
  const normalizedMencion = (mencionCode ?? "").trim().toUpperCase();
  const normalizedSubject = subjectCode.trim().toUpperCase();

  const candidates = CURRICULUM_TRACK_DEFINITIONS.filter(
    (def) =>
      (def.mencionCode === normalizedMencion || def.mencionCode === "ALL") &&
      def.codes.includes(normalizedSubject)
  );

  const chosen =
    candidates.find((def) => def.mencionCode === normalizedMencion) ??
    candidates[0] ??
    null;

  if (!chosen) return null;

  const nodes: CurriculumTrackNodeSummary[] = chosen.codes
    .map((code) => {
      const info = catalogLookup.get(code);
      if (!info) return null;
      return {
        subjectCode: code,
        subjectName: info.name,
        gradeYears: [...info.gradeYears].sort((a, b) => a - b),
      };
    })
    .filter((node): node is CurriculumTrackNodeSummary => node !== null);

  const currentIndex = nodes.findIndex(
    (n) => n.subjectCode === normalizedSubject
  );
  if (currentIndex === -1) return null;

  return {
    trackTitle: chosen.title,
    trackDescription: chosen.description,
    nodes,
    currentIndex,
  };
}

/**
 * Etiqueta humana en español para los estados de cada asignatura en la malla.
 */
export function getCurriculumStatusLabel(status: CurriculumNodeStatus): string {
  switch (status) {
    case "enrolled":
      return "Cursando ahora";
    case "approved":
      return "Aprobada";
    case "pending_recovery":
      return "Pendiente por aprobar";
    case "prior_stage":
      return "Etapa cursada";
    case "upcoming":
      return "Próximo año";
    default:
      return "Plan oficial";
  }
}
