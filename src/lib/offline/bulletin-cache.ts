"use client";

import type { SchoolAnnouncementItem } from "@/lib/validators/bulletin";

const DB_NAME = "siga_bulletin_cache_v1";
const DB_VERSION = 1;
const STORE_NAME = "announcements_snapshots";
const MAX_CACHED_ANNOUNCEMENTS = 20;

export interface CachedBulletinSnapshot {
  userId: string;
  savedAt: string;
  items: SchoolAnnouncementItem[];
}

function openBulletinCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("Almacenamiento sin conexión no disponible."));
      return;
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "userId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error("No se pudo abrir la caché de cartelera."));
  });
}

/**
 * Guarda los últimos 20 anuncios en IndexedDB para consulta sin internet.
 */
export async function saveCachedBulletinItems(
  userId: string,
  items: SchoolAnnouncementItem[]
): Promise<void> {
  if (!userId || typeof window === "undefined") return;
  try {
    const db = await openBulletinCacheDb();
    const snapshot: CachedBulletinSnapshot = {
      userId,
      savedAt: new Date().toISOString(),
      items: items.slice(0, MAX_CACHED_ANNOUNCEMENTS),
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(snapshot);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error("Error guardando caché local."));
      };
    });
  } catch {
    // Fallar en silencio si IndexedDB está restringido por modo privado
  }
}

/**
 * Lee el último feed guardado en el navegador para el usuario activo.
 */
export async function loadCachedBulletinItems(
  userId: string
): Promise<CachedBulletinSnapshot | null> {
  if (!userId || typeof window === "undefined") return null;
  try {
    const db = await openBulletinCacheDb();
    return await new Promise<CachedBulletinSnapshot | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(userId);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as CachedBulletinSnapshot | undefined) ?? null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}
