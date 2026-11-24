"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  HeartHandshake,
  Loader2,
  Save,
  Send,
  ShieldCheck,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  reportTeacherAbsenceAction,
  saveAttendanceSessionAction,
  saveClassDiaryAction,
} from "../docente-actions";
import {
  ATTENDANCE_STATUS_LABELS,
  type AttendanceRecordStatus,
  type ClassDiaryEntryDto,
  type MomentoOption,
  type SectionStudentItem,
  type TeacherAbsenceDto,
  type TeacherSectionAssignment,
} from "../types";

interface Props {
  assignments: TeacherSectionAssignment[];
  momentos: MomentoOption[];
  initialStudents: SectionStudentItem[];
  initialDiary: ClassDiaryEntryDto[];
  initialAbsences: TeacherAbsenceDto[];
  todayIso: string;
}

const SCHEDULE_BLOCKS = [
  "Bloque 1-2 (7:00 AM – 8:30 AM)",
  "Bloque 3-4 (8:40 AM – 10:10 AM)",
  "Bloque 5-6 (10:20 AM – 11:50 AM)",
  "Bloque 7-8 (12:30 PM – 2:00 PM)",
  "Bloque 9-10 (2:00 PM – 3:30 PM)",
];

export function DocenteAsistenciaView({
  assignments,
  momentos,
  initialStudents,
  initialDiary,
  initialAbsences,
  todayIso,
}: Props) {
  const [activeTab, setActiveTab] = React.useState<"asistencia" | "diario" | "inasistencia">("asistencia");

  const [selectedAssignmentId, setSelectedAssignmentId] = React.useState<string>(
    assignments[0]?.assignmentId ?? ""
  );

  const [selectedMomentoId, setSelectedMomentoId] = React.useState<string>(
    momentos[0]?.id ?? ""
  );

  const [sessionDate, setSessionDate] = React.useState(todayIso);
  const [selectedBlock, setSelectedBlock] = React.useState(SCHEDULE_BLOCKS[0] ?? "Bloque 1");
  const [students, setStudents] = React.useState<SectionStudentItem[]>(initialStudents);
  const [savingAttendance, setSavingAttendance] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Estados del Diario de Clases
  const [diaryDate, setDiaryDate] = React.useState(todayIso);
  const [topicCovered, setTopicCovered] = React.useState("");
  const [classroomIncidents, setClassroomIncidents] = React.useState("");
  const [deriveToOrientation, setDeriveToOrientation] = React.useState(false);
  const [diaryList, setDiaryList] = React.useState<ClassDiaryEntryDto[]>(initialDiary);
  const [savingDiary, setSavingDiary] = React.useState(false);

  // Estados de Inasistencia Docente
  const [absenceDate, setAbsenceDate] = React.useState(todayIso);
  const [absenceCategory, setAbsenceCategory] = React.useState<"medical" | "personal" | "institutional">("personal");
  const [absenceObservation, setAbsenceObservation] = React.useState("");
  const [absenceBlocks, setAbsenceBlocks] = React.useState<string[]>([SCHEDULE_BLOCKS[0] ?? "Bloque 1-2"]);
  const [absencesList, setAbsencesList] = React.useState<TeacherAbsenceDto[]>(initialAbsences);
  const [savingAbsence, setSavingAbsence] = React.useState(false);

  const currentAssignment = React.useMemo(
    () => assignments.find((a) => a.assignmentId === selectedAssignmentId),
    [assignments, selectedAssignmentId]
  );

  // Resumen de asistencia
  const stats = React.useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let justified = 0;

    for (const s of students) {
      if (s.status === "present") present++;
      else if (s.status === "absent") absent++;
      else if (s.status === "late") late++;
      else if (s.status === "justified") justified++;
    }

    return { total: students.length, present, absent, late, justified };
  }, [students]);

  const handleSetAllStatus = (status: AttendanceRecordStatus) => {
    setStudents((prev) => prev.map((s) => ({ ...s, status })));
  };

  const handleUpdateStudentStatus = (enrollmentId: string, status: AttendanceRecordStatus) => {
    setStudents((prev) =>
      prev.map((s) => (s.enrollmentId === enrollmentId ? { ...s, status } : s))
    );
  };

  const handleSaveAttendance = async () => {
    if (!selectedAssignmentId || !selectedMomentoId) return;
    setSavingAttendance(true);
    setFeedback(null);

    const res = await saveAttendanceSessionAction({
      teacherAssignmentId: selectedAssignmentId,
      momentoId: selectedMomentoId,
      sessionDate,
      blockLabel: selectedBlock,
      recordedMode: "online",
      records: students.map((s) => ({
        enrollmentId: s.enrollmentId,
        status: s.status,
        note: s.note ?? null,
      })),
    });

    setSavingAttendance(false);
    if (res.success) {
      setFeedback({ type: "success", text: res.message });
    } else {
      setFeedback({ type: "error", text: res.message });
    }
  };

  const handleSaveDiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicCovered.trim()) {
      setFeedback({ type: "error", text: "El tema dictado es obligatorio." });
      return;
    }

    setSavingDiary(true);
    setFeedback(null);

    const res = await saveClassDiaryAction({
      teacherAssignmentId: selectedAssignmentId,
      entryDate: diaryDate,
      topicCovered: topicCovered.trim(),
      classroomIncidents: classroomIncidents.trim() || undefined,
      deriveToOrientation,
    });

    setSavingDiary(false);
    if (res.success) {
      setFeedback({ type: "success", text: res.message });
      setDiaryList((prev) => [
        {
          id: crypto.randomUUID(),
          teacherAssignmentId: selectedAssignmentId,
          entryDate: diaryDate,
          topicCovered: topicCovered.trim(),
          classroomIncidents: classroomIncidents.trim() || null,
          deriveToOrientation,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setTopicCovered("");
      setClassroomIncidents("");
      setDeriveToOrientation(false);
    } else {
      setFeedback({ type: "error", text: res.message });
    }
  };

  const handleReportAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (absenceBlocks.length === 0) {
      setFeedback({ type: "error", text: "Selecciona al menos un bloque horario afectado." });
      return;
    }

    setSavingAbsence(true);
    setFeedback(null);

    const res = await reportTeacherAbsenceAction({
      absenceDate,
      reasonCategory: absenceCategory,
      observation: absenceObservation.trim() || undefined,
      affectedBlocks: absenceBlocks,
    });

    setSavingAbsence(false);
    if (res.success) {
      setFeedback({ type: "success", text: res.message });
      setAbsencesList((prev) => [
        {
          id: crypto.randomUUID(),
          absenceDate,
          reasonCategory: absenceCategory,
          observation: absenceObservation.trim() || null,
          affectedBlocks: absenceBlocks,
          status: "reported",
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setAbsenceObservation("");
    } else {
      setFeedback({ type: "error", text: res.message });
    }
  };

  const toggleBlock = (block: string) => {
    setAbsenceBlocks((prev) =>
      prev.includes(block) ? prev.filter((b) => b !== block) : [...prev, block]
    );
  };

  if (assignments.length === 0) {
    return (
      <div className="siga-glass-surface rounded-[28px] border p-8 text-center">
        <Users className="mx-auto size-12 text-muted-foreground opacity-60" />
        <h2 className="mt-4 text-xl font-medium text-foreground">
          Sin asignaciones académicas vigentes
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Actualmente no tienes secciones asignadas en el año escolar activo.
        </p>
      </div>
    );
  }

  return (
    <div className="font-hero flex flex-col gap-6 pb-12">
      {/* Encabezado */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <span className="siga-glass-pill inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-primary">
            <CalendarDays className="size-3.5" />
            Módulo 2.2 · Control de Aula y Convivencia
          </span>
          <h1 className="mt-2 text-2xl font-normal tracking-tight text-foreground sm:text-3xl">
            Asistencia, Diario de Clases y Reportes
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Pase de lista diario por bloque, registro pedagógico de contenidos y derivación confidencial a Orientación.
          </p>
        </div>

        {/* Pestañas de Navegación del Módulo */}
        <div className="siga-glass-inner flex rounded-full border p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setActiveTab("asistencia");
              setFeedback(null);
            }}
            className={cn(
              "rounded-full px-3.5 py-1.5 transition-all",
              activeTab === "asistencia"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Pase de Asistencia
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("diario");
              setFeedback(null);
            }}
            className={cn(
              "rounded-full px-3.5 py-1.5 transition-all",
              activeTab === "diario"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Diario de Clases
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("inasistencia");
              setFeedback(null);
            }}
            className={cn(
              "rounded-full px-3.5 py-1.5 transition-all",
              activeTab === "inasistencia"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Aviso de Inasistencia
          </button>
        </div>
      </div>

      {/* Alertas de Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-4 text-xs font-medium sm:text-sm",
              feedback.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : "border-destructive/30 bg-destructive/10 text-destructive dark:text-rose-300"
            )}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <AlertCircle className="size-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selectores de Contexto de Aula */}
      <div className="siga-glass-surface grid grid-cols-1 gap-4 rounded-[24px] border p-5 sm:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <label className="block text-xs font-medium text-muted-foreground">
            Asignatura y Sección
          </label>
          <div className="mt-2">
            <Select
              value={selectedAssignmentId}
              onValueChange={(val) => setSelectedAssignmentId(val)}
            >
              <SelectTrigger className="w-full rounded-xl border bg-background/50">
                <SelectValue placeholder="Seleccionar asignatura..." />
              </SelectTrigger>
              <SelectContent>
                {assignments.map((a) => (
                  <SelectItem key={a.assignmentId} value={a.assignmentId}>
                    <span className="font-medium text-foreground">{a.subjectName}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({a.sectionFullName})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="lg:col-span-4">
          <label className="block text-xs font-medium text-muted-foreground">
            Bloque Horario
          </label>
          <div className="mt-2">
            <Select
              value={selectedBlock}
              onValueChange={(val) => setSelectedBlock(val)}
            >
              <SelectTrigger className="w-full rounded-xl border bg-background/50">
                <SelectValue placeholder="Seleccionar bloque..." />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_BLOCKS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="lg:col-span-3">
          <label className="block text-xs font-medium text-muted-foreground">Fecha de Sesión</label>
          <input
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            className="mt-2 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* CONTENIDO DE PESTAÑA 1: PASE DE ASISTENCIA */}
      {activeTab === "asistencia" && (
        <div className="flex flex-col gap-5">
          {/* Tarjetas Resumen */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="siga-glass-inner flex flex-col justify-between rounded-2xl border p-3.5">
              <span className="text-[11px] font-medium text-muted-foreground">Matrícula</span>
              <p className="font-mono text-2xl font-bold text-foreground">{stats.total}</p>
            </div>
            <div className="siga-glass-inner flex flex-col justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-emerald-800 dark:text-emerald-200">
              <span className="text-[11px] font-medium">Presentes</span>
              <p className="font-mono text-2xl font-bold">{stats.present}</p>
            </div>
            <div className="siga-glass-inner flex flex-col justify-between rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-rose-800 dark:text-rose-200">
              <span className="text-[11px] font-medium">Ausentes</span>
              <p className="font-mono text-2xl font-bold">{stats.absent}</p>
            </div>
            <div className="siga-glass-inner flex flex-col justify-between rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-800 dark:text-amber-200">
              <span className="text-[11px] font-medium">Tardanzas</span>
              <p className="font-mono text-2xl font-bold">{stats.late}</p>
            </div>
            <div className="siga-glass-inner flex flex-col justify-between rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3.5 text-sky-800 dark:text-sky-200">
              <span className="text-[11px] font-medium">Justificadas</span>
              <p className="font-mono text-2xl font-bold">{stats.justified}</p>
            </div>
          </div>

          {/* Barra de Acciones de Lista */}
          <div className="siga-glass-surface flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSetAllStatus("present")}
                className="rounded-full text-xs text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
              >
                <Check className="size-3.5" />
                Marcar todos Presentes
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSetAllStatus("absent")}
                className="rounded-full text-xs text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
              >
                <UserX className="size-3.5" />
                Todos Ausentes
              </Button>
            </div>

            <Button
              type="button"
              disabled={savingAttendance || students.length === 0}
              onClick={handleSaveAttendance}
              className="rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              {savingAttendance ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Guardar Asistencia de Clase
            </Button>
          </div>

          {/* Nómina de Alumnos */}
          <div className="siga-glass-surface overflow-hidden rounded-[24px] border">
            {students.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No hay estudiantes matriculados en esta sección.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {students.map((student, idx) => (
                  <div
                    key={student.enrollmentId}
                    className="flex flex-col justify-between gap-3 p-4 transition-colors hover:bg-accent/30 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {student.lastName}, {student.firstName}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{student.cedula}</p>
                      </div>
                    </div>

                    {/* Botonera Rápida de Estados */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleUpdateStudentStatus(student.enrollmentId, "present")}
                        title="Presente"
                        className={cn(
                          "rounded-lg px-3 py-1 text-xs font-semibold transition-all",
                          student.status === "present"
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-background/80 text-muted-foreground hover:bg-accent"
                        )}
                      >
                        Presente
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStudentStatus(student.enrollmentId, "absent")}
                        title="Ausente"
                        className={cn(
                          "rounded-lg px-3 py-1 text-xs font-semibold transition-all",
                          student.status === "absent"
                            ? "bg-rose-600 text-white shadow-xs"
                            : "bg-background/80 text-muted-foreground hover:bg-accent"
                        )}
                      >
                        Ausente
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStudentStatus(student.enrollmentId, "late")}
                        title="Tardanza"
                        className={cn(
                          "rounded-lg px-3 py-1 text-xs font-semibold transition-all",
                          student.status === "late"
                            ? "bg-amber-600 text-white shadow-xs"
                            : "bg-background/80 text-muted-foreground hover:bg-accent"
                        )}
                      >
                        Tardanza
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStudentStatus(student.enrollmentId, "justified")}
                        title="Justificada"
                        className={cn(
                          "rounded-lg px-3 py-1 text-xs font-semibold transition-all",
                          student.status === "justified"
                            ? "bg-sky-600 text-white shadow-xs"
                            : "bg-background/80 text-muted-foreground hover:bg-accent"
                        )}
                      >
                        Justificada
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTENIDO DE PESTAÑA 2: DIARIO DE CLASES */}
      {activeTab === "diario" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Formulario de Anotación */}
          <div className="siga-glass-surface rounded-[24px] border p-6 lg:col-span-7">
            <h3 className="text-base font-semibold text-foreground">
              Nueva Entrada en el Diario Pedagógico
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Registra los temas dictados e incidencias relevantes de la sesión de clase.
            </p>

            <form onSubmit={handleSaveDiary} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  Fecha de la Clase
                </label>
                <input
                  type="date"
                  value={diaryDate}
                  onChange={(e) => setDiaryDate(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  Tema o Contenido Desarrollado *
                </label>
                <textarea
                  rows={3}
                  value={topicCovered}
                  onChange={(e) => setTopicCovered(e.target.value)}
                  placeholder="Ej. Introducción a modelos TCP/IP y cableado directo según norma T568B..."
                  className="mt-1.5 w-full rounded-xl border border-input bg-background/50 p-3 text-xs text-foreground outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  Incidencias de Convivencia o Rezago (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={classroomIncidents}
                  onChange={(e) => setClassroomIncidents(e.target.value)}
                  placeholder="Anotaciones breves sobre conducta, dificultad de aprendizaje o acuerdos de aula..."
                  className="mt-1.5 w-full rounded-xl border border-input bg-background/50 p-3 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              {/* Casilla de Derivación a Orientación */}
              <div className="siga-glass-inner flex items-start gap-3 rounded-2xl border p-3.5">
                <input
                  type="checkbox"
                  id="deriveOrientation"
                  checked={deriveToOrientation}
                  onChange={(e) => setDeriveToOrientation(e.target.checked)}
                  className="mt-1 size-4 rounded text-primary focus:ring-primary"
                />
                <label htmlFor="deriveOrientation" className="text-xs">
                  <span className="font-semibold text-foreground">
                    Derivar caso a Orientación y Bienestar Estudiantil
                  </span>
                  <p className="mt-0.5 text-muted-foreground">
                    Al marcar esta opción, el departamento de Orientación recibirá una alerta
                    confidencial para citación o acompañamiento sin exponer notas al resto de la sección.
                  </p>
                </label>
              </div>

              <Button
                type="submit"
                disabled={savingDiary}
                className="w-full rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                {savingDiary ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                Registrar en Diario de Clases
              </Button>
            </form>
          </div>

          {/* Historial de Entradas */}
          <div className="siga-glass-surface rounded-[24px] border p-6 lg:col-span-5">
            <h3 className="text-base font-semibold text-foreground">Historial de Temas Dictados</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Últimas bitácoras registradas para esta asignatura.
            </p>

            <div className="mt-4 max-h-[460px] space-y-3 overflow-y-auto">
              {diaryList.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Aún no hay temas registrados en el diario para esta materia.
                </div>
              ) : (
                diaryList.map((entry) => (
                  <div
                    key={entry.id}
                    className="siga-glass-inner rounded-xl border p-3.5 text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{entry.entryDate}</span>
                      {entry.deriveToOrientation && (
                        <span className="rounded-full bg-rose-500/15 px-2 py-0.5 font-semibold text-rose-700 dark:text-rose-300">
                          Derivado a Orientación
                        </span>
                      )}
                    </div>
                    <p className="mt-2 font-medium text-foreground">{entry.topicCovered}</p>
                    {entry.classroomIncidents && (
                      <p className="mt-1.5 text-muted-foreground italic">
                        Incidencia: {entry.classroomIncidents}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO DE PESTAÑA 3: AVISO DE INASISTENCIA DOCENTE */}
      {activeTab === "inasistencia" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Formulario de Reporte */}
          <div className="siga-glass-surface rounded-[24px] border p-6 lg:col-span-7">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              <h3 className="text-base font-semibold text-foreground">
                Notificación Anticipada de Inasistencia Docente
              </h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Permite a Coordinación y Dirección reorganizar los bloques horarios del plantel con anticipación.
            </p>

            <form onSubmit={handleReportAbsence} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  Fecha de la Inasistencia
                </label>
                <input
                  type="date"
                  value={absenceDate}
                  onChange={(e) => setAbsenceDate(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  Motivo de la Ausencia
                </label>
                <div className="mt-1.5 flex gap-2">
                  {[
                    { id: "personal", label: "Causa Personal" },
                    { id: "medical", label: "Causa Médica" },
                    { id: "institutional", label: "Comisión Institucional" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setAbsenceCategory(cat.id as typeof absenceCategory)}
                      className={cn(
                        "rounded-xl px-3 py-1.5 text-xs font-medium transition-all",
                        absenceCategory === cat.id
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "border border-input bg-background/50 text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  Bloques Horarios Afectados *
                </label>
                <div className="mt-2 space-y-1.5">
                  {SCHEDULE_BLOCKS.map((block) => (
                    <label
                      key={block}
                      className="siga-glass-inner flex cursor-pointer items-center gap-2.5 rounded-xl border p-2 text-xs text-foreground"
                    >
                      <input
                        type="checkbox"
                        checked={absenceBlocks.includes(block)}
                        onChange={() => toggleBlock(block)}
                        className="size-3.5 rounded text-primary focus:ring-primary"
                      />
                      <span>{block}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  Observación o Justificación Adicional (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={absenceObservation}
                  onChange={(e) => setAbsenceObservation(e.target.value)}
                  placeholder="Detalles sobre asignación de guía de refuerzo o actividad asíncrona..."
                  className="mt-1.5 w-full rounded-xl border border-input bg-background/50 p-3 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              <Button
                type="submit"
                disabled={savingAbsence}
                className="w-full rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                {savingAbsence ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                Enviar Notificación a Coordinación
              </Button>
            </form>
          </div>

          {/* Historial de Avisos */}
          <div className="siga-glass-surface rounded-[24px] border p-6 lg:col-span-5">
            <h3 className="text-base font-semibold text-foreground">Avisos Enviados</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Registro histórico de tus inasistencias reportadas.
            </p>

            <div className="mt-4 max-h-[460px] space-y-3 overflow-y-auto">
              {absencesList.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No tienes ausencias reportadas en el período.
                </div>
              ) : (
                absencesList.map((item) => (
                  <div
                    key={item.id}
                    className="siga-glass-inner rounded-xl border p-3.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{item.absenceDate}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          item.status === "reorganized"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        )}
                      >
                        {item.status === "reorganized" ? "Reorganizado" : "Reportado"}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground capitalize">
                      Motivo: {item.reasonCategory}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.affectedBlocks.map((b, i) => (
                        <span
                          key={i}
                          className="rounded-md bg-accent/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
