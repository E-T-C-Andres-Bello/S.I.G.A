import type { NextRequest } from "next/server";

export interface RateLimitConfig {
  namespace: string;
  clientKey: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  backend: "upstash_redis" | "memory_fallback";
}

const memoryWindows = new Map<string, { count: number; resetAt: number }>();

function checkMemoryRateLimit(config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  if (memoryWindows.size > 2000) {
    for (const [k, entry] of memoryWindows.entries()) {
      if (entry.resetAt <= now) {
        memoryWindows.delete(k);
      }
    }
  }

  const compositeKey = `${config.namespace}:${config.clientKey}`;
  const current = memoryWindows.get(compositeKey);

  if (!current || current.resetAt <= now) {
    memoryWindows.set(compositeKey, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: Math.max(0, config.limit - 1),
      retryAfterSec: 0,
      backend: "memory_fallback",
    };
  }

  if (current.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      backend: "memory_fallback",
    };
  }

  current.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, config.limit - current.count),
    retryAfterSec: 0,
    backend: "memory_fallback",
  };
}

/**
 * Extrae la IP real del cliente desde cabeceras de proxy inverso o CDN.
 */
export function resolveRequestClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Control de tasa de peticiones distribuido con Upstash Redis REST API
 * (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`) y fallback automático
 * en memoria para desarrollo o contingencia de red.
 */
export async function enforceRateLimit(
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!redisUrl || !redisToken) {
    return checkMemoryRateLimit(config);
  }

  const bucket = Math.floor(Date.now() / config.windowMs);
  const redisKey = `siga:rl:${config.namespace}:${config.clientKey}:${bucket}`;

  try {
    const response = await fetch(`${redisUrl.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["PEXPIRE", redisKey, config.windowMs, "NX"],
        ["PTTL", redisKey],
      ]),
      cache: "no-store",
    });

    if (!response.ok) {
      return checkMemoryRateLimit(config);
    }

    const payload = (await response.json()) as Array<{ result?: number }>;
    const count = Number(payload?.[0]?.result ?? 1);
    const pttl = Number(payload?.[2]?.result ?? config.windowMs);
    const retryAfterSec = Math.max(
      1,
      Math.ceil((pttl > 0 ? pttl : config.windowMs) / 1000)
    );

    return {
      allowed: count <= config.limit,
      remaining: Math.max(0, config.limit - count),
      retryAfterSec: count <= config.limit ? 0 : retryAfterSec,
      backend: "upstash_redis",
    };
  } catch {
    return checkMemoryRateLimit(config);
  }
}
