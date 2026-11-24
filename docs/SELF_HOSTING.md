# Guía de Despliegue Propio (Self-Hosting) — S.I.G.A.

Esta guía explica cómo desplegar y autohospedar **S.I.G.A.** (*Sistema Integral de Gestión Académica*) para desarrolladores, colaboradores de código abierto y otras instituciones educativas que deseen adaptar la plataforma a su plantel.

---

## Base de Datos Recomendada: Neon Serverless Postgres

Para cualquier despliegue propio (*self-hosting*) de S.I.G.A., **recomendamos [Neon](https://neon.com) (PostgreSQL Serverless)** como **motor PostgreSQL principal** en producción, desarrollo y entornos de laboratorio.

### ¿Por qué recomendamos Neon para S.I.G.A.?

1. **PostgreSQL 17 estándar y portable:** Compatible de forma nativa con las 57 tablas, funciones `SECURITY DEFINER`, políticas **Row Level Security (RLS)** y la extensión **`pgvector`** utilizada por el Tutor Socrático IA.
2. **Autoescalado y *Scale-to-Zero*:** Los planteles educativos tienen tráfico muy concentrado en horario de clases y picos fuertes al cierre de cada Momento Pedagógico, pero casi nulo durante madrugadas, fines de semana y vacaciones escolares. Neon escala automáticamente en los picos y suspende cómputo en inactividad para mantener el costo cercano a cero.
3. ***Database Branching* y *Protected Branches*:**
   - Permite crear ramas aisladas de base de datos en segundos para *Pull Requests*, pruebas de migraciones y desarrollo local.
   - Permite conservar **ramas protegidas inmutables** por cierre de lapso / año escolar para auditorías académicas.
   - Impulsa los laboratorios prácticos de SQL de la mención **Telemática** mediante ramas efímeras con datos 100 % sintéticos.
4. **Point-in-Time Restore (PITR) y Connection Pooling integrado:** Protección ante errores operativos y soporte nativo para entornos *serverless* de Next.js mediante endpoints `-pooler` y `@neondatabase/serverless`.

> **Nota arquitectónica actual:** S.I.G.A. opera 100 % sobre **Neon Serverless Postgres** (base de datos OLTP + RLS, Better Auth, Neon Object Storage y Neon Functions), con todos los artefactos consolidados en [`neon/`](../neon/) y declarados en [`neon.ts`](../neon.ts).

---

## 1. Prerrequisitos

- **Node.js** `20.x` o superior y `npm`.
- **Git**.
- Una cuenta gratuita o patrocinada en **[Neon](https://neon.com)** para aprovisionar PostgreSQL 17 Serverless.
- Un proveedor de autenticación compatible (actualmente **Supabase Auth** para Google Workspace OAuth, Magic Links y Passkeys WebAuthn; en evaluación soporte nativo para **Neon Auth**).
- *(Opcional)* Claves de servicios complementarios: Google Gemini API (Tutor IA), Mailtrap (correos transaccionales), Sentry (monitoreo) y Cloudflare / Vercel / Netlify (hosting web).

---

## 2. Aprovisionar PostgreSQL en Neon

1. Crea una cuenta o inicia sesión en **[console.neon.tech](https://console.neon.tech)** y crea un nuevo proyecto (por ejemplo, `siga-production`) con **PostgreSQL 17**.
2. **Región recomendada:** Selecciona la **misma región** donde alojarás tu servidor Next.js (por ejemplo, `AWS us-east-1` si despliegas en Vercel US East) para minimizar la latencia.
3. **Configuración sugerida de cómputo (Autoescalado):**
   - **Mínimo:** `0.25 CU` o `0.5 CU` (con *Scale-to-Zero* tras 5–10 minutos en entornos gratuitos o de bajo presupuesto; o *Always-on* a `0.25 CU` en producción para cero arranque en frío).
   - **Máximo:** `2 CU` – `4 CU` para absorber cierres de lapso sin degradar tiempos de respuesta.
4. **Protege tu rama principal:** Activa **Protected branch** sobre `main` en Neon (disponible en el plan Launch y superiores) para evitar borrados o reinicios accidentales.
5. **Crea una rama de desarrollo:** Desde `main`, crea una rama `dev` (o una rama por *feature*) para trabajar localmente sin tocar producción.
6. Copia la cadena de conexión **Pooled (`-pooler`)** para la aplicación web y la conexión **Directa** para ejecutar migraciones DDL.

---

## 3. Clonar e Instalar el Repositorio

```bash
git clone https://github.com/E-T-C-Andres-Bello/S.I.G.A.git
cd S.I.G.A
npm install
```

---

## 4. Configurar Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto (nunca lo subas a Git).

```env
# URL pública de tu instancia de S.I.G.A.
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Base de datos principal en Neon (SOLO en servidor — nunca usar prefijo NEXT_PUBLIC_)
DATABASE_URL=postgresql://<usuario>:<password>@<endpoint>-pooler.<region>.aws.neon.tech/neondb?sslmode=verify-full
DIRECT_DATABASE_URL=postgresql://<usuario>:<password>@<endpoint>.<region>.aws.neon.tech/neondb?sslmode=verify-full

# Autenticación institucional (Better Auth sobre Neon PostgreSQL)
BETTER_AUTH_SECRET=<secreto-aleatorio-de-32-bytes>
```

> **Regla de seguridad:** Las credenciales de Neon (`DATABASE_URL` y `DIRECT_DATABASE_URL`), `BETTER_AUTH_SECRET`, claves de IA o tokens de correo **jamás** deben llevar prefijo `NEXT_PUBLIC_` ni exponerse al navegador.

---

## 5. Esquema de Base de Datos y Datos Semilla

Las migraciones SQL oficiales del modelo relacional se encuentran en [`neon/migrations/`](../neon/migrations/) (junto al bootstrap en [`neon/bootstrap/`](../neon/bootstrap/)) y el diseño detallado en [`docs/modulos/00-MODELO-RELACIONAL-BD.md`](./modulos/00-MODELO-RELACIONAL-BD.md).

- Para aplicar migraciones y catálogos base (menciones, roles, permisos y estructura curricular oficial) sin datos personales reales, ejecuta `npm run db:migrate` y `npm run db:seed`, o revisa [`neon/seed/README.md`](../neon/seed/README.md) y [`neon/seed/catalogos_base.sql`](../neon/seed/catalogos_base.sql).
- **Privacidad K-12:** En entornos de desarrollo, *staging* y laboratorios de Telemática sobre ramas de Neon se utilizan **exclusivamente datos sintéticos**; nunca PII real de estudiantes.

---

## 6. Ejecutar en Desarrollo y Verificar

```bash
# Servidor local de desarrollo
npm run dev

# Verificación de tipos y linter
npm run typecheck
npx eslint src
```

Abre `http://localhost:3000` en tu navegador.

---

## 7. Despliegue en Producción

S.I.G.A. es una aplicación Next.js App Router compatible con **Vercel**, **Netlify** y **Cloudflare Pages / Workers**:

1. Conecta tu fork del repositorio en tu plataforma de despliegue preferida.
2. Configura las variables de entorno de producción apuntando a tu rama protegida `main` en **[Neon](https://neon.com)**.
3. Configura una rama `preview` / `staging` en Neon para validar cada *Pull Request* antes de llevar cambios a producción.
4. Enlaza el dominio institucional de tu plantel y habilita HTTPS/WAF.

---

## Referencias Relacionadas

- [README Principal del Proyecto](../README.md)
- [Arquitectura Supabase + Neon y Transición a Neon Principal](./ARQUITECTURA_SUPABASE_NEON.md)
- [Modelo Relacional General de Base de Datos](./modulos/00-MODELO-RELACIONAL-BD.md)
- [Estructura del Proyecto](./ESTRUCTURA_PROYECTO.md)
