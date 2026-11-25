import { Pool, types as pgTypes, type PoolClient, type QueryResultRow } from "pg";
import { devError } from "@/lib/dev-logger";

// Normaliza tipos PostgreSQL para mantener contratos JSON estables en RSC/Client:
// DATE -> 'YYYY-MM-DD', TIMESTAMPTZ -> ISO string, NUMERIC -> number.
pgTypes.setTypeParser(1082, (val: string) => val);
pgTypes.setTypeParser(1184, (val: string) => new Date(val).toISOString());
pgTypes.setTypeParser(1114, (val: string) => val);
pgTypes.setTypeParser(1700, (val: string) => Number(val));

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface NeonAuthSessionContext {
  authUserId: string;
  email?: string | null;
}

declare global {
  var __sigaNeonPool: Pool | undefined;
}

function assertServerOnly(caller: string): void {
  if (typeof window !== "undefined") {
    throw new Error(`${caller} solo puede ejecutarse en el servidor.`);
  }
}

export function getNeonDatabaseUrl(): string | null {
  assertServerOnly("getNeonDatabaseUrl");
  const url = process.env.DATABASE_URL?.trim() || process.env.DIRECT_DATABASE_URL?.trim();
  return url || null;
}

export function isNeonDatabaseConfigured(): boolean {
  return getNeonDatabaseUrl() !== null;
}

/**
 * Pool PostgreSQL singleton para Neon (compatible con HMR de Next.js).
 * Usa `DATABASE_URL` (preferiblemente el endpoint `-pooler`).
 */
export function getNeonPool(): Pool {
  assertServerOnly("getNeonPool");

  if (globalThis.__sigaNeonPool) {
    return globalThis.__sigaNeonPool;
  }

  const connectionString = getNeonDatabaseUrl();
  if (!connectionString) {
    throw new Error(
      "No se ha configurado DATABASE_URL en las variables de entorno del servidor."
    );
  }

  const isLocal =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1");

  const normalizedConnectionString = isLocal
    ? connectionString
    : connectionString.replace(
        /([?&])sslmode=require(?=&|$)/i,
        "$1sslmode=verify-full"
      );

  const pool = new Pool({
    connectionString: normalizedConnectionString,
    ssl: isLocal ? false : { rejectUnauthorized: true },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
  });

  globalThis.__sigaNeonPool = pool;

  return pool;
}

async function runInRoleTransaction<T>(
  role: "authenticated" | "anon" | "service_role",
  claims: Record<string, string>,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getNeonPool();
  const client = await pool.connect();

  try {
    // Roles literales fijos (nunca interpolar entrada de usuario en SET LOCAL ROLE).
    // Se agrupan sentencias sin parámetros con el protocolo simple de PostgreSQL
    // para ahorrar viajes de red (TCP round-trips) hacia Neon en cada transacción.
    const hasCustomClaims = Object.keys(claims).length > 0;
    if (!hasCustomClaims && role === "service_role") {
      await client.query(
        "BEGIN; SET LOCAL ROLE service_role; SELECT set_config('request.jwt.claim.role', 'service_role', true), set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '{\"role\":\"service_role\"}', true)"
      );
    } else if (!hasCustomClaims && role === "anon") {
      await client.query(
        "BEGIN; SET LOCAL ROLE anon; SELECT set_config('request.jwt.claim.role', 'anon', true), set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)"
      );
    } else {
      if (role === "authenticated") {
        await client.query("BEGIN; SET LOCAL ROLE authenticated");
      } else if (role === "anon") {
        await client.query("BEGIN; SET LOCAL ROLE anon");
      } else {
        await client.query("BEGIN; SET LOCAL ROLE service_role");
      }

      await client.query(
        `SELECT
           set_config('request.jwt.claim.role', $1, true),
           set_config('request.jwt.claim.sub', $2, true),
           set_config('request.jwt.claims', $3, true)`,
        [role, claims.sub ?? "", JSON.stringify({ role, ...claims })]
      );
    }

    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    devError("neon:db", "Error en transacción PostgreSQL/RLS", error, { role });
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignorar fallo secundario si la conexión se cerró
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Ejecuta consultas/RPCs en Neon bajo el rol `authenticated` con RLS obligatorio
 * y el contexto de identidad (`auth.uid()` / `auth.jwt()`) fijado por transacción.
 */
export async function withUserDb<T>(
  session: NeonAuthSessionContext,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  assertServerOnly("withUserDb");
  const authUserId = session.authUserId.trim();
  if (!UUID_REGEX.test(authUserId)) {
    throw new Error("Identificador de sesión inválido para transacción RLS.");
  }

  const claims: Record<string, string> = { sub: authUserId };
  if (session.email?.trim()) {
    claims.email = session.email.trim().toLowerCase();
  }

  return runInRoleTransaction("authenticated", claims, fn);
}

/**
 * Ejecuta funciones públicas `siga_public_*` bajo el rol mínimo `anon` (RLS activo).
 */
export async function withAnonDb<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  assertServerOnly("withAnonDb");
  return runInRoleTransaction("anon", {}, fn);
}

/**
 * Ejecuta operaciones administrativas exclusivas de servidor bajo `service_role`.
 */
export async function withServiceDb<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  assertServerOnly("withServiceDb");
  return runInRoleTransaction("service_role", {}, fn);
}

const SQL_IDENT_REGEX = /^[a-z_][a-z0-9_]*$/;

/**
 * Helper breve para extraer una sola fila tipada desde `PoolClient.query`.
 */
export async function querySingleRow<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const res = await client.query<T>(sql, params);
  return res.rows[0] ?? null;
}

function buildNamedRpcInvocation(
  fnName: string,
  args: Record<string, unknown>
): { callExpr: string; values: unknown[] } {
  if (!SQL_IDENT_REGEX.test(fnName)) {
    throw new Error(`Nombre de función RPC inválido: ${fnName}`);
  }
  const entries = Object.entries(args).filter(([, value]) => value !== undefined);
  const placeholders: string[] = [];
  const values: unknown[] = [];

  for (const [paramName, value] of entries) {
    if (!SQL_IDENT_REGEX.test(paramName)) {
      throw new Error(`Parámetro RPC inválido: ${paramName}`);
    }
    values.push(value);
    placeholders.push(`${paramName} => $${values.length}`);
  }

  return {
    callExpr: `public.${fnName}(${placeholders.join(", ")})`,
    values,
  };
}

/**
 * Invoca un RPC PostgreSQL que retorna un valor escalar o JSONB (`RETURNS JSONB`).
 */
export async function callNeonRpcScalar<T>(
  client: PoolClient,
  fnName: string,
  args: Record<string, unknown> = {}
): Promise<T | null> {
  const { callExpr, values } = buildNamedRpcInvocation(fnName, args);
  const res = await client.query<{ result: T }>(
    `SELECT ${callExpr} AS result`,
    values
  );
  return res.rows[0]?.result ?? null;
}

/**
 * Invoca un RPC PostgreSQL que retorna filas (`RETURNS TABLE(...)` / `SETOF`).
 */
export async function callNeonRpcTable<T extends QueryResultRow>(
  client: PoolClient,
  fnName: string,
  args: Record<string, unknown> = {}
): Promise<T[]> {
  const { callExpr, values } = buildNamedRpcInvocation(fnName, args);
  const res = await client.query<T>(`SELECT * FROM ${callExpr}`, values);
  return res.rows;
}

/**
 * Invoca un RPC opcional protegido por SAVEPOINT dentro de una transacción activa,
 * evitando que un error SQL aborte (`25P02`) el resto de consultas de la transacción.
 */
export async function callNeonRpcTableSafe<T extends QueryResultRow>(
  client: PoolClient,
  fnName: string,
  args: Record<string, unknown> = {}
): Promise<T[]> {
  const sp = "siga_opt_rpc";
  await client.query(`SAVEPOINT ${sp}`);
  try {
    const rows = await callNeonRpcTable<T>(client, fnName, args);
    await client.query(`RELEASE SAVEPOINT ${sp}`);
    return rows;
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    await client.query(`RELEASE SAVEPOINT ${sp}`);
    devError("neon:db", `RPC opcional ${fnName} falló (resguardado con SAVEPOINT)`, error);
    return [];
  }
}
