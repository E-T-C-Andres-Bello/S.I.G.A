# Flujos n8n para S.I.G.A. (`E.T.C. "Andrés Bello"`)

Este directorio almacena plantillas **importables y versionadas** para **n8n**, libres de secretos o tokens incrustados.

## Automatización 01 · Solicitud de Trámite → Mailtrap

- **Archivo:** [`01-solicitud-tramite-mailtrap.json`](./01-solicitud-tramite-mailtrap.json)
- **Flujo completo de extremo a extremo:**

```text
Estudiante solicita trámite (INSERT en public.student_requests)
  └─▶ PostgreSQL Trigger (`workflows.dispatch_student_request_email_trigger`) via pg_net
        └─▶ Supabase Edge Function (`workflow-student-request-email`)
              ├─ Verifica `workflow_run_id` / `service_role`, enriquece desde PostgreSQL e inserta `public.notifications`
              ├─ Renderiza acuse estudiantil y alerta a Control de Estudios (HTML seguro)
              └─▶ Webhook de n8n (`POST /webhook/siga-tramite-mailtrap`)
                    ├─ [Tu nodo Mailtrap · Estudiante] -> Acuse al estudiante (si tiene correo)
                    ├─ [Tu nodo Mailtrap · Secretaría] -> Alerta a Control de Estudios
                    └─ Responde JSON `{ ok, student_sent, student_message_id, staff_sent, staff_message_ids }`
                          └─▶ Edge Function registra `public.notification_email_logs` y cierra `workflows.workflow_runs`
```

---

## Cómo configurarlo en n8n (usando tus nodos propios de Mailtrap)

### 1. Importar el workflow
1. Abre tu instancia de **n8n** → **Workflows** → **Import from File**.
2. Selecciona [`n8n/workflows/01-solicitud-tramite-mailtrap.json`](./01-solicitud-tramite-mailtrap.json).

### 2. Reemplazar los dos nodos vacíos (`No Operation`) por tus nodos de Mailtrap
El flujo incluye dos marcadores vacíos sin credenciales rotas ni advertencias:
- **`Nodo Mailtrap Estudiante (Colocar aquí)`**
- **`Nodo Mailtrap Secretaría (Colocar aquí)`**

Sustituye cada uno por tu nodo nativo **`Mailtrap → Send an email`** (puede tener el nombre que prefieras; `Consolidar Resultado Mailtrap` detecta la salida automáticamente sin depender del nombre del nodo) y mapea sus campos desde **`Extraer Payload`**:

#### Para el nodo de **Estudiante**:
| Campo en Mailtrap | Expresión en n8n |
| :--- | :--- |
| **To** | `{{ $('Extraer Payload').first().json.student_to_email }}` |
| **Subject** | `{{ $('Extraer Payload').first().json.student_subject }}` |
| **HTML** | `{{ $('Extraer Payload').first().json.student_html }}` |
| **Text** | `{{ $('Extraer Payload').first().json.student_text }}` |
| **Category** | `{{ $('Extraer Payload').first().json.student_category }}` |

#### Para el nodo de **Control de Estudios / Secretaría**:
| Campo en Mailtrap | Expresión en n8n |
| :--- | :--- |
| **To** | `{{ $('Extraer Payload').first().json.staff_to_emails }}` |
| **Subject** | `{{ $('Extraer Payload').first().json.staff_subject }}` |
| **HTML** | `{{ $('Extraer Payload').first().json.staff_html }}` |
| **Text** | `{{ $('Extraer Payload').first().json.staff_text }}` |
| **Category** | `{{ $('Extraer Payload').first().json.staff_category }}` |

> Si usas Sandbox o un campo distinto de destinatarios múltiples en el nodo Mailtrap, puedes usar `staff_to_first_email` o iterar `staff_alert.to`.

### 3. Activar y conectar con Neon Functions
1. En modo desarrollo el nodo **`Webhook (Trámite S.I.G.A.)`** viene con `Authentication: None` listo para probar sin fricción (cuando pases a producción, cámbialo a `Header Auth` con `x-siga-n8n-secret` y configura `N8N_WEBHOOK_SECRET` en `.env.local` antes de ejecutar `neon deploy --env .env.local`).
2. Activa el toggle **Active** del workflow y copia la **Production Webhook URL** del Webhook.
3. Configura `N8N_WEBHOOK_URL_STUDENT_REQUEST` en tus variables de entorno y redespliega con `neon deploy --env .env.local` tal como se indica en [`neon/functions/README.md`](../../neon/functions/README.md).

---

## Automatización 02 · Asistente IA Editorial de La Cartelera Bellista

- **Archivo:** [`02-cartelera-asistente-ia.json`](./02-cartelera-asistente-ia.json)
- **Flujo seguro extremo a extremo (OWASP LLM 2025 + estándares oficiales de n8n):**

```text
Editor en /cartelera/gestion
  └─▶ Next.js POST /api/cartelera/ai-assistant (Better Auth + rol editorial + cuota 25/h en Neon)
        └─▶ Neon Function `bulletinai` (x-siga-workflow-secret + verificación de ticket + redacción PII)
              └─▶ Webhook n8n (`POST /webhook/siga-cartelera-ia` con autenticación nativa Header Auth `x-siga-n8n-secret`)
                    ├─ Validar Entrada Editorial (Set IIFE <1 ms) → Entrada Válida?
                    │     └─ (No) → Responder 400 Validación (`validation_error` estructurado)
                    └─ (Sí) → Redactor Editorial IA (`@n8n/n8n-nodes-langchain.agent` + DeepSeek + Parser JSON con AutoFix)
                          ├─ (Éxito) → Responder 200 Propuesta IA (`{ ok: true, reply, suggestion }`)
                          └─ (Error) → Responder 5xx Error IA (`502/503/504` sanitizado sin stack traces)
```

### Cómo conectarlo en n8n
1. El workflow **`S.I.G.A. — 02 Asistente IA Cartelera Bellista (Neon -> n8n)`** (también exportable desde [`02-cartelera-asistente-ia.json`](./02-cartelera-asistente-ia.json)) utiliza **0 nodos Code** y **0 usos de `$env`**.
2. Abre el nodo **`Webhook (Cartelera IA S.I.G.A.)`**: ya viene con **`Authentication: Header Auth`**. En **Credential for Header Auth**, crea una credencial de tipo **`Header Auth` (`httpHeaderAuth`)** con:
   - **Name:** `x-siga-n8n-secret`
   - **Value:** tu `N8N_WEBHOOK_SECRET` (exactamente el mismo que colocarás en `.env.local`).
   > Con esta credencial nativa, n8n almacena el secreto cifrado en reposo y rechaza cualquier petición sin cabecera válida con HTTP `401` antes de ejecutar el flujo.
3. Confirma las credenciales de **`DeepSeek Chat Model`** y **`DeepSeek AutoFix Model`** (vienen listos con **Gateway credits** de n8n Cloud, o puedes cambiarlos a tu propia credencial `DeepSeek API`).
4. Prueba el flujo, actívalo (**Publish / Active**), copia su **Production Webhook URL** en `N8N_WEBHOOK_URL_BULLETIN_AI` dentro de `.env.local` y despliega la función con `neon deploy --env .env.local`.
5. Configura `NEON_FUNCTION_BULLETINAI_URL` y `WORKFLOW_WEBHOOK_SECRET` en las variables privadas de servidor de Next.js / Cloudflare.

---

## Automatización 03 · Publicación de Comunicado en Cartelera → Mailtrap

- **Archivo:** [`03-cartelera-publicacion-mailtrap.json`](./03-cartelera-publicacion-mailtrap.json)
- **Remitente institucional:** `notificaciones@etcandresbello.org`
- **Flujo completo de extremo a extremo:**

```text
Editor publica comunicado en /cartelera/gestion (`upsertSchoolAnnouncementAction`)
  └─▶ Neon Function `bulletinnotify` (cabecera `x-siga-workflow-secret`)
        ├─ Reclama ejecución idempotente en `workflows.workflow_runs` (`bulletin_publish_mailtrap`)
        ├─ Lee `public.school_announcements` en Neon PostgreSQL y determina alcance:
        │     ├─ `audience_scope = "institution"` → usuarios activos de toda la institución
        │     └─ `audience_scope = "mention"` → estudiantes matriculados en la mención/año y su coordinación
        ├─ Genera plantilla HTML institucional segura con los colores del comunicado
        └─▶ Webhook n8n (`POST /webhook/siga-cartelera-mailtrap` con Header Auth `x-siga-n8n-secret`)
              ├─ Validar Payload Cartelera (Set IIFE) → ¿Payload Válido?
              │     └─ (No) → Responder 400 Validación (`validation_error`)
              └─ (Sí) → Filtrar Alcance (Institución vs Mención)
                    ├─ (Toda la institución) → Split Out → Mailtrap · Toda la Institución (`notificaciones@etcandresbello.org`)
                    └─ (Mención única)       → Split Out → Mailtrap · Mención Única (`notificaciones@etcandresbello.org`)
                          ├─ (Éxito) → Responder 200 Enviado (`executeOnce: true` → `{ ok, sent_count, message_ids }`)
                          └─ (Error) → Responder 502 Error Mailtrap (`executeOnce: true` → error sanitizado)
                                └─▶ Neon Function audita en `public.notification_email_logs` y cierra `workflows.workflow_runs`
```

### Cómo conectarlo en n8n
1. El workflow **`S.I.G.A. — Automatización 03: Publicación Cartelera -> Mailtrap`** (plantilla sin secretos en [`03-cartelera-publicacion-mailtrap.json`](./03-cartelera-publicacion-mailtrap.json)) usa **0 nodos Code** y **0 referencias a `$env`**.
2. Confirma en el nodo **`Webhook (Publicación Cartelera)`** la credencial nativa **`Header Auth` (`httpHeaderAuth`)** con cabecera `x-siga-n8n-secret`.
3. Confirma en **`Mailtrap · Toda la Institución`** y **`Mailtrap · Mención Única`** la credencial **`Mailtrap Token account` (`MailtrapTokenApi`)** y el remitente verificado `notificaciones@etcandresbello.org`.
4. Activa (**Publish / Active**) el workflow, configura `N8N_WEBHOOK_URL_BULLETIN_PUBLISH` con la **Production Webhook URL** (`/webhook/siga-cartelera-mailtrap`) en `.env.local` y despliega con `npx neon deploy --env .env.local`.

---

## Automatización 04 · Coach IA Socrático de Portafolio y CV + Importador PDF

- **Archivo:** [`04-portafolio-coach-ia.json`](./04-portafolio-coach-ia.json)
- **Flujo seguro extremo a extremo (OWASP LLM 2025):**

```text
Estudiante en /estudiante/portafolio
  └─▶ Next.js POST /api/estudiante/portafolio/ai-coach (Better Auth + cuota 20/h en Neon + redacción PII)
        └─▶ Neon Function `portfoliocoach` (x-siga-workflow-secret + verificación de ticket)
              └─▶ Webhook n8n (`POST /webhook/siga-portafolio-ia` con Header Auth `x-siga-n8n-secret`)
                    ├─ Validar Solicitud Portafolio (Set IIFE <1 ms) → ¿Solicitud Válida? (400)
                    └─ Coach IA Portafolio y CV (`deepseek-v4.1-flash-1017` vía Gateway credits)
                          ├─ Modo `coach`: guía pedagógica con 1–2 preguntas concretas y propuesta opcional
                          ├─ Modo `import_pdf`: estructura texto extraído en navegador a campos editables
                          └─ Responder 200 / 5xx sanitizado (cero logs de éxito con texto estudiantil)
```
