# Neon Functions — S.I.G.A.

Esta carpeta aloja las funciones serverless en **Node.js 24** gestionadas por **Neon Functions** y declaradas en [`neon.ts`](../../neon.ts).

## Funciones activas

| Slug en `neon.ts` | Entrypoint | Descripción |
| :--- | :--- | :--- |
| **`studentreqmail`** | `neon/functions/workflow-student-request-email/index.ts` | Automatización 01: al crearse un trámite en `public.student_requests`, registra la notificación in-app, despacha acuse al estudiante y alerta a Control de Estudios vía **n8n → Mailtrap** y actualiza `workflows.workflow_runs`. |

> **Nota:** La antigua función `neon-analytics-query` fue retirada porque Next.js consulta directamente a Neon PostgreSQL mediante la función RLS `siga_get_analytics_bi_overview`.

## Variables opcionales (configuradas vía `.env.local` al desplegar)

- `WORKFLOW_WEBHOOK_SECRET` — Secreto compartido en header `x-siga-workflow-secret` (en desarrollo sin este valor se exige el `workflow_run_id` válido emitido por PostgreSQL).
- `N8N_WEBHOOK_URL_STUDENT_REQUEST` — URL del webhook de n8n (ver [`n8n/workflows/README.md`](../../n8n/workflows/README.md)).
- `N8N_WEBHOOK_SECRET` — Header secreto `x-siga-n8n-secret` hacia n8n.
- `CONTROL_ESTUDIOS_NOTIFY_EMAIL` — Correo adicional opcional para alertas de secretaría.
- `SIGA_PORTAL_BASE_URL` — URL pública del portal usada en los enlaces del correo (por defecto `http://localhost:3000`).

> `DATABASE_URL` es inyectada automáticamente por Neon Functions para cada rama (`development`, `main`, etc.).

## Comandos

```bash
# Vista previa de cambios en Neon
neon config plan

# Desplegar buckets y funciones en la rama activa de Neon
neon deploy --env .env.local

# Ejecutar funciones localmente contra la rama activa
neon dev
```
