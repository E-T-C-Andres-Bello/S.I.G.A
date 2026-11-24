# Guía Rápida de Comandos Neon — S.I.G.A.

Esta guía está pensada para el equipo de desarrollo que viene acostumbrado a **Supabase CLI** y ahora trabaja sobre **Neon** (Base de datos PostgreSQL + Better Auth + Neon Object Storage + Neon Functions).

---

## 1. Estructura de la carpeta `neon/`

```text
neon/
├── bootstrap/     # Roles RLS (`anon`, `authenticated`, `service_role`) y helpers `auth.*`
├── migrations/    # Migraciones SQL secuenciales (SOLO DDL: 00001_... hasta 00015_...)
├── seed/          # Catálogos base sin PII (`catalogos_base.sql`) y seeds locales (*.local.sql ignorados por Git)
└── functions/     # Funciones serverless en Node.js 24 (declaradas en `neon.ts` en la raíz)
```

---

## 2. Equivalencia rápida: Supabase → Neon

| Qué hacías en Supabase | Qué ejecutas ahora en Neon |
| :--- | :--- |
| `supabase login` | `neon login` |
| `supabase link --project-ref ...` | `neon init -y --project-id <ID> --branch development` *(solo la primera vez)* |
| `supabase db push` | `npm run db:migrate` |
| `supabase migration list` | `npm run db:status` |
| Ejecutar `supabase/seed/catalogos_base.sql` | `npm run db:seed` |
| Crear usuario en el panel de Supabase Auth | `npm run db:create-user -- --email ... --cedula ... --first ... --last ... --role ... --password ...` |
| `supabase functions serve` | `neon dev` |
| `supabase functions deploy <nombre>` | `neon deploy --env .env.local` |
| Ver qué cambiaría antes de desplegar | `neon config plan` |
| `supabase secrets set KEY=VAL` | Agrega la variable en `.env.local` (declarada en `neon.ts`) y ejecuta `neon deploy --env .env.local` |
| `supabase functions logs` | `neon functions logs studentreqmail` |
| Traer variables de conexión al `.env.local` | `neon env pull` *(o `neon deploy --env .env.local`)* |
| Ver URLs de funciones desplegadas | `neon functions list` |

> Si no tienes `neon` instalado globalmente, instálalo una sola vez con `npm install -g neon@latest` (o usa `npx neon@latest` delante de cada comando `neon`).

---

## 3. Configuración inicial en una PC nueva (5 minutos)

1. **Instala dependencias y CLI de Neon:**
   ```bash
   npm install
   npm install -g neon@latest
   ```
2. **Inicia sesión con tu cuenta de Neon:**
   ```bash
   neon login
   ```
3. **Configura `.env.local` en la raíz del proyecto** (puedes partir de `.env.example`):
   - Ejecuta `neon env pull` (para descargar `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_BRANCH*` y claves de Neon Object Storage).
   - Agrega en `.env.local`:
     - `DIRECT_DATABASE_URL` (copia el mismo valor de `DATABASE_URL_UNPOOLED`).
     - `BETTER_AUTH_SECRET` (cadena aleatoria segura de al menos 32 caracteres).
     - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
4. **Aplica migraciones y catálogos base (si tu rama está vacía):**
   ```bash
   npm run db:status
   npm run db:migrate
   npm run db:seed
   ```
5. **Levanta el servidor local:**
   ```bash
   npm run dev
   ```

---

## 4. Base de datos y migraciones SQL

### Ver qué migraciones están aplicadas o pendientes
```bash
npm run db:status
```

### Aplicar migraciones pendientes
```bash
npm run db:migrate
```

### Validar tus archivos SQL sin tocar la red
```bash
node scripts/db/neon-migrate.mjs --self-test
```

### Crear una migración nueva (regla obligatoria)
1. Crea un archivo nuevo en `neon/migrations/` siguiendo el siguiente número secuencial, por ejemplo:
   `neon/migrations/00016_mi_nueva_tabla.sql`
2. **Solo DDL puro:** tablas, columnas, índices, políticas RLS, triggers y RPCs. **Nunca** incluyas `INSERT` de datos de prueba ni contraseñas dentro de `neon/migrations/`.
3. **No edites migraciones viejas ya aplicadas** (`00001`–`00015`). Si necesitas cambiar algo, crea una migración nueva (`00016_...`).
4. Aplícala con `npm run db:migrate`.

---

## 5. Crear usuarios de prueba en tu rama local/development

En lugar de entrar al dashboard de Supabase Auth, crea o actualiza un usuario en Better Auth + `public.users` + `public.user_roles` con un solo comando:

```bash
npm run db:create-user -- \
  --email docente.prueba@etcandresbello.org \
  --cedula V12345678 \
  --first "María" \
  --last "Pérez" \
  --role docente \
  --password "TuClaveDePrueba123"
```

Roles válidos para `--role`:
`direccion` · `control_estudios` · `orientacion` · `coordinador_pasantias` · `coordinador_mencion` · `biblioteca` · `docente` · `estudiante`

*(En PowerShell en una sola línea, omite las barras invertidas `\`.)*

---

## 6. Neon Functions (reemplazo de Supabase Edge Functions)

Todas las funciones viven en `neon/functions/` y se declaran en `neon.ts` (en la raíz del proyecto).

### Comandos principales
```bash
# 1. Probar funciones localmente conectadas a tu rama de Neon
neon dev

# 2. Ver qué cambios se aplicarán (buckets y funciones) sin tocar nada
neon config plan

# 3. Desplegar funciones y buckets en la rama activa de Neon
neon deploy --env .env.local

# 4. Listar funciones desplegadas y ver sus URLs
neon functions list

# 5. Ver detalles o logs de la función de correo de trámites (`studentreqmail`)
neon functions get studentreqmail
neon functions logs studentreqmail
```

### Reglas para crear una nueva Neon Function
1. El **slug** en `neon.ts` solo acepta minúsculas y números, máximo 20 caracteres, **sin guiones** (ej. `studentreqmail`, `boletinespdf`).
2. El archivo exporta un handler estándar de Node.js 24:
   ```ts
   export default {
     async fetch(request: Request): Promise<Response> {
       return Response.json({ ok: true });
     },
   };
   ```
3. Si consulta PostgreSQL con `pg.Pool`, registra el pool con `attachDatabasePool(pool)` de `@neon/functions`. `DATABASE_URL` se inyecta automáticamente en producción.

---

## 7. Ramas de base de datos (Database Branching)

Si quieres probar cambios grandes sin dañar la rama compartida:

```bash
# Ver ramas existentes
neon branches list

# Crear una rama nueva para tus pruebas (expira automáticamente en 7d según neon.ts)
neon checkout mi-rama-prueba

# Volver a la rama development compartida
neon checkout development
```

---

## 8. Ver errores mientras desarrollas (`npm run dev`)

En modo desarrollo, S.I.G.A. imprime diagnósticos seguros con el prefijo `[SIGA:DEV]` (nunca muestra contraseñas, cookies ni tokens):
- `[SIGA:DEV][auth:login]` — pasos de inicio de sesión, cédula y rol asignado.
- `[SIGA:DEV][middleware]` — redirecciones de rutas protegidas.
- `[SIGA:DEV][neon:db]` — errores exactos de PostgreSQL / RLS (código, mensaje y rol).
- `[SIGA:DEV][neon:functions]` — avisos al invocar funciones serverless.

Antes de hacer `git push`, corre siempre:
```bash
npm run typecheck
npx eslint src neon/functions
```

---

## 9. Reglas de seguridad (no negociables)

- **Nunca subas a Git** `.env.local` ni archivos `neon/seed/*.local.sql` (ya están ignorados en `.gitignore`).
- **Nunca uses `NEXT_PUBLIC_`** para `DATABASE_URL`, `DIRECT_DATABASE_URL`, `BETTER_AUTH_SECRET`, `AWS_*` ni llaves de IA/correo.
- **Nunca subas datos reales de estudiantes** (cédulas, teléfonos o notas reales) a seeds o pruebas.
