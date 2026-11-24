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
