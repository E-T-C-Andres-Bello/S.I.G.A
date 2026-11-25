import type { AnnouncementCategory } from "@/lib/validators/bulletin";

export interface BulletinTemplate {
  id: string;
  name: string;
  description: string;
  category: AnnouncementCategory;
  title: string;
  shortNote: string;
  locationLabel: string;
  suggestedGradeYear: number | null;
  isPinned: boolean;
  body: string;
}

export const BULLETIN_TEMPLATES: readonly BulletinTemplate[] = [
  {
    id: "contingencia",
    name: "Aviso urgente / Contingencia",
    description: "Cambios de horario, fallas eléctricas o de agua en Unare II.",
    category: "urgente",
    title: "Aviso importante sobre la jornada escolar de hoy",
    shortNote: "Urgente · Horario de hoy",
    locationLabel: 'Sede Unare II · E.T.C. "Andrés Bello"',
    suggestedGradeYear: null,
    isPinned: true,
    body: [
      "## Información importante para toda la comunidad",
      "",
      "Se informa a estudiantes, docentes y representantes que, por **motivos de contingencia operativa**, se ajusta el horario de salida del turno integral para hoy.",
      "",
      "> ==Hora de salida ajustada: 12:30 PM==. Las actividades académicas pendientes serán reprogramadas por cada docente.",
      "",
      "### Indicaciones clave",
      "- Mantener la calma y seguir las orientaciones del personal de guardia.",
      "- Los alumnos de **6.º año en pasantías** mantienen su jornada habitual en empresa receptora.",
      "- Cualquier actualización será publicada exclusivamente por **La Cartelera Bellista**.",
    ].join("\n"),
  },
  {
    id: "evento",
    name: "Invitación a Evento Escolar",
    description: "Lunes cívicos, aniversario, ferias socioproductivas o cultura.",
    category: "evento",
    title: "Feria Socioproductiva y Encuentro Bellista",
    shortNote: "Feria · Patio Central",
    locationLabel: "Patio Central · Unare II",
    suggestedGradeYear: null,
    isPinned: false,
    body: [
      "## ¡Te invitamos a participar en nuestra jornada especial!",
      "",
      "La **E.T.C. \"Andrés Bello\"** invita a todas las secciones de 1.º a 6.º año a compartir las muestras técnicas de **Telemática**, **Aduana** y **Turismo**.",
      "",
      "### Cronograma sugerido",
      "1. **8:00 AM:** Acto de apertura e Himno Nacional en el Patio Central.",
      "2. **9:00 AM:** Recorrido por los stands de proyectos socioproductivos.",
      "3. **11:30 AM:** Muestras culturales, gastronómicas y reconocimientos.",
      "",
      "> Recuerda asistir con tu __uniforme reglamentario completo__ y tu Carnet Digital S.I.G.A.",
    ].join("\n"),
  },
  {
    id: "academico",
    name: "Cierre de Momento / Boletines",
    description: "Fechas de cierre de lapso, revisiones y entrega de boletines.",
    category: "academico",
    title: "Cronograma de cierre del Momento Pedagógico",
    shortNote: "Cierre de lapso",
    locationLabel: "Control de Estudios y Aulas",
    suggestedGradeYear: null,
    isPinned: true,
    body: [
      "## Fechas oficiales de cierre y entrega de boletines",
      "",
      "Control de Estudios informa a los estudiantes las fechas límite para culminar las evaluaciones del momento en curso:",
      "",
      "- **Último día de evaluaciones:** viernes de la próxima semana.",
      "- **Publicación de notas definitivas:** disponible directamente en tu panel de *Asignaturas*.",
      "- **Revisión de calificaciones:** solicitar mediante la sección *Trámites* dentro de las 48 horas siguientes.",
      "",
      "---",
      "",
      "Para consultar tu promedio proyectado antes del cierre, utiliza el simulador de notas en tu pantalla de inicio.",
    ].join("\n"),
  },
  {
    id: "pasantias",
    name: "Convocatoria de Pasantías (6.º Año)",
    description: "Inducción, entrega de recaudos, empresas de Guayana o defensa.",
    category: "mencion",
    title: "Convocatoria oficial de Práctica Profesional (1440 h)",
    shortNote: "6.º Año · Pasantías",
    locationLabel: "Coordinación de Pasantías · Unare II",
    suggestedGradeYear: 6,
    isPinned: true,
    body: [
      "## Reunión obligatoria de inducción para pasantes de 6.º año",
      "",
      "La **Coordinación de Pasantías** convoca a todos los estudiantes de **6.º año** (*Aduana*, *Turismo* y *Telemática*) a la jornada de orientación previa al inicio de las **1440 horas** en empresas de Ciudad Guayana.",
      "",
      "### Recaudos que debes traer",
      "1. Copia vigente de tu cédula de identidad.",
      "2. Síntesis curricular actualizada (puedes prepararla con tus logros de mención).",
      "3. Confirmación de tu cuenta institucional `@etcandresbello.org` activa.",
      "",
      "> ==Asistencia indispensable== para formalizar las cartas de postulación ante las empresas receptoras.",
    ].join("\n"),
  },
];
