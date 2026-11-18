export type CurriculumAxisId =
  | "formacion_comun"
  | "identidad_bienestar"
  | "nucleo_tecnico";

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

const IDENTITY_WELLBEING_CODES = new Set(["GHC", "FSN", "EDF", "CRP"]);

const COMMON_AXIS_META: CurriculumAxisMeta = {
  id: "formacion_comun",
  label: "Formación Común MPPE",
  description: "Área científica, humanística y lingüística compartida entre menciones.",
};

const IDENTITY_AXIS_META: CurriculumAxisMeta = {
  id: "identidad_bienestar",
  label: "Ciudadanía y Bienestar",
  description: "Formación ciudadana, socio-productiva, física y cultural.",
};

const TECHNICAL_AXIS_META: CurriculumAxisMeta = {
  id: "nucleo_tecnico",
  label: "Núcleo Técnico de Mención",
  description: "Competencias profesionales orientadas al perfil de Técnico Medio.",
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
    title: "Infraestructura, Redes y Seguridad TI",
    description:
      "Evolución desde ofimática y arquitectura de hardware hasta redes LAN, servidores y pasantías.",
    codes: ["TEL-OFI", "TEL-ARQ", "TEL-RED", "TEL-SEG"],
  },
  {
    mencionCode: "TELEMATICA",
    title: "Lógica, Programación y Bases de Datos",
    description:
      "Construcción progresiva de pensamiento algorítmico, desarrollo web y gestión SQL.",
    codes: ["TEL-OFI", "TEL-ALG", "TEL-BDD", "TEL-SEG"],
  },
  {
    mencionCode: "ADUANAS",
    title: "Comercio Exterior y Valoración Aduanera",
    description:
      "De la iniciación comercial y contable hasta valoración CIF/FOB y regímenes especiales.",
    codes: ["ADU-COM", "ADU-CON", "ADU-VAL", "ADU-REG"],
  },
  {
    mencionCode: "ADUANAS",
    title: "Legislación y Clasificación Arancelaria",
    description:
      "Dominio progresivo de potestad aduanera, Sistema Armonizado y práctica aduanal.",
    codes: ["ADU-COM", "ADU-POT", "ADU-ARA", "ADU-REG"],
  },
  {
    mencionCode: "TURISMO",
    title: "Patrimonio, Guiatura y Ecoturismo",
    description:
      "Recorrido formativo desde la anfitrionía guayanesa hasta la gestión integral de operadoras.",
    codes: ["TUR-PAT", "TUR-SIS", "TUR-GUI", "TUR-ECO"],
  },
  {
    mencionCode: "TURISMO",
    title: "Idiomas Aplicados y Hospitalidad Hotelera",
    description:
      "Atención bilingüe, recepción hotelera, protocolo y dirección de eventos.",
    codes: ["TUR-SIS", "TUR-ING", "TUR-HOT", "TUR-ECO"],
  },
  {
    mencionCode: "ALL",
    title: "Eje Científico y Cuantitativo MPPE",
    description: "Soporte lógico-matemático y ciencias aplicadas de 1.º a 5.º año.",
    codes: ["CNAT", "MAT", "FIS", "QUI"],
  },
  {
    mencionCode: "ALL",
    title: "Comunicación e Idiomas",
    description: "Comprensión lectora, redacción técnica e inglés técnico transversal.",
    codes: ["CAS", "ING"],
  },
  {
    mencionCode: "ALL",
    title: "Ciudadanía, Soberanía y Desarrollo Integral",
    description: "Formación ciudadana, actividad física y grupos socioproductivos (CRP).",
    codes: ["GHC", "FSN", "EDF", "CRP"],
  },
];

/**
 * Clasifica una asignatura oficial MPPE dentro de su eje formativo institucional.
 */
export function classifyCurriculumAxis(
  subjectCode: string,
  isTechnicalCore: boolean
): CurriculumAxisMeta {
  if (isTechnicalCore) {
    return TECHNICAL_AXIS_META;
  }
  if (IDENTITY_WELLBEING_CODES.has(subjectCode.trim().toUpperCase())) {
    return IDENTITY_AXIS_META;
  }
  return COMMON_AXIS_META;
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
 * Ubica la secuencia formativa del pensum a la que pertenece una asignatura
 * para mostrar de dónde proviene y hacia qué materias futuras progresa.
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
