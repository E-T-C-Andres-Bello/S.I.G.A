#!/usr/bin/env node
/**
 * S.I.G.A. — Neon PostgreSQL Migration & Seed Runner
 * Comandos:
 *   npm run db:migrate  -> Ejecuta bootstrap Neon + migraciones SQL pendientes en orden
 *   npm run db:status   -> Muestra estado de conexión y migraciones aplicadas/pendientes
 *   npm run db:seed     -> Aplica catálogos base estructurales (sin PII) de forma idempotente
 *   node scripts/db/neon-migrate.mjs --self-test -> Valida transformaciones sin tocar la red
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Client } = pg;

const ROOT_DIR = process.cwd();
const BOOTSTRAP_PATH = path.join(ROOT_DIR, "neon", "bootstrap", "00000_neon_bootstrap.sql");
const MIGRATIONS_DIR = path.join(ROOT_DIR, "neon", "migrations");
const BASE_SEED_PATH = path.join(ROOT_DIR, "neon", "seed", "catalogos_base.sql");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) || !process.env[key]) {
      process.env[key] = value;
    }
  }
}

function getConnectionString() {
  loadEnvFile(path.join(ROOT_DIR, ".env.local"));
  loadEnvFile(path.join(ROOT_DIR, ".env"));

  const directUrl =
    process.env.DIRECT_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim();
  const pooledUrl = process.env.DATABASE_URL?.trim();

  if (directUrl) {
    return {
      url: directUrl,
      source: process.env.DIRECT_DATABASE_URL?.trim()
        ? "DIRECT_DATABASE_URL"
        : "DATABASE_URL_UNPOOLED",
    };
  }
  if (pooledUrl) {
    console.warn(
      "[neon-db] Aviso: DIRECT_DATABASE_URL no está definida; usando DATABASE_URL como respaldo. " +
        "Para migraciones DDL en Neon se recomienda configurar la cadena directa (sin -pooler)."
    );
    return { url: pooledUrl, source: "DATABASE_URL" };
  }

  console.error(
    "[neon-db] Error: falta configurar DIRECT_DATABASE_URL (o DATABASE_URL) en .env.local.\n" +
      "Copia la cadena de conexión desde https://console.neon.tech -> Connection Details."
  );
  process.exit(1);
}

/**
 * Adapta de forma determinista y mínima las 3 construcciones exclusivas de Supabase
 * presentes en migraciones históricas para que corran limpiamente en Neon PostgreSQL 17.
 */
function adaptSqlForNeon(filename, rawSql) {
  let sql = rawSql;
  const notes = [];

  // 1. En Neon, `auth.users` vive en el proveedor de autenticación externo (no como tabla local).
  if (/REFERENCES\s+auth\.users\s*\(\s*id\s*\)\s+ON\s+DELETE\s+SET\s+NULL/i.test(sql)) {
    sql = sql.replace(
      /\s+REFERENCES\s+auth\.users\s*\(\s*id\s*\)\s+ON\s+DELETE\s+SET\s+NULL/gi,
      ""
    );
    notes.push("desacoplado FK externo auth.users(id)");
  }

  // 2. Neon no instala la extensión `pg_net` ni `vault`; los workflows se despachan desde Next.js.
  if (/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pg_net\s*;/i.test(sql)) {
    sql = sql.replace(
      /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pg_net\s*;/gi,
      "-- [Neon] pg_net omitida: los webhooks de workflow se disparan desde el servidor Next.js."
    );
    notes.push("omitida extensión pg_net");
  }

  if (filename === "00005_workflows_student_request_mailtrap.sql") {
    const vaultBlockPattern =
      /-- Nunca bloquear la creación de trámites si Vault o pg_net fallan[\s\S]*?EXCEPTION WHEN OTHERS THEN[\s\S]*?END;/;
    if (vaultBlockPattern.test(sql)) {
      sql = sql.replace(
        vaultBlockPattern,
        `-- [Neon] El registro queda encolado en workflows.workflow_runs para despacho desde Next.js.
  UPDATE workflows.workflow_runs
     SET result_json = jsonb_build_object('reason', 'queued_for_app_server_dispatch')
   WHERE id = v_run_id;`
      );
      notes.push("trigger de workflow adaptado sin vault/pg_net");
    }
  }

  // 3. `storage.objects` y `storage.buckets` pertenecen al motor de Supabase Storage.
  if (/ON\s+storage\.objects/i.test(sql)) {
    sql = sql.replace(
      /-- 4\. POLÍTICAS RLS EN STORAGE[\s\S]*?(?=-- Recargar caché de esquema|$)/i,
      "-- [Neon] Políticas de storage.objects omitidas (el almacenamiento de archivos vive fuera de Neon).\n\n"
    );
    notes.push("omitidas políticas storage.objects");
  }

  if (/INSERT\s+INTO\s+storage\.buckets/i.test(sql)) {
    sql = sql.replace(
      /-- Bucket institucional[\s\S]*?INSERT\s+INTO\s+storage\.buckets[\s\S]*?;/i,
      "-- [Neon] Creación de bucket storage.buckets omitida (gestionada en el proveedor de Storage)."
    );
    notes.push("omitido INSERT en storage.buckets");
  }

  // 4. Proteger ALTER PUBLICATION supabase_realtime si la publicación no existe en Neon.
  if (
    /ALTER\s+PUBLICATION\s+supabase_realtime/i.test(sql) &&
    !/FROM\s+pg_publication\s+WHERE\s+pubname\s*=\s*'supabase_realtime'/i.test(sql)
  ) {
    sql = sql.replace(
      /IF\s+NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+pg_publication_tables/gi,
      "IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AND NOT EXISTS (SELECT 1 FROM pg_publication_tables"
    );
    notes.push("resguardada publicación supabase_realtime");
  }

  return { sql, notes };
}

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`No se encontró el directorio de migraciones: ${MIGRATIONS_DIR}`);
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.*\.sql$/i.test(f))
    .sort((a, b) => a.localeCompare(b));
}

function runSelfTest() {
  const bootstrapSql = fs.readFileSync(BOOTSTRAP_PATH, "utf8");
  if (!bootstrapSql.includes("CREATE OR REPLACE FUNCTION auth.uid()")) {
    throw new Error("Bootstrap SQL no define auth.uid()");
  }

  const files = listMigrationFiles();
  if (files.length === 0) {
    throw new Error("No se encontraron migraciones SQL.");
  }

  for (const file of files) {
    const raw = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const { sql, notes } = adaptSqlForNeon(file, raw);
    if (!sql.trim()) throw new Error(`Migración vacía tras adaptación: ${file}`);
    if (/REFERENCES\s+auth\.users/i.test(sql)) {
      throw new Error(`Quedó referencia auth.users sin adaptar en ${file}`);
    }
    if (/CREATE\s+EXTENSION.*pg_net/i.test(sql)) {
      throw new Error(`Quedó pg_net sin adaptar en ${file}`);
    }
    if (/ON\s+storage\.objects/i.test(sql)) {
      throw new Error(`Quedó storage.objects sin adaptar en ${file}`);
    }
    if (/FROM\s+vault\.decrypted_secrets/i.test(sql)) {
      throw new Error(`Quedó vault.decrypted_secrets sin adaptar en ${file}`);
    }
    const suffix = notes.length > 0 ? ` (${notes.join(", ")})` : "";
    console.log(`  [OK] ${file}${suffix}`);
  }

  const seedRaw = fs.readFileSync(BASE_SEED_PATH, "utf8");
  const { sql: seedSql, notes: seedNotes } = adaptSqlForNeon("catalogos_base.sql", seedRaw);
  if (/INSERT\s+INTO\s+storage\.buckets/i.test(seedSql)) {
    throw new Error("Quedó storage.buckets sin adaptar en catalogos_base.sql");
  }
  console.log(`  [OK] catalogos_base.sql (${seedNotes.join(", ") || "sin cambios"})`);
  console.log(`\n[neon-db] Self-test aprobado: ${files.length} migraciones + seed base listos para Neon.`);
}

function normalizeNeonSslUrl(rawUrl) {
  if (rawUrl.includes("localhost") || rawUrl.includes("127.0.0.1")) {
    return rawUrl;
  }
  return rawUrl.replace(/([?&])sslmode=require(?=&|$)/i, "$1sslmode=verify-full");
}

async function createConnectedClient() {
  const { url, source } = getConnectionString();
  const normalizedUrl = normalizeNeonSslUrl(url);
  const client = new Client({
    connectionString: normalizedUrl,
    ssl: normalizedUrl.includes("localhost") || normalizedUrl.includes("127.0.0.1") ? false : { rejectUnauthorized: true },
  });
  await client.connect();
  return { client, source };
}

async function ensureBootstrap(client) {
  const bootstrapSql = fs.readFileSync(BOOTSTRAP_PATH, "utf8");
  await client.query(bootstrapSql);
}

async function runMigrate() {
  const { client, source } = await createConnectedClient();
  try {
    const { rows: verRows } = await client.query("SELECT version(), current_database(), current_user");
    console.log(
      `[neon-db] Conectado vía ${source} -> DB: ${verRows[0].current_database} | Usuario: ${verRows[0].current_user}`
    );

    console.log("[neon-db] Aplicando bootstrap Neon (roles RLS, auth.uid(), schema_migrations)...");
    await ensureBootstrap(client);

    const { rows: appliedRows } = await client.query(
      "SELECT version, checksum FROM siga_internal.schema_migrations ORDER BY version"
    );
    const appliedMap = new Map(appliedRows.map((r) => [r.version, r.checksum]));

    const files = listMigrationFiles();
    let appliedCount = 0;

    for (const file of files) {
      const raw = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      const { sql, notes } = adaptSqlForNeon(file, raw);
      const checksum = sha256(sql);

      if (appliedMap.has(file)) {
        if (appliedMap.get(file) !== checksum) {
          console.warn(
            `[neon-db] Aviso: ${file} ya fue aplicada con otro checksum (migración histórica modificada). Se omite.`
          );
        }
        continue;
      }

      const noteText = notes.length > 0 ? ` [${notes.join("; ")}]` : "";
      console.log(`[neon-db] Aplicando ${file}${noteText}...`);

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO siga_internal.schema_migrations (version, checksum) VALUES ($1, $2)",
          [file, checksum]
        );
        await client.query("COMMIT");
        appliedCount += 1;
        console.log(`  ✓ ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`  ✗ Error aplicando ${file}:`, err.message);
        throw err;
      }
    }

    console.log(
      appliedCount === 0
        ? "[neon-db] Base de datos al día (0 migraciones pendientes)."
        : `[neon-db] Migración completada: ${appliedCount} archivo(s) aplicado(s) en Neon.`
    );
  } finally {
    await client.end();
  }
}

async function runStatus() {
  const { client, source } = await createConnectedClient();
  try {
    const { rows: verRows } = await client.query("SELECT version(), current_database(), current_user");
    console.log(
      `[neon-db] Conectado vía ${source} -> DB: ${verRows[0].current_database} | Usuario: ${verRows[0].current_user}`
    );
    console.log(`[neon-db] Motor: ${verRows[0].version.split(",")[0]}`);

    const { rows: tableCheck } = await client.query(
      "SELECT to_regclass('siga_internal.schema_migrations') AS tbl"
    );

    const appliedSet = new Set();
    if (tableCheck[0]?.tbl) {
      const { rows } = await client.query(
        "SELECT version, applied_at FROM siga_internal.schema_migrations ORDER BY version"
      );
      for (const r of rows) appliedSet.add(r.version);
    }

    const files = listMigrationFiles();
    const localSet = new Set(files);
    const remoteOnly = [...appliedSet].filter((v) => !localSet.has(v));

    console.log("\nEstado de migraciones:");
    for (const file of files) {
      const state = appliedSet.has(file) ? "APLICADA " : "PENDIENTE";
      console.log(`  [${state}] ${file}`);
    }
    for (const remoteFile of remoteOnly) {
      console.log(
        `  [SOLO NEON] ${remoteFile}  (falta en tu carpeta local — haz git pull)`
      );
    }

    const pending = files.filter((f) => !appliedSet.has(f)).length;
    const summaryParts = [
      `Locales: ${files.length}`,
      `Aplicadas en Neon: ${appliedSet.size}`,
      `Pendientes: ${pending}`,
    ];
    if (remoteOnly.length > 0) {
      summaryParts.push(`Solo en Neon: ${remoteOnly.length}`);
    }
    console.log(`\n${summaryParts.join(" | ")}`);
  } finally {
    await client.end();
  }
}

async function runSeed(customSeedArg) {
  const targetPath = customSeedArg
    ? path.resolve(ROOT_DIR, customSeedArg)
    : BASE_SEED_PATH;

  if (!fs.existsSync(targetPath)) {
    throw new Error(`No se encontró el archivo seed: ${targetPath}`);
  }

  const label = path.basename(targetPath);
  const { client, source } = await createConnectedClient();
  try {
    console.log(`[neon-db] Conectado vía ${source}. Cargando seed (${label})...`);
    const raw = fs.readFileSync(targetPath, "utf8");
    const { sql, notes } = adaptSqlForNeon(label, raw);

    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("COMMIT");
      const suffix = notes.length > 0 ? ` (${notes.join(", ")})` : "";
      console.log(`[neon-db] ✓ Seed ${label} aplicado correctamente${suffix}.`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`[neon-db] ✗ Error cargando ${label}:`, err.message);
      throw err;
    }
  } finally {
    await client.end();
  }
}

const command = process.argv[2] || "migrate";

try {
  if (command === "--self-test") {
    runSelfTest();
  } else if (command === "migrate") {
    await runMigrate();
  } else if (command === "status") {
    await runStatus();
  } else if (command === "seed") {
    await runSeed(process.argv[3]);
  } else {
    console.error(`Comando desconocido: ${command}. Usa: migrate | status | seed [archivo.sql] | --self-test`);
    process.exit(1);
  }
} catch (err) {
  console.error("[neon-db] Operación fallida:", err?.message || err);
  process.exit(1);
}
