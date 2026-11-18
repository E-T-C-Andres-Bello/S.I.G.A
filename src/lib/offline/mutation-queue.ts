"use client";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export type OfflineMutationKind = "attendance_batch" | "grade_entry";

export interface OfflineAttendanceBatchPayload {
  teacherAssignmentId: string;
  momentoId: string;
  sessionDate: string;
  blockLabel: string;
  recordedMode: "manual" | "qr_scan" | "offline_sync";
  records: Array<{
    enrollment_id: string;
    status: "present" | "absent" | "late" | "justified";
    note?: string;
    client_mutation_id: string;
  }>;
}

export interface OfflineGradeEntryPayload {
  evaluationItemId: string;
  enrollmentId: string;
  numericScore?: number | null;
  literalGrade?: "A" | "B" | "C" | "D" | "E" | null;
  reason?: string;
}

export interface QueuedOfflineMutation {
  clientMutationId: string;
  dedupKey: string;
  kind: OfflineMutationKind;
  payload: OfflineAttendanceBatchPayload | OfflineGradeEntryPayload;
  createdAt: string;
  attempts: number;
  lastError: string | null;
}

const DB_NAME = "siga_offline_queue_v1";
const DB_VERSION = 1;
const STORE_NAME = "pending_mutations";

let isFlushingQueue = false;

function openOfflineQueueDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB no disponible en este entorno."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "dedupKey",
        });
        store.createIndex("by_created_at", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Error al abrir cola IndexedDB."));
  });
}

/**
 * Encola de forma idempotente (sin duplicados por `dedupKey`) una mutación de asistencia
 * o calificación cuando el salón no cuenta con internet o electricidad.
 */
export async function enqueueOfflineMutation(params: {
  dedupKey: string;
  kind: OfflineMutationKind;
  payload: OfflineAttendanceBatchPayload | OfflineGradeEntryPayload;
  clientMutationId?: string;
}): Promise<QueuedOfflineMutation> {
  const db = await openOfflineQueueDb();
  const entry: QueuedOfflineMutation = {
    clientMutationId: params.clientMutationId ?? crypto.randomUUID(),
    dedupKey: params.dedupKey,
    kind: params.kind,
    payload: params.payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(entry);
    tx.oncomplete = () => {
      db.close();
      resolve(entry);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("No se pudo guardar en cola local."));
    };
  });
}

export async function listQueuedOfflineMutations(): Promise<QueuedOfflineMutation[]> {
  const db = await openOfflineQueueDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      db.close();
      const rows = (req.result as QueuedOfflineMutation[]) ?? [];
      rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      resolve(rows);
    };
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error("Error al leer cola local."));
    };
  });
}

async function removeQueuedMutation(dedupKey: string): Promise<void> {
  const db = await openOfflineQueueDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(dedupKey);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Error al limpiar registro sincronizado."));
    };
  });
}

/**
 * Sincroniza en orden cronológico y con bloqueo anti-doble envío todas las mutaciones
 * pendientes en IndexedDB apenas se restablece la conexión a internet.
 */
export async function flushPendingOfflineMutations(): Promise<{
  syncedCount: number;
  failedCount: number;
}> {
  if (
    isFlushingQueue ||
    typeof window === "undefined" ||
    !window.navigator.onLine
  ) {
    return { syncedCount: 0, failedCount: 0 };
  }

  const supabase = getBrowserSupabaseClient();
  if (!supabase) {
    return { syncedCount: 0, failedCount: 0 };
  }

  isFlushingQueue = true;
  let syncedCount = 0;
  let failedCount = 0;

  try {
    const pending = await listQueuedOfflineMutations();
    for (const item of pending) {
      if (item.kind === "attendance_batch") {
        const p = item.payload as OfflineAttendanceBatchPayload;
        const { error } = await supabase.rpc("siga_sync_attendance_batch", {
          p_teacher_assignment_id: p.teacherAssignmentId,
          p_momento_id: p.momentoId,
          p_session_date: p.sessionDate,
          p_block_label: p.blockLabel,
          p_recorded_mode: p.recordedMode,
          p_records: p.records,
        });
        if (!error) {
          await removeQueuedMutation(item.dedupKey);
          syncedCount += 1;
        } else {
          failedCount += 1;
        }
      } else if (item.kind === "grade_entry") {
        const g = item.payload as OfflineGradeEntryPayload;
        const { error } = await supabase.rpc("siga_registrar_nota", {
          p_evaluation_item_id: g.evaluationItemId,
          p_enrollment_id: g.enrollmentId,
          p_numeric_score: g.numericScore ?? undefined,
          p_literal_grade: g.literalGrade ?? undefined,
          p_source: "offline_sync",
          p_reason: g.reason,
        });
        if (!error) {
          await removeQueuedMutation(item.dedupKey);
          syncedCount += 1;
        } else {
          failedCount += 1;
        }
      }
    }
  } finally {
    isFlushingQueue = false;
  }

  return { syncedCount, failedCount };
}
