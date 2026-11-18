# Automatizaciones (`workflows`) — Supabase Edge Functions + n8n

Este directorio agrupa los flujos de automatización de **S.I.G.A.** ejecutados mediante **Supabase Edge Functions** en conjunto con **PostgreSQL (`workflows` + `pg_net`)** y **n8n**.

---

## Automatización 01 · Solicitud de Trámite → Edge Function → n8n → Mailtrap

### Arquitectura implementada

1. **Base de datos (`supabase/migrations/00005_workflows_student_request_mailtrap.sql`):**
   - Crea la extensión `pg_net` y el esquema interno `workflows`.
   - Crea la tabla `workflows.workflow_runs` con RLS restringida a `service_role` para garantizar **idempotencia** y control por `(workflow_code, source_record_id)`.
   - Expone las RPC `siga_service_claim_workflow_run` y `siga_service_finish_workflow_run` (uso exclusivo de `service_role`).
   - Instala el trigger `trg_student_requests_workflow_mailtrap` (`AFTER INSERT ON public.student_requests WHEN (NEW.status = 'pending')`), que despacha una petición `net.http_post` hacia la Edge Function leyendo de Supabase Vault únicamente:
     - `siga_edge_functions_base_url`

2. **Edge Function (`workflow-student-request-email`):**
   - Código modular del flujo: [`student-request-email/handler.ts`](./student-request-email/handler.ts)
   - Entrypoint desplegable: [`../workflow-student-request-email/index.ts`](../workflow-student-request-email/index.ts)
   - Configuración JWT: [`../../config.toml`](../../config.toml) (`verify_jwt = false`).
   - En modo desarrollo no requiere secretos adicionales de webhook ni URLs externas:
     - Verifica automáticamente que el `workflow_run_id` recibido exista en la tabla interna privada `workflows.workflow_runs` para ese `record_id` (o acepta `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` para pruebas administrativas).
     - Enlaces internos del correo en desarrollo apuntan por defecto a `http://localhost:3000`.
   - Qué hace en cada ejecución:
     1. Reclama el run de forma idempotente en `workflows.workflow_runs`.
     2. Consulta los datos reales de la solicitud, perfil del estudiante, matrícula vigente y personal activo de Control de Estudios (`control_estudios`).
     3. Registra la notificación interna en `public.notifications`.
     4. Construye las plantillas HTML/texto (acuse al estudiante y alerta a Secretaría) con escape estricto de HTML.
     5. Envía el payload al **Webhook de n8n** mediante [`../_shared/n8n.ts`](../_shared/n8n.ts).
     6. Registra el resultado por destinatario en `public.notification_email_logs` (`provider = 'mailtrap'`) y cierra el registro en `workflows.workflow_runs`.

3. **Workflow en n8n ([`../../../n8n/workflows/01-solicitud-tramite-mailtrap.json`](../../../n8n/workflows/01-solicitud-tramite-mailtrap.json)):**
   - Recibe el payload de la Edge Function, deja dos nodos vacíos (`No Operation`) para colocar tus propios nodos nativos de **Mailtrap** y devuelve `{ ok, student_sent, student_message_id, staff_sent, staff_message_ids }`.

---

## Variables en Next.js vs Secrets en Supabase (Modo Desarrollo)

- En **Next.js (`.env.local`)** **NO** se agrega ningún secreto de n8n ni de Mailtrap (regla estricta de S.I.G.A.: solo variables de Supabase).
- En **Supabase Secrets**, durante desarrollo solo necesitas la URL del webhook de n8n:

| Secreto | Obligatorio | Descripción |
| :--- | :---: | :--- |
| `N8N_WEBHOOK_URL_STUDENT_REQUEST` | Sí | URL del webhook de n8n (ej. `https://tu-n8n.ejemplo.com/webhook/siga-tramite-mailtrap` o `.../webhook-test/...` mientras pruebas en n8n). |
| `N8N_WEBHOOK_SECRET` | Opcional (Prod) | Si más adelante activas `Header Auth` en el Webhook de n8n, la función enviará este valor en `x-siga-n8n-secret`. |

---

## Pasos para desplegar en desarrollo

### 1. Configurar el secreto del webhook de n8n en Supabase

```powershell
npx supabase secrets set `
  N8N_WEBHOOK_URL_STUDENT_REQUEST="https://TU-INSTANCIA-N8N/webhook/siga-tramite-mailtrap"
```

### 2. Aplicar la migración SQL y desplegar la Edge Function

```powershell
npx supabase db push
npx supabase functions deploy workflow-student-request-email --no-verify-jwt
```

### 3. Registrar la URL base en Supabase Vault (SQL Editor en Dashboard)

> ⚠️ Solo necesitas registrar la URL base de tus Edge Functions en Vault:

```sql
SELECT vault.create_secret(
  'https://isyrpjgxndfpfcswnmkd.supabase.co/functions/v1',
  'siga_edge_functions_base_url',
  'URL base de Edge Functions para automatizaciones de S.I.G.A.'
);
```

### 4. Probar el flujo completo

1. Importa [`n8n/workflows/01-solicitud-tramite-mailtrap.json`](../../../n8n/workflows/01-solicitud-tramite-mailtrap.json) en n8n, reemplaza los dos nodos vacíos por tus nodos nativos de **Mailtrap** y activa el flujo siguiendo [`n8n/workflows/README.md`](../../../n8n/workflows/README.md).
2. Solicita un trámite desde el módulo de Trámites en S.I.G.A. (`http://localhost:3000`).
3. Verifica:
   - En PostgreSQL: filas en `workflows.workflow_runs` (`status = 'completed'`) y `public.notification_email_logs` (`provider = 'mailtrap'`).
   - En n8n: ejecución verde en **Executions**.
   - En Mailtrap: llegada del acuse del estudiante y la alerta a Control de Estudios.
