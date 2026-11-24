# Estructura del Proyecto y Stack Tecnológico — S.I.G.A.

Este documento describe la estructura del repositorio para **S.I.G.A.** (Next.js App Router + TypeScript + Tailwind CSS + shadcn/ui + Supabase + PWA Offline-First + Vercel AI SDK), incluyendo su **Landing Page propio** para la E.T.C. "Andrés Bello" y la separación modular de dominios.

---

## Árbol de Directorios

```text
S.I.G.A/
├── docs/                                  # Documentación técnica y contexto institucional
│   ├── SELF_HOSTING.md                    # Guía de autohospedaje (Self-Hosting) recomendando Neon Serverless Postgres
│   ├── CONTEXTO_INSTITUCIONAL.md          # Información migrada del Landing E.T.C. Andrés Bello + Anteproyecto
│   ├── ESTRUCTURA_PROYECTO.md             # Este mapa de arquitectura y directorios
│   ├── ARQUITECTURA_SUPABASE_NEON.md      # Integración PostgreSQL Neon + Supabase y transición a Neon principal
│   └── modulos/                           # Diseño relacional de BD y especificación completa por rol (Alumnos, Docentes, Administración)
├── prisma/                                # Modelado relacional y migraciones (Prisma / Drizzle)
│   └── migrations/
├── neon/                                  # Configuración PostgreSQL Neon, migraciones, seeds y Neon Functions
│   ├── bootstrap/                         # Bootstrap de roles RLS y helpers auth.* en Neon
│   ├── functions/                         # Neon Functions Node.js 24 (workflows de trámites y correo n8n)
│   ├── migrations/                        # Migraciones DDL puras, políticas RLS, RPCs y pgvector
│   └── seed/                              # Catálogos base sin PII (catalogos_base.sql) y semillas locales ignoradas
├── neon.ts                                # Manifiesto declarativo de buckets y funciones en Neon CLI
├── public/                                # Activos estáticos servidos directamente
│   ├── icons/                             # Iconos PWA (192x192, 512x512, apple-touch-icon)
│   ├── images/
│   │   ├── institucion/                   # Escudo, fachada y espacios de la E.T.C. Andrés Bello
│   │   └── plataformas/                   # Logotipos de patrocinadores y plataformas aliadas
│   └── manifest/                          # Recursos estáticos para Service Worker / PWA (@serwist/next)
└── src/
    ├── app/                               # Next.js App Router (rutas, layouts y APIs)
    │   ├── (landing)/                     # Landing Page propio de SIGA para la E.T.C. Andrés Bello
    │   ├── (auth)/                        # Inicio de sesión (Cédula/Correo, Google OAuth, Magic Links)
    │   ├── verificar/                     # Ruta pública de verificación QR anti-forjamiento de PDFs
    │   ├── (dashboard)/                   # Área autenticada protegida por rol y Supabase RLS
    │   │   ├── control-estudios/          # Periodos, inscripción OCR, prosecución, notas MPPE y PDFs/QR
    │   │   │   └── orientacion/           # Expediente confidencial de Orientación y Psicopedagogía
    │   │   ├── analitica/                 # BI, SLA Tracker, materias filtro, alerta temprana y CDCE
    │   │   ├── aula-virtual/              # Campus LMS único compartido dentro de SIGA (alumnos y docentes en /aula-virtual)
    │   │   │   ├── page.tsx               # Directorio unificado de cursos según rol (enrollments / teacher_assignments)
    │   │   │   ├── [courseId]/page.tsx    # Sala compartida de materia: módulos, entregas, exámenes y Tutor IA RAG
    │   │   │   ├── telematica/            # Laboratorio práctico Telemática (sandbox código/SQL, redes/IP, bitácora TI)
    │   │   │   ├── aduanas/               # Laboratorio práctico Aduanas (arancel, CIF/FOB, documentos B/L)
    │   │   │   └── turismo/               # Laboratorio práctico Turismo (rutas Guayana, eventos, recepción hotelera)
    │   │   ├── biblioteca/                # Gestión nativa de biblioteca escolar y equipos audiovisuales
    │   │   ├── pasantias/                 # 6.º año: CRM empresas, matchmaking, bitácora, revisor IA y Magic Link
    │   │   ├── docente/                   # Planificación IA, asistencia Offline-First/QR, notas ponderadas y diario de clases
    │   │   └── estudiante/                # Dashboard gamificado, simulador de notas, carnet QR, trámites y acceso provisional por cédula
    │   └── api/                           # Next.js Route Handlers (REST, streaming, cron y webhooks)
    │       ├── ai/                        # Endpoints de Gemini 2.5 Flash y RAG (pgvector)
    │       ├── auth/                      # Callbacks OAuth (@etcandresbello.org) y Magic Links
    │       ├── cron/                      # Resúmenes semanales, alertas de biblioteca y tareas programadas
    │       └── webhooks/                  # Integraciones externas (Telegram Bot API, Mailtrap/Resend)
    ├── components/
    │   ├── ui/                            # Componentes base de shadcn/ui (Radix UI + Tailwind CSS)
    │   ├── landing/                       # Componentes exclusivos del Landing Page propio de SIGA
    │   ├── pdf/                           # Plantillas client-side (@react-pdf/renderer — 0 MB en servidor)
    │   ├── qr/                            # Generación (qrcode.react) y escaneo (html5-qrcode)
    │   └── shared/                        # Tablas (TanStack Table), gráficos (Recharts/Tremor) y navegación
    ├── features/                          # Lógica de negocio desacoplada por módulo (hooks, Zod, acciones)
    │   ├── control-estudios/
    │   ├── orientacion/                   # Seguimiento psicopedagógico cifrado integrado a Control de Estudios
    │   ├── analitica/
    │   ├── aula-virtual/
    │   ├── menciones/                     # Reglas y herramientas exclusivas de Telemática, Aduanas y Turismo
    │   ├── biblioteca/
    │   ├── pasantias/
    │   └── asistencia/
    ├── lib/                               # Infraestructura transversal y clientes de servicios
    │   ├── ai/                            # Vercel AI SDK y @google/genai (Gemini 2.5 Flash)
    │   ├── auth/                          # Better Auth (credenciales, Google Workspace OAuth, Passkeys) y sesiones SSR
    │   ├── db/                            # Pool PostgreSQL Neon con transacciones RLS por rol (anon/authenticated/service_role)
    │   ├── neon/                          # Cliente analítico BI y utilidades Neon sobre PostgreSQL directo
    │   ├── offline/                       # TanStack Query + IndexedDB (idb-keyval / Dexie.js) + @serwist/next
    │   ├── storage/                       # Compresión .webp, Supabase Storage/Cloudinary y Google Drive API
    │   ├── notifications/                 # Mailtrap / Resend + React Email + Telegram Bot API
    │   ├── analytics/                     # Telemetría de producto (PostHog) y monitoreo (Sentry)
    │   └── validators/                    # Esquemas Zod compartidos (escalas 1–20, A–E, cédulas, planillas)
    └── types/                             # Tipos e interfaces TypeScript globales y de dominio
```

---

## Decisiones Estructurales Clave

1. **Separación `(landing)` vs `(dashboard)`:** El *Route Group* `src/app/(landing)/` aloja el Landing Page propio de SIGA para la E.T.C. "Andrés Bello" (con estética alineada al portal institucional, enfoque funcional para la comunidad, menciones exclusivas, patrocinadores y enlace a `/verificar`), totalmente desacoplado de las rutas privadas del sistema escolar en `(dashboard)/`.
2. **Aula Virtual Unificada dentro de S.I.G.A. (`/aula-virtual`):** Todos los alumnos y docentes comparten un único campus LMS integrado dentro de S.I.G.A. (`src/app/(dashboard)/aula-virtual/page.tsx` y `[courseId]/page.tsx`), manteniendo sesión única `@etcandresbello.org` y conexión directa con `enrollments`, `teacher_assignments` y `student_scores`. Dentro del mismo espacio, `src/app/(dashboard)/aula-virtual/{telematica,aduanas,turismo}/` y `src/features/menciones/` alojan los laboratorios prácticos especializados por mención técnica desde 1.º hasta 6.º año. Ver [docs/modulos/04-AULA-VIRTUAL.md](./modulos/04-AULA-VIRTUAL.md).
3. **Biblioteca Nativa sin Dependencias Externas:** `src/app/(dashboard)/biblioteca/` y `src/features/biblioteca/` reemplazan la antigua propuesta de BookNest por un módulo integrado directamente con el Carnet Digital QR y la base de datos PostgreSQL de SIGA.
4. **Alcance Cerrado y Confidencialidad:** `src/app/(dashboard)/control-estudios/orientacion/` y `src/features/orientacion/` gestionan el seguimiento psicopedagógico cifrado bajo RLS estricto (`orientacion` y `direccion`), habiéndose excluido del alcance los módulos de Representantes, Mantenimiento/Obrero/Portería, PAE (Comedor) y Patrocinios. Ver [docs/modulos/README.md](./modulos/README.md) para el diseño completo de módulos y [docs/modulos/00-MODELO-RELACIONAL-BD.md](./modulos/00-MODELO-RELACIONAL-BD.md) para el esquema relacional y RBAC.
5. **Cero Bloqueos Offline y Cero Sobrecarga de Storage:** La carpeta `src/lib/offline/` centraliza la cola local en IndexedDB para salones sin luz o sin internet, mientras `src/components/pdf/` y `src/lib/storage/` garantizan PDFs generados en navegador y compresión `.webp` previa a la subida.
