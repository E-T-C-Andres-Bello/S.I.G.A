---
name: siga-feature-development
description: >-
  Guía obligatoria para diseñar e implementar NUEVAS funciones en S.I.G.A. (E.T.C. "Andrés Bello") respetando la arquitectura de seguridad, offline-first y control de datos del proyecto (Next.js App Router, Supabase PostgreSQL con RLS multi-rol/multi-sede, RPCs SECURITY DEFINER, Vercel AI SDK + Gemini 2.5 Flash sin datos simulados, generación PDF client-side con QR verificable, y cero secretos en el frontend). Úsala SIEMPRE que se cree, extienda o modifique cualquier módulo, tabla, RPC, Server Action, Route Handler o flujo de IA.
---

# Desarrollo de Funciones — S.I.G.A. (E.T.C. "Andrés Bello")

Adaptación directa de los estándares de ingeniería y seguridad de **VitaLink AI** al ecosistema **Next.js App Router + Supabase + PWA Offline-First + IA** de **S.I.G.A.** (Sistema Integral de Gestión Académica).

---

## 1. Mapa de Arquitectura (Dónde vive cada capa)

| Capa | Ubicación | Reglas clave |
| :--- | :--- | :--- |
| **Landing Propio de SIGA** | `src/app/(landing)/` & `src/components/landing/` | Puerta de entrada institucional; cero datos privados de alumnos; coherencia visual con la E.T.C. "Andrés Bello". |
| **Verificador Público QR** | `src/app/verificar/` | Única superficie pública para terceros (universidades/empresas); solo valida hash/ID de documento mediante RPC público controlado. |
| **Frontend Privado (App)** | `src/app/(dashboard)/`, `src/features/` | Solo consume Server Actions, Route Handlers o servicios tipados bajo RLS; nunca expone `service_role` ni llaves de IA. |
| **Backend Serverless** | `src/app/api/`, Server Actions | Valida sesión JWT en servidor, aplica Zod y enruta llamadas a Gemini, Groq, Drive, Mailtrap/Resend y Telegram. |
| **Base de Datos y RLS** | `supabase/migrations/` & `prisma/` | RLS obligatorio en todas las tablas; lógica crítica y auditoría en RPCs `SECURITY DEFINER`. |
| **Seeds** | `supabase/seed/` | Solo desarrollo/carga inicial controlada; contraseñas únicas; jamás ejecutar seeds de prueba en producción. |
| **Offline-First & PWA** | `src/lib/offline/` & `public/manifest/` | `@serwist/next` + `TanStack Query` + `IndexedDB`; colas de mutación idempotentes con mutex anti-doble envío. |
| **PDFs y QR Client-Side** | `src/components/pdf/` & `src/components/qr/` | `@react-pdf/renderer` en navegador (**0 MB** en servidor) + `qrcode.react` / `html5-qrcode`. |
| **Tipos Compartidos** | `src/types/` | Contratos DTO y `database.types.ts` sincronizados con el esquema SQL real. |

---

## 2. Invariantes de Seguridad (No Negociables)

1. **Nunca confiar en el cliente:** Toda autorización (docente de sección, estudiante dueño del expediente, representante de sus representados, Control de Estudios, Dirección, Orientación) se valida en PostgreSQL (**RLS + RPCs**) y en el servidor (**Server Actions / Route Handlers**). La UI solo oculta/muestra controles por UX.
2. **Aislamiento de Sede / Plantel y Rol:** Todo acceso multi-rol o multi-sede resuelve la identidad del usuario en servidor (`auth.uid()` → `public.users.id`) y valida pertenencia al plantel/sección asignada como **PRIMERA instrucción** de todo RPC crítico. Nunca aceptar `school_id`, `role` o `actor_user_id` confiando en el payload del navegador.
3. **Sin secretos en el bundle cliente:** Todo lo que empiece por `NEXT_PUBLIC_` es público por diseño. Claves de `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `TELEGRAM_BOT_TOKEN`, `MAILTRAP_API_TOKEN`, `RESEND_API_KEY` y credenciales de Google Drive viven **exclusivamente en variables de servidor** (`.env.local` / secretos de despliegue).
4. **Sin credenciales ni PII real en Git:** Prohibido subir nóminas reales de estudiantes, cédulas reales, contraseñas o tokens al repositorio. Los seeds llevan datos sintéticos y contraseñas únicas generadas.
5. **Sin datos ni IA simulada:** Prohibido fabricar calificaciones, promedios, alertas de deserción o respuestas del Tutor IA con regex o valores de relleno. Si Gemini/Groq/RPC falla, mostrar estado vacío, `—`, o error claro y honesto.
6. **Superficie mínima de privilegios en PostgreSQL:** Los RPCs internos llevan `REVOKE EXECUTE ... FROM PUBLIC, anon;` y `GRANT EXECUTE ... TO authenticated, service_role;`. Solo las funciones explícitas `siga_public_*` (ej. verificación QR de documentos) pueden otorgarse a `anon` con anti-abuso.
7. **Errores genéricos al usuario:** El detalle técnico (`SQLERRM`, stack traces) se registra en logs internos/Sentry; al navegador se devuelve un mensaje seguro sin filtrar estructura interna de tablas.
   - Asimismo, **prohibido** mencionar en errores, estados vacíos o descripciones de interfaz nombres de tablas (`section_schedules`), migraciones (`00002_*.sql`), RPCs, proveedores (`Supabase`) o rutas crudas (`<code>/verificar</code>`). Redactar siempre en español claro orientado al estudiante, docente o personal escolar.
8. **Bitácora inmutable y ofuscación de PII en logs:**
   - Toda modificación de calificaciones, cierres de momento y cambios críticos escribe en `audit_logs` (autor, valor anterior, valor nuevo, timestamp, IP/contexto).
   - `audit_logs` debe protegerse con trigger anti-tamper (`BEFORE UPDATE OR DELETE`) para garantizar inmutabilidad ante auditorías MPPE.
   - En logs de diagnóstico/telemetría nunca guardar cédulas o teléfonos completos en texto plano: usar sufijos (`cedula_last4` / `phone_last4`) o hashes.
9. **Migraciones aplicadas son inmutables y puramente DDL:** Si una migración ya se aplicó en remoto, jamás se edita: se crea una nueva con numeración secuencial (`00001_<nombre>.sql`, `00002_<nombre>.sql`, ...) **sin datos, catálogos ni credenciales (`INSERT`)** y se mantiene actualizado `src/types/database.types.ts`.
10. **Confidencialidad reforzada en Orientación y Bienestar (K12):** Los expedientes de Orientación, actas de compromiso, vulnerabilidades socioeconómicas y seguimiento psicopedagógico tienen RLS estricto exclusivo para Orientación/Dirección (nunca visibles para otros docentes, alumnos ni representantes) y **nunca** entran en Supabase Realtime ni en cachés públicos.

---

## 3. Patrones Obligatorios por Tipo de Feature

### 3.1 Nueva Tabla en PostgreSQL / Supabase

1. Crear migración numerada secuencialmente (`0000N_<nombre>.sql`, solo DDL sin datos) + `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`.
2. Definir políticas explícitas `TO authenticated` verificando rol y pertenencia (ej. estudiante solo lee lo suyo, docente solo sus secciones asignadas, representante solo sus hijos vinculados).
3. Para tablas de auditoría (`grade_audit_logs`, `audit_logs`): políticas separadas `FOR INSERT` + `FOR SELECT` + trigger anti-modificación.
4. Índices obligatorios según patrón de consulta (`(school_year_id, section_id)`, `(student_id, momento)`).
5. **Realtime:** Habilitar `ALTER PUBLICATION supabase_realtime ADD TABLE ...` **únicamente** en tablas operativas que lo requieran (ej. notificaciones académicas o solicitudes en vivo). **Nunca** exponer expedientes psicopedagógicos ni auditorías en Realtime.

### 3.2 Nuevo RPC Protegido (`SECURITY DEFINER`)

```sql
CREATE OR REPLACE FUNCTION public.siga_registrar_nota(
    p_enrollment_id UUID,
    p_subject_id UUID,
    p_momento SMALLINT,
    p_grade NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID := public.current_internal_user_id();
BEGIN
    -- 1. SIEMPRE primero: validar rol y asignación real del actor (nunca confiar en el cliente)
    PERFORM public.siga_assert_teacher_subject_access(v_actor_id, p_enrollment_id, p_subject_id);

    -- 2. Validar ventana de tiempo abierta (bloqueo automático fuera de fecha límite)
    PERFORM public.siga_assert_momento_open(p_momento);

    -- 3. Validar rango de negocio (escala 1-20)
    IF p_grade IS NULL OR p_grade < 1 OR p_grade > 20 THEN
        RAISE EXCEPTION 'Calificación fuera de rango (1-20)' USING ERRCODE = '22023';
    END IF;

    -- 4. Persistencia + registro en bitácora inmutable (audit_logs)
    -- ...

    RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_registrar_nota(UUID, UUID, SMALLINT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_registrar_nota(UUID, UUID, SMALLINT, NUMERIC) TO authenticated, service_role;
```

> **Nota crítica de PostgreSQL:** Al redefinir un RPC con `CREATE OR REPLACE FUNCTION`, PostgreSQL puede restaurar `EXECUTE` a `PUBLIC`. Repite siempre `REVOKE ... FROM PUBLIC, anon;` justo después.

### 3.3 Superficies Públicas (`anon`) — Verificador QR y Magic Links

1. Nombrar funciones públicas como `siga_public_*` (única familia con `GRANT EXECUTE ... TO anon`).
2. Aplicar rate limiting por ventana de tiempo e IP/hash en `/verificar` y en endpoints de *Magic Link* para tutores empresariales de 6.º año.
3. Devolver únicamente el estado de autenticidad y metadatos mínimos no sensibles del documento (tipo de constancia, código de verificación, fecha de emisión, estatus válido/revocado); nunca exponer direcciones, teléfonos, alergias ni notas completas en endpoints `anon`.

### 3.4 Frontend Web (Next.js App Router + React + Zod)

1. Centralizar llamadas a datos en `src/features/<modulo>/` o Server Actions/Route Handlers; prohibido hacer `supabase.from(...).select('*')` suelto en componentes UI.
2. Usar `select('col1, col2, ...')` con columnas explícitas para evitar fuga de PII.
3. Validar todos los formularios (inscripciones, notas 1–20, literales `A`–`E`, pasantías, biblioteca) con **Zod** tanto en el cliente (`React Hook Form`) como en el servidor.
4. Nunca usar `dangerouslySetInnerHTML` con texto generado por usuarios o respuestas crudas del LLM.
5. **Protección anti-doble envío:** Todo formulario crítico (inscripción, carga de notas, préstamos de biblioteca) debe usar bloqueo sincrónico con `useRef` + botón `disabled` + clave de idempotencia cuando venga de cola *offline*.
6. **Copy de interfaz libre de jerga técnica:** Nunca usar `<code>` ni texto técnico para mostrar rutas (`/verificar`), tablas (`section_schedules`), archivos o mecanismos internos (`HMAC`, `RLS`, `Supabase`) en pantallas de producción. Si se referencia otra sección del portal, usar lenguaje natural o un enlace/botón descriptivo (*"portal público de verificación"*).

### 3.5 Capa de Inteligencia Artificial (Gemini 2.5 Flash, RAG `pgvector`)

1. **Desidentificación / Minimización:** Al enviar borradores o métricas a LLMs (ej. resumen semanal, revisor normativo de pasantías, alerta de deserción), minimizar PII innecesaria (cédulas completas, direcciones exactas) salvo cuando la tarea sea explícitamente OCR documental en servidor protegido.
2. **Grounding estricto del Tutor Socrático:** El chat RAG (`Vercel AI SDK` + `pgvector`) debe filtrar por `subject_id` / `mencion` y responder **exclusivamente** a partir de las guías subidas por el docente, con instrucción socrática de guiar paso a paso sin entregar la tarea resuelta.
3. **Salidas estructuradas:** OCR de documentos y generación de bancos de 20 preguntas o rúbricas deben usar *structured outputs* validados con esquemas **Zod**.
4. **Cero texto-a-SQL arbitrario:** Si se implementa analítica conversacional, nunca concatenar SQL dinámico desde el LLM; usar funciones agregadas predefinidas o sandbox de solo lectura bajo RLS.

### 3.6 Offline-First, PDFs Client-Side y Almacenamiento Híbrido

1. **Asistencia y notas Offline-First:** Las mutaciones encoladas en `IndexedDB` (`idb-keyval` / `Dexie.js`) deben llevar un `client_mutation_id` (UUID) para que la sincronización al recuperar internet/electricidad sea **100% idempotente** en Supabase.
2. **PDFs con 0 MB en servidor:** Boletines, constancias y certificaciones MPPE se ensamblan en navegador con `@react-pdf/renderer` leyendo JSON validado + hash QR firmado desde servidor.
3. **Imágenes optimizadas:** Fotos carnet y portadas de biblioteca se comprimen a `.webp` en el cliente (`browser-image-compression`) antes de subir a Storage/Cloudinary.
4. **Informes pesados:** Informes finales de pasantías de 6.º año en PDF se enrutan por servidor hacia **Google Drive API** institucional.

---

## 4. Runbook de Errores Frecuentes (Lecciones Heredadas de VitaLink AI)

Verificar SIEMPRE estos puntos antes de dar por cerrada una feature:

1. **Cédula venezolana canónica:**
   - Almacenar normalizada sin guion ni espacios (`regexp_replace(upper(x), '[^VEJ0-9]', '', 'g')`, formato `^[VEJ][0-9]{6,9}$`, ej. `V12345678`).
   - En la UI mostrar `V-12345678` y autodetectar prefijo `V` si solo ingresan dígitos. Fechas en DB siempre ISO `YYYY-MM-DD`; en UI `DD/MM/AAAA`.
2. **IDs internos vs `auth.uid()`:**
   - Distinguir siempre entre `auth.users.id` y `public.users.id` (perfil interno). Todas las FKs de negocio (`teacher_id`, `student_id`, `notifications.user_id`) deben apuntar consistentemente al mismo identificador canónico sin mezclar ambos.
3. **Realtime silencioso o crash en React StrictMode:**
   - Confirmar que la tabla esté agregada de forma idempotente a `supabase_realtime`.
   - Usar un `topic` único monotónico por suscripción (`++counter`, nunca `Date.now()`) y registrar `.on(...)` **antes** de `.subscribe(...)`.
4. **Palabras reservadas en PostgreSQL:**
   - Nunca usar `do`, `end`, `limit`, `user`, `check`, `order`, `value`, `position`, `between` como alias de tabla/columna en migraciones PL/pgSQL.
5. **Concurrencia y Soft-Deletes:**
   - Toda validación de unicidad (matrícula, préstamo de libro, reserva de equipo audiovisual, inscripción en sección) debe filtrar `AND deleted_at IS NULL` y usar `pg_advisory_xact_lock(...)` o constraints atómicos en BD.
6. **Desajuste de firma RPC en PostgREST:**
   - PostgREST exige coincidencia exacta en nombre, tipo y cantidad de argumentos (`p_*`). Si cambias un RPC, actualiza `NOTIFY pgrst, 'reload schema';` y `src/types/database.types.ts`.
7. **Orden topológico en borrados / cierres:**
   - Respetar claves foráneas `ON DELETE RESTRICT`: nunca eliminar un año escolar, sección o usuario referenciado sin limpiar/archivar en orden topológico o usar *soft-delete* auditado.
8. **Fondos WebGL sin parpadeo negro (`parpadeo negro`) en animaciones y `ResizeObserver`:**
   - Todo `<canvas>` WebGL dentro de un contenedor cuya altura cambia dinámicamente (ej. paneles desplegables in-place) borra su búfer a negro/transparente en el instante en que se reasigna `canvas.width` o `canvas.height`.
   - Inicializar el contexto con `alpha: true` sobre un gradiente CSS de respaldo acorde al tema y **llamar síncronamente a `drawFrame(performance.now())` justo después de redimensionar** (`canvas.width = ...; gl.viewport(...); drawFrame(...)`).
   - Nunca incluir estado React del puntero (`mousePosition`) en el arreglo de dependencias del `useEffect` que compila shaders ni redimensionar el canvas incondicionalmente por frame: mantener coordenadas del puntero en `useRef` o variables mutables dentro de un único ciclo.
   - Evitar animar `filter: blur(...)` directamente sobre tarjetas con `backdrop-blur` encima de un `<canvas>` WebGL; animar únicamente `grid-template-rows`, `opacity` y `transform`.
9. **Acceso Minimalista Directo en Portada (sin botón extra en header ni registro abierto):**
   - El encabezado de portada se mantiene minimalista únicamente con la marca **S.I.G.A.** y el selector de tema (sin botón adicional de entrada).
   - Debajo del titular del Hero se muestra directamente el botón **«Ingresar con Google»** (`@etcandresbello.org`) y debajo la opción **«Usar correo y contraseña»**, que despliega in-place (`grid-template-rows: 0fr -> 1fr` con `inert` al cerrarse y sin modales flotantes) únicamente los campos `Correo o cédula` y `Contraseña` más el botón `Ingresar`.
   - No existe auto-registro abierto: el servidor exige cuenta `@etcandresbello.org` o cédula pre-inscrita en `public.users` con rol asignado en `user_roles`.
10. **Migraciones SQL 100 % puras (DDL) y numeración secuencial (`00001_...`):**
    - Toda migración en `supabase/migrations/` usa prefijo numérico secuencial (`00001_<nombre>.sql`, `00002_<nombre>.sql`, ...) y contiene **únicamente DDL** (esquemas, extensiones en `extensions`, tablas, índices, triggers, funciones, políticas RLS y `GRANT`/`REVOKE`).
    - **Prohibido incluir `INSERT`, datos de prueba, catálogos ni credenciales dentro de `supabase/migrations/`.**
    - Los catálogos no personales viven en `supabase/seed/catalogos_base.sql` y las semillas locales de desarrollo con credenciales de prueba viven exclusivamente en archivos `supabase/seed/*.local.sql` ignorados por `.gitignore` (jamás ejecutados en producción ni subidos a Git).

---

## 5. Checklist Final antes de Cerrar una Feature

- [ ] Migración nueva numerada secuencialmente (`0000N_<nombre>.sql`, solo DDL sin `INSERT`s y sin editar migraciones ya aplicadas) + `database.types.ts` actualizado.
- [ ] Tablas nuevas con RLS activado + políticas explícitas `TO authenticated` + índices.
- [ ] RPCs con `SECURITY DEFINER`, `SET search_path = public, pg_temp`, validación de rol/acceso al inicio y `REVOKE ... FROM PUBLIC, anon`.
- [ ] Rutas públicas (`siga_public_*` / `/verificar`) con rate limit y sin fuga de PII.
- [ ] Formularios y Route Handlers validados con Zod; `select(...)` explícito (cero `select('*')`).
- [ ] Cero secretos en código o variables `NEXT_PUBLIC_*`; cero PII sensible en `audit_logs` o logs.
- [ ] Cero identificadores técnicos (tablas SQL, rutas crudas con `/...`, archivos `.sql`, `<code>` de rutas, `Supabase`/`HMAC`/`RPC`) en textos, avisos, estados vacíos o mensajes de error de la UI.
- [ ] Cero datos o respuestas de IA simuladas; citas/grounding real en RAG.
- [ ] Mutaciones *offline-first* idempotentes y con bloqueo anti-doble submit (`useRef`).
- [ ] Verificación técnica aprobada: `typecheck`, `lint`, `build`, tests y auditoría de dependencias/secretos.
