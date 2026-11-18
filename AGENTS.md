# AGENTS.md — Instrucciones Globales y Activación Automática de Skills (S.I.G.A.)

Este archivo guía a cualquier agente de IA que trabaje dentro del repositorio **S.I.G.A.** (*Sistema Integral de Gestión Académica* — **E.T.C. "Andrés Bello"**, Unare II, Puerto Ordaz · Código DEA `OD01340701`).

---

## 1. Regla de Acceso Automático a `.agents/skills/`

Antes de planificar, diseñar o modificar código, **identifica el dominio de la tarea en la tabla inferior y lee automáticamente el archivo `SKILL.md` correspondiente dentro de `.agents/skills/<nombre>/SKILL.md`**.
Las instrucciones de las skills aplicables son obligatorias durante toda la ejecución.

### Catálogo de Skills del Proyecto

| Skill | Ruta exacta | Cuándo activarla automáticamente |
| :--- | :--- | :--- |
| **`siga-feature-development`** | `.agents/skills/siga-feature-development/SKILL.md` | **SIEMPRE** que se cree, extienda o modifique cualquier módulo, tabla, RPC, Server Action, Route Handler, PDF, verificación QR o flujo de IA en S.I.G.A. |
| **`shadcn`** | `.agents/skills/shadcn/SKILL.md` | Al crear, instalar, estilizar o depurar componentes UI en `src/components/ui/` (`components.json`). |
| **`frontend-design`** | `.agents/skills/frontend-design/SKILL.md` | Al diseñar o rediseñar interfaces visuales, tipografía, jerarquía estética y componentes de portada. |
| **`ui-ux-pro-max`** | `.agents/skills/ui-ux-pro-max/SKILL.md` | Al construir o revisar páginas, paletas de color, layouts responsivos, interacciones, gráficas o accesibilidad visual. |
| **`vercel-react-best-practices`** | `.agents/skills/vercel-react-best-practices/SKILL.md` | Al escribir o refactorizar componentes React y rutas Next.js App Router (rendimiento, *code splitting*, fetching). |
| **`vercel-composition-patterns`** | `.agents/skills/vercel-composition-patterns/SKILL.md` | Al diseñar APIs de componentes reutilizables, *compound components* o evitar explosión de props booleanas. |
| **`next-cache-components-optimizer`** | `.agents/skills/next-cache-components-optimizer/SKILL.md` | Al optimizar renderizado inicial, Suspense boundaries o navegación instantánea en Next.js. |
| **`web-accessibility-wcag`** | `.agents/skills/web-accessibility-wcag/SKILL.md` | Al corregir o auditar accesibilidad WCAG 2.1 AA, ARIA, contraste y navegación por teclado. |
| **`web-design-guidelines`** | `.agents/skills/web-design-guidelines/SKILL.md` | Al revisar código de interfaz frente a estándares web de diseño y UX. |
| **`supabase`** | `.agents/skills/supabase/SKILL.md` | En cualquier tarea con Supabase: Auth, SSR, Storage, Realtime, Edge Functions, logs o CLI. |
| **`supabase-postgres-best-practices`** | `.agents/skills/supabase-postgres-best-practices/SKILL.md` | **ANTES** de crear/alterar tablas, columnas, índices, migraciones, triggers o políticas RLS en PostgreSQL. |
| **`postgresql-optimization`** | `.agents/skills/postgresql-optimization/SKILL.md` | Al optimizar consultas SQL, JSONB, tipos de rango, funciones de ventana o extensiones de PostgreSQL. |
| **`postgresql-code-review`** | `.agents/skills/postgresql-code-review/SKILL.md` | Al revisar calidad y seguridad de esquemas SQL, funciones y políticas RLS. |
| **`ai-sdk`** | `.agents/skills/ai-sdk/SKILL.md` | Al construir flujos con Vercel AI SDK (`generateText`, `streamText`, herramientas, agentes o `useChat`). |
| **`llm-security`** | `.agents/skills/llm-security/SKILL.md` | **SIEMPRE** que se trabaje con el Tutor IA, prompts, RAG o llamadas a modelos LLM (OWASP Top 10 para LLMs). |
| **`owasp-top-10-testing`** | `.agents/skills/owasp-top-10-testing/SKILL.md` | En auditorías o pruebas de seguridad mapeadas a OWASP Top 10 / API Security. |
| **`git-repo-privacy-audit`** | `.agents/skills/git-repo-privacy-audit/SKILL.md` | Antes de publicar cambios o al auditar secretos, llaves API o PII en el árbol de trabajo o historial Git. |
| **`ponytail`** | `.agents/skills/ponytail/SKILL.md` | Para mantener implementaciones simples, mínimas y libres de sobreingeniería. |
| **`ponytail-review`** | `.agents/skills/ponytail-review/SKILL.md` | Al revisar código o *diffs* antes de entregar un cambio. |
| **`ponytail-audit`** | `.agents/skills/ponytail-audit/SKILL.md` | Al auditar el repositorio completo para detectar *bugs*, cuellos de botella o código innecesario. |
| **`ponytail-debt`** | `.agents/skills/ponytail-debt/SKILL.md` | Para listar comentarios `shortcut:` o deuda técnica pendiente. |
| **`ponytail-gain`** | `.agents/skills/ponytail-gain/SKILL.md` | Referencia de métricas de impacto de `ponytail`. |
| **`ponytail-help`** | `.agents/skills/ponytail-help/SKILL.md` | Referencia rápida de comandos y niveles `ponytail`. |

---

## 2. Estructura del Proyecto y Convenciones Clave

- **Stack:** Next.js 15 (App Router), React 19, TypeScript (`strict: true`), Tailwind CSS v4 (`src/app/globals.css`), `shadcn` (`style: "new-york"` en `components.json`), `lucide-react` e integración con Supabase / PostgreSQL / PWA Offline-First.
- **Componentes UI (`shadcn`):** Todo componente UI reutilizable se ubica en **`src/components/ui/`** (alias `@/components/ui/*` configurado en `tsconfig.json` y `components.json`).
- **Contexto institucional y estructura:** Consultar `docs/CONTEXTO_INSTITUCIONAL.md`, `docs/ESTRUCTURA_PROYECTO.md` y `docs/ARQUITECTURA_SUPABASE_NEON.md` ante dudas de negocio, rutas o arquitectura Supabase + Neon.
- **Entorno de desarrollo aislado (`Windows`):** En `next.config.ts`, `next dev` usa `.next-dev` y `next build` usa `.next` para evitar errores `Internal Server Error` por colisión de *chunks* mientras el servidor de desarrollo está activo.
- **Comandos de verificación obligatorios tras editar código:**
  - `npm run typecheck` (`tsc --noEmit`)
  - `npx eslint src`
  - Evita lanzar servidores de prueba sobre el puerto 3000 si el usuario ya está verificando manualmente en `npm run dev`.

---

## 3. Reglas Innegociables de Seguridad e Integridad

1. **Solo variables de Supabase en Next.js y cero secretos en el frontend:** Todo prefijo `NEXT_PUBLIC_` es público. En el entorno web de Next.js únicamente deben residir variables de Supabase; llaves de Neon (`NEON_*`), IA, correo o bots viven aisladas en **Supabase Edge Functions (`supabase secrets`)** o servidor protegido (`service_role`).
2. **Cero datos reales de estudiantes o PII en Git:** Usar únicamente datos sintéticos en seeds o pruebas.
3. **Sin datos simulados en producción/lógica académica:** Nunca fabricar calificaciones, promedios ni respuestas del Tutor IA; si un servicio falla, mostrar estado vacío o error claro.
4. **Resguardo institucional:** La apertura de código no autoriza el uso comercial ni suplantación del escudo o sellos oficiales de la E.T.C. "Andrés Bello", y el uso de marcas de aliados tecnológicos en `/legal` y portada respeta sus *Brand Guidelines* oficiales.
5. **Interfaz 100 % humana (cero identificadores técnicos visibles):** Prohibido mostrar al usuario final nombres de tablas o columnas (`section_schedules`, `student_requests`), nombres de archivos o migraciones (`00002_*.sql`, `.tsx`), rutas crudas (`/verificar`), etiquetas `<code>` con rutas/identificadores, funciones RPC ni jerga de infraestructura (`Supabase`, `RLS`, `HMAC`, `PostgREST`). Todo estado vacío, aviso o error debe redactarse en español natural institucional y dejar los detalles técnicos únicamente en logs internos de servidor/Sentry.
