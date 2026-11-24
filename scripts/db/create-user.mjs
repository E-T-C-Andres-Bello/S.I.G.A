#!/usr/bin/env node
/**
 * S.I.G.A. — Utilidad CLI para crear/vincular un usuario institucional en Neon + Better Auth
 * Uso:
 *   node scripts/db/create-user.mjs --email admin@etcandresbello.org --cedula V12345678 --first "Nombre" --last "Apellido" --role direccion --password "TuClaveSegura123"
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";

const { Client } = pg;
const ROOT_DIR = process.cwd();

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
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

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--") && i + 1 < argv.length) {
      out[argv[i].slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const email = args.email?.trim().toLowerCase();
const cedula = args.cedula?.trim().toUpperCase().replace(/[^VEJ0-9]/g, "");
const firstName = args.first?.trim();
const lastName = args.last?.trim();
const roleCode = args.role?.trim().toLowerCase();
const password = args.password;

if (!email || !cedula || !firstName || !lastName || !roleCode || !password || password.length < 8) {
  console.error(
    'Uso:\n  node scripts/db/create-user.mjs --email usuario@etcandresbello.org --cedula V12345678 --first "Nombre" --last "Apellido" --role estudiante|docente|direccion|control_estudios --password "ClaveMin8Chars"'
  );
  process.exit(1);
}

loadEnvFile(path.join(ROOT_DIR, ".env.local"));
loadEnvFile(path.join(ROOT_DIR, ".env"));

const rawUrl =
  process.env.DIRECT_DATABASE_URL?.trim() ||
  process.env.DATABASE_URL_UNPOOLED?.trim() ||
  process.env.DATABASE_URL?.trim();
if (!rawUrl) {
  console.error("Falta configurar DIRECT_DATABASE_URL o DATABASE_URL en .env.local.");
  process.exit(1);
}

const connectionString = rawUrl.replace(/([?&])sslmode=require(?=&|$)/i, "$1sslmode=verify-full");
const client = new Client({
  connectionString,
  ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: true },
});

await client.connect();
try {
  const passwordHash = await hashPassword(password);
  const fullName = `${firstName} ${lastName}`.trim();

  await client.query("BEGIN");
  await client.query("SELECT set_config('request.jwt.claim.role', 'service_role', true)");

  const roleRes = await client.query(
    "SELECT id FROM public.roles WHERE code = $1 AND is_active = true LIMIT 1",
    [roleCode]
  );
  if (roleRes.rows.length === 0) {
    throw new Error(`Rol no encontrado en public.roles: ${roleCode}. Ejecuta primero npm run db:seed.`);
  }
  const roleId = roleRes.rows[0].id;

  const existingAuth = await client.query(
    "SELECT id FROM public.auth_user WHERE lower(email) = $1 LIMIT 1",
    [email]
  );
  const authUserId = existingAuth.rows[0]?.id ?? crypto.randomUUID();

  if (existingAuth.rows.length === 0) {
    await client.query(
      `INSERT INTO public.auth_user (id, name, email, "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, now(), now())`,
      [authUserId, fullName, email]
    );
  }

  const existingAcc = await client.query(
    `SELECT id FROM public.auth_account WHERE "userId" = $1 AND "providerId" = 'credential' LIMIT 1`,
    [authUserId]
  );
  if (existingAcc.rows.length === 0) {
    await client.query(
      `INSERT INTO public.auth_account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       VALUES ($1, $2, 'credential', $2, $3, now(), now())`,
      [crypto.randomUUID(), authUserId, passwordHash]
    );
  } else {
    await client.query(
      `UPDATE public.auth_account SET password = $1, "updatedAt" = now() WHERE id = $2`,
      [passwordHash, existingAcc.rows[0].id]
    );
  }

  const existingProfile = await client.query(
    `SELECT id FROM public.users WHERE cedula = $1 AND deleted_at IS NULL LIMIT 1`,
    [cedula]
  );

  let internalUserId;
  if (existingProfile.rows.length === 0) {
    const ins = await client.query(
      `INSERT INTO public.users
         (auth_user_id, cedula, first_name, last_name, institutional_email, access_tier, workspace_verified_at, is_active)
       VALUES ($1::uuid, $2, $3, $4, $5, 'verified_workspace', now(), true)
       RETURNING id`,
      [authUserId, cedula, firstName, lastName, email]
    );
    internalUserId = ins.rows[0].id;
  } else {
    internalUserId = existingProfile.rows[0].id;
    await client.query(
      `UPDATE public.users
          SET auth_user_id = $1::uuid,
              institutional_email = $2,
              access_tier = 'verified_workspace',
              workspace_verified_at = now(),
              is_active = true
        WHERE id = $3::uuid`,
      [authUserId, email, internalUserId]
    );
  }

  await client.query(
    `INSERT INTO public.user_roles (user_id, role_id, is_active)
     VALUES ($1::uuid, $2::uuid, true)
     ON CONFLICT DO NOTHING`,
    [internalUserId, roleId]
  );

  await client.query("COMMIT");
  console.log(`✓ Usuario institucional listo en Neon: ${email} (${cedula}) · Rol: ${roleCode}`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error("✗ Error creando usuario:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
