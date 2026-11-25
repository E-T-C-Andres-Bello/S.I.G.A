import {
  MENTION_SUGGESTED_SKILLS,
  type StudentPortfolioDraft,
} from "@/lib/validators/portfolio";

export type CvLevelCode =
  | "borrador"
  | "en_construccion"
  | "listo_pasantias"
  | "tecnico_destacado"
  | "excelencia";

export interface CvDimensionScore {
  id:
    | "identity"
    | "summary"
    | "skills"
    | "projects"
    | "experience_certs"
    | "clarity";
  label: string;
  score: number;
  maxScore: number;
  hint: string;
}

export interface SelectiveCoachSignal {
  id: string;
  sectionKey:
    | "headline"
    | "about"
    | "skills"
    | "projects"
    | "experience"
    | "certifications";
  severity: "high" | "medium";
  shortCue: string;
  whyItMatters: string;
  guidingQuestions: string[];
  focusItemTitle?: string;
  currentBlockText: string;
}

export interface PortfolioEvaluationResult {
  totalScore: number;
  levelCode: CvLevelCode;
  levelLabel: string;
  levelSummary: string;
  nextMilestoneLabel: string | null;
  dimensions: CvDimensionScore[];
  signals: SelectiveCoachSignal[];
  stats: {
    skillsCount: number;
    mentionAlignedSkillsCount: number;
    projectsCount: number;
    experienceCount: number;
    certificationsCount: number;
    customSectionsCount: number;
    languagesCount: number;
  };
}

const GENERIC_CLICHE_PATTERNS = [
  /busco\s+(?:una\s+)?(?:oportunidad|trabajo|empleo)\s+(?:para\s+aprender|donde\s+pueda\s+crecer)/i,
  /persona\s+responsable,?\s+puntual\s+y\s+(?:honesta|proactiva)/i,
  /con\s+ganas\s+de\s+(?:trabajar|superarme|aprender)/i,
  /^estudiante\s+de\s+bachillerato\.?$/i,
  /^mi\s+curr[ií]culum\.?$/i,
];

const ACTION_OR_RESULT_PATTERN =
  /(?:diseñ[eé]|implement[eé]|configur[eé]|desarroll[eé]|organic[eé]|coordin[eé]|calcul[eé]|atend[ií]|mantuv[e]|optimic[eé]|cre[eé]|elabor[eé]|apoy[eé]|gestion[eé]|instal[eé]|planifiqu[eé]|logr[eé]|reduj[e]|\d+\s*(?:%|horas|equipos|estudiantes|personas|rutas|documentos|clientes))/i;

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function resolveMentionBucket(mencionCodeOrName: string | null | undefined): string {
  const norm = normalizeForMatch(mencionCodeOrName ?? "");
  if (norm.includes("telem") || norm.includes("inform")) return "TELEMATICA";
  if (norm.includes("aduan") || norm.includes("comerc")) return "ADUANA";
  if (norm.includes("turis") || norm.includes("hospit")) return "TURISMO";
  return "GENERAL";
}

function countMentionAlignedSkills(
  skills: StudentPortfolioDraft["skills"],
  mencionBucket: string
): number {
  const catalog = MENTION_SUGGESTED_SKILLS[mencionBucket] ?? MENTION_SUGGESTED_SKILLS.GENERAL;
  const catalogKeywords = catalog
    .flatMap((entry) => normalizeForMatch(entry).split(/[\s/,()-]+/))
    .filter((token) => token.length >= 4);

  let matches = 0;
  for (const skill of skills) {
    const normSkill = normalizeForMatch(skill.name);
    if (
      skill.category === "tecnica" ||
      skill.category === "herramienta" ||
      catalogKeywords.some((kw) => normSkill.includes(kw))
    ) {
      matches += 1;
    }
  }
  return matches;
}

/**
 * Motor local determinista (0 ms, 100 % offline):
 * Evalúa la solidez real del Portafolio Técnico y emite ÚNICAMENTE señales
 * pedagógicas de alto impacto (nunca invasivas ni triviales) para que el estudiante
 * aprenda a mejorar su CV paso a paso.
 */
export function evaluateStudentPortfolio(
  draft: StudentPortfolioDraft,
  context: {
    mencionCode?: string | null;
    mencionName?: string | null;
    gradeYear?: number | null;
  }
): PortfolioEvaluationResult {
  const mentionBucket = resolveMentionBucket(
    context.mencionCode || context.mencionName
  );
  const mentionLabel = context.mencionName?.trim() || "tu mención técnica";
  const headline = draft.headline.trim();
  const summary = draft.aboutSummary.trim();
  const signals: SelectiveCoachSignal[] = [];

  // 1. Identidad y Titular (15 pts)
  let identityScore = 0;
  const headlineHasGenericOnly =
    headline.length > 0 &&
    (headline.length < 16 ||
      GENERIC_CLICHE_PATTERNS.some((rx) => rx.test(headline)));

  if (headline.length >= 24 && !headlineHasGenericOnly) {
    identityScore += 11;
  } else if (headline.length >= 12) {
    identityScore += 6;
  } else if (headline.length > 0) {
    identityScore += 2;
  }
  if (draft.contactMeta.city.trim().length >= 4) identityScore += 2;
  if (draft.contactMeta.links.length > 0 || draft.contactMeta.availability.trim().length >= 4) {
    identityScore += 2;
  }

  if (headline.length === 0 || headlineHasGenericOnly) {
    signals.push({
      id: "sig-headline",
      sectionKey: "headline",
      severity: "high",
      shortCue:
        headline.length === 0
          ? "Define un titular profesional claro"
          : "Haz tu titular más específico",
      whyItMatters:
        "El titular es lo primero que lee una empresa en 5 segundos: debe unir tu mención técnica con lo que sabes hacer.",
      guidingQuestions: [
        `¿En qué área de ${mentionLabel} te sientes más fuerte hoy?`,
        "¿Qué tipo de pasantía o actividad práctica te gustaría realizar primero?",
      ],
      currentBlockText: headline || "(Sin titular aún)",
    });
  }

  // 2. Resumen Profesional (20 pts)
  let summaryScore = 0;
  const summaryIsCliche =
    summary.length > 0 && GENERIC_CLICHE_PATTERNS.some((rx) => rx.test(summary));
  const summaryWords = summary ? summary.split(/\s+/).filter(Boolean).length : 0;

  if (summaryWords >= 28 && summaryWords <= 115 && !summaryIsCliche) {
    summaryScore = 20;
  } else if (summaryWords >= 18 && !summaryIsCliche) {
    summaryScore = 14;
  } else if (summaryWords >= 8) {
    summaryScore = 8;
  } else if (summaryWords > 0) {
    summaryScore = 3;
  }

  if (summaryWords < 18 || summaryIsCliche) {
    signals.push({
      id: "sig-about",
      sectionKey: "about",
      severity: "high",
      shortCue: summaryIsCliche
        ? "Evita frases genéricas en tu perfil"
        : "Fortalece tu resumen profesional",
      whyItMatters:
        "Las frases genéricas no te diferencian de otros aspirantes; contar una habilidad concreta y una meta real eleva tu entrevista.",
      guidingQuestions: [
        `¿Qué práctica o materia de ${mentionLabel} disfrutas más y por qué?`,
        "¿Qué aporte concreto puedes llevar a un equipo de trabajo desde el primer mes?",
      ],
      currentBlockText: summary || "(Sin resumen profesional aún)",
    });
  }

  // 3. Habilidades Técnicas y de Mención (20 pts)
  const mentionAlignedSkillsCount = countMentionAlignedSkills(
    draft.skills,
    mentionBucket
  );
  let skillsScore = 0;
  if (draft.skills.length >= 6 && mentionAlignedSkillsCount >= 4) {
    skillsScore = 20;
  } else if (draft.skills.length >= 4 && mentionAlignedSkillsCount >= 2) {
    skillsScore = 15;
  } else if (draft.skills.length >= 2) {
    skillsScore = 9;
  } else if (draft.skills.length === 1) {
    skillsScore = 4;
  }

  if (draft.skills.length < 4 || mentionAlignedSkillsCount < 2) {
    signals.push({
      id: "sig-skills",
      sectionKey: "skills",
      severity: "medium",
      shortCue: "Suma competencias técnicas de tu mención",
      whyItMatters:
        "Los coordinadores de pasantías filtran candidatos buscando herramientas y competencias prácticas específicas de tu especialidad.",
      guidingQuestions: [
        `¿Qué programas, equipos o procedimientos has practicado en clases de ${mentionLabel}?`,
        "¿Cuál de esas habilidades podrías demostrar en una prueba práctica hoy?",
      ],
      currentBlockText:
        draft.skills.map((s) => `${s.name} (${s.level})`).join(", ") ||
        "(Sin habilidades registradas)",
    });
  }

  // 4. Proyectos y Evidencia Práctica (20 pts)
  let projectsScore = 0;
  const projectsWithSubstance = draft.projects.filter(
    (p) =>
      p.summary.trim().length >= 45 &&
      (p.tools.length > 0 || p.impact.trim().length >= 16 || ACTION_OR_RESULT_PATTERN.test(p.summary))
  );

  if (projectsWithSubstance.length >= 2) {
    projectsScore = 20;
  } else if (projectsWithSubstance.length === 1) {
    projectsScore = 14;
  } else if (draft.projects.length >= 1) {
    projectsScore = 8;
  }

  const weakProject = draft.projects.find(
    (p) =>
      p.summary.trim().length < 45 ||
      (p.tools.length === 0 && p.impact.trim().length < 12)
  );

  if (draft.projects.length === 0) {
    signals.push({
      id: "sig-projects-empty",
      sectionKey: "projects",
      severity: "high",
      shortCue: "Agrega al menos un proyecto real",
      whyItMatters:
        "Aunque aún no tengas empleo formal, tus proyectos escolares o socioproductivos (PEST) demuestran lo que sabes construir.",
      guidingQuestions: [
        "¿Cuál ha sido el trabajo práctico o proyecto de clase del que te sientes más orgulloso?",
        "¿Qué problema resolviste y qué herramientas usaste para completarlo?",
      ],
      currentBlockText: "(Sin proyectos agregados)",
    });
  } else if (weakProject) {
    signals.push({
      id: `sig-project-${weakProject.id}`,
      sectionKey: "projects",
      severity: "medium",
      shortCue: "Cuenta qué lograste en este proyecto",
      whyItMatters:
        "Nombrar un proyecto sin explicar tu rol, las herramientas o el resultado deja a la empresa sin saber qué hiciste realmente.",
      guidingQuestions: [
        `En "${weakProject.title}", ¿qué parte específica hiciste tú?`,
        "¿Qué resultado medible o aprendizaje concreto dejó ese proyecto?",
      ],
      focusItemTitle: weakProject.title,
      currentBlockText: `${weakProject.title} — ${weakProject.summary || "(sin descripción)"}`,
    });
  }

  // 5. Experiencia, Certificaciones, Idiomas y Secciones Libres (15 pts)
  let extraScore = 0;
  if (draft.experience.length > 0) extraScore += 5;
  if (draft.certifications.length > 0) extraScore += 4;
  if (draft.languages.length > 0) extraScore += 4;
  if (draft.customSections.some((sec) => sec.items.length > 0)) extraScore += 2;
  extraScore = Math.min(15, extraScore);

  const weakExp = draft.experience.find(
    (exp) =>
      exp.summary.trim().length < 35 && exp.achievements.length === 0
  );
  if (weakExp) {
    signals.push({
      id: `sig-exp-${weakExp.id}`,
      sectionKey: "experience",
      severity: "medium",
      shortCue: "Detalla tus logros en esta experiencia",
      whyItMatters:
        "Agregar 1 o 2 acciones concretas con verbos de impacto convierte una experiencia breve en evidencia profesional.",
      guidingQuestions: [
        `¿Cuál fue tu responsabilidad principal en ${weakExp.organization}?`,
        "¿Hubo algún proceso, evento o tarea que ayudaste a mejorar?",
      ],
      focusItemTitle: `${weakExp.role} · ${weakExp.organization}`,
      currentBlockText: `${weakExp.role} en ${weakExp.organization}: ${weakExp.summary || "(sin detalle)"}`,
    });
  }

  // 6. Claridad, Verbos de Acción y Estructura (10 pts)
  let clarityScore = 2; // base por estructura limpia
  const combinedNarrative = [
    summary,
    ...draft.projects.map((p) => `${p.summary} ${p.impact}`),
    ...draft.experience.map((e) => `${e.summary} ${e.achievements.join(" ")}`),
  ].join(" ");
  if (ACTION_OR_RESULT_PATTERN.test(combinedNarrative)) clarityScore += 4;
  if (summaryWords >= 20 && summaryWords <= 125) clarityScore += 2;
  if (draft.languages.length > 0 && draft.skills.length >= 4) clarityScore += 2;
  clarityScore = Math.min(10, clarityScore);

  const totalScore = Math.min(
    100,
    identityScore +
      summaryScore +
      skillsScore +
      projectsScore +
      extraScore +
      clarityScore
  );

  let levelCode: CvLevelCode = "borrador";
  let levelLabel = "Borrador Inicial";
  let levelSummary =
    "Estás dando los primeros pasos. Completa tu titular, resumen y un proyecto para desbloquear un perfil sólido.";
  let nextMilestoneLabel: string | null = "Llegar a 30 pts (En Construcción)";

  if (totalScore >= 90) {
    levelCode = "excelencia";
    levelLabel = "Nivel Excelencia";
    levelSummary =
      "Tu hoja de vida tiene claridad, evidencia técnica y estructura lista para competir en empresas exigentes.";
    nextMilestoneLabel = null;
  } else if (totalScore >= 75) {
    levelCode = "tecnico_destacado";
    levelLabel = "Técnico Destacado";
    levelSummary =
      "Perfil muy competitivo para pasantías y primer empleo. Pulir métricas o añadir certificaciones te lleva a Excelencia.";
    nextMilestoneLabel = "Llegar a 90 pts (Nivel Excelencia)";
  } else if (totalScore >= 55) {
    levelCode = "listo_pasantias";
    levelLabel = "Listo para Pasantías";
    levelSummary =
      "Ya puedes exportar tu PDF verificable. Sumar impacto concreto en tus proyectos te hará destacar aún más.";
    nextMilestoneLabel = "Llegar a 75 pts (Técnico Destacado)";
  } else if (totalScore >= 30) {
    levelCode = "en_construccion";
    levelLabel = "En Construcción";
    levelSummary =
      "Buen avance. Agrega habilidades de tu mención y detalla al menos un proyecto práctico para alcanzar nivel de pasantía.";
    nextMilestoneLabel = "Llegar a 55 pts (Listo para Pasantías)";
  }

  // Limitar a máximo 3 señales priorizadas (alto impacto primero) para cero invasividad
  const sortedSignals = signals
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1))
    .slice(0, 3);

  return {
    totalScore,
    levelCode,
    levelLabel,
    levelSummary,
    nextMilestoneLabel,
    dimensions: [
      {
        id: "identity",
        label: "Titular e identidad",
        score: identityScore,
        maxScore: 15,
        hint: "Titular claro con mención + ciudad/disponibilidad.",
      },
      {
        id: "summary",
        label: "Resumen profesional",
        score: summaryScore,
        maxScore: 20,
        hint: "30–100 palabras sin clichés, conectando especialidad y meta.",
      },
      {
        id: "skills",
        label: "Habilidades de mención",
        score: skillsScore,
        maxScore: 20,
        hint: "Al menos 6 habilidades con competencias prácticas técnicas.",
      },
      {
        id: "projects",
        label: "Proyectos y evidencia",
        score: projectsScore,
        maxScore: 20,
        hint: "Proyectos con herramientas usadas y resultado real.",
      },
      {
        id: "experience_certs",
        label: "Experiencia, cursos e idiomas",
        score: extraScore,
        maxScore: 15,
        hint: "Prácticas, voluntariado, certificaciones o secciones propias.",
      },
      {
        id: "clarity",
        label: "Impacto y redacción",
        score: clarityScore,
        maxScore: 10,
        hint: "Verbos de acción concretos y datos verificables.",
      },
    ],
    signals: sortedSignals,
    stats: {
      skillsCount: draft.skills.length,
      mentionAlignedSkillsCount,
      projectsCount: draft.projects.length,
      experienceCount: draft.experience.length,
      certificationsCount: draft.certifications.length,
      customSectionsCount: draft.customSections.length,
      languagesCount: draft.languages.length,
    },
  };
}
