"use client";

export type OfflineMutationKind =
  | "attendance_batch"
  | "grade_entry"
  | "announcement_read";

export interface OfflineAnnouncementReadPayload {
  announcementId: string;
}

export interface OfflineAttendanceBatchPayload {
  teacherAssignmentId: string;
  momentoId: string;
  sessionDate: string;
  blockLabel: string;
  recordedMode: "online" | "offline_pwa" | "qr_scan";
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
  payload:
    | OfflineAttendanceBatchPayload
    | OfflineGradeEntryPayload
    | OfflineAnnouncementReadPayload;
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

export async function enqueueOfflineMutation(params: {
  dedupKey: string;
  kind: OfflineMutationKind;
  payload:
    | OfflineAttendanceBatchPayload
    | OfflineGradeEntryPayload
    | OfflineAnnouncementReadPayload;
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
 * pendientes en IndexedDB contra `/api/offline/sync` (Neon PostgreSQL + RLS).
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

  isFlushingQueue = true;
  let syncedCount = 0;
  let failedCount = 0;

  try {
    const pending = await listQueuedOfflineMutations();
    for (const item of pending) {
      try {
        const res = await fetch("/api/offline/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: item.kind,
            payload: item.payload,
          }),
        });

        if (res.ok) {
          await removeQueuedMutation(item.dedupKey);
          syncedCount += 1;
        } else {
          failedCount += 1;
        }
      } catch {
        failedCount += 1;
      }
    }
  } finally {
    isFlushingQueue = false;
  }

  return { syncedCount, failedCount };
}
