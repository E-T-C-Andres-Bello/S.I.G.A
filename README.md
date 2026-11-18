# SIGA — Sistema Integral de Gestión Académica

**Escuela Técnica Comercial "Andrés Bello"** (`etcandresbello.org`)  
*Puerto Ordaz, Estado Bolívar, Venezuela — Código DEA: OD01340701*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status: Active Development (Pre-Alpha)](https://img.shields.io/badge/Estado-En%20Desarrollo%20Activo%20(Pre--Alpha)-blue.svg)](#estado-actual-del-proyecto)
[![Community Service: UNEG](https://img.shields.io/badge/Servicio%20Comunitario-UNEG%20Ingenier%C3%ADa%20Inform%C3%A1tica-green.svg)](#equipo-de-desarrollo)

Plataforma web y PWA *offline-first* de código abierto para la gestión integral, automatización y optimización de los flujos académicos, administrativos, estudiantiles, de orientación, pasantías y biblioteca de la **E.T.C. "Andrés Bello"** (~1.300 estudiantes, 1.º a 6.º año en menciones técnicas de **Telemática**, **Aduanas** y **Turismo**), alineada con los estándares y formatos oficiales del **MPPE** y **CDCE**.

---

## Estado Actual del Proyecto

> **Fase Actual: En Construcción — Desarrollo Activo e Implementación Modular (`Pre-Alpha`)**  
> La etapa de arquitectura inicial y provisión de base de datos ha concluido. El repositorio se encuentra actualmente en **fase de construcción iterativa** por parte del equipo de desarrollo, con el núcleo de autenticación, seguridad y el primer módulo operativo ya implementados.

### Avance de Implementación (Hitos Completados vs. En Curso)

| Capa / Módulo | Estado | Detalle técnico implementado |
| :--- | :--- | :--- |
| **Base de Datos y Seguridad (Supabase)** | Completado (Baseline) | Esquema relacional DDL (`00001_initial_baseline.sql`), catálogos base, políticas **RLS** multi-rol, RPCs `SECURITY DEFINER` y tipado sincronizado (`database.types.ts`). |
| **Landing Institucional y Autenticación** | Completado | Portada propia (`/`), acceso con Google Workspace (`@etcandresbello.org`) y credenciales con verificación estricta *fail-closed* contra matrícula y roles. |
| **Shell Privado y Sistema Visual** | Completado | Contenedor compartido `(dashboard)` con *Curved Glass Sidebar*, personalizador Glassmorphism en vivo, tema claro/oscuro, pantallas globales de carga y error. |
| **Módulo de Estudiantes (`/estudiante`)** | En Construcción (Base Operativa) | Dashboard principal con indicadores reales bajo RLS, agenda semanal interactiva y bloque `SigaAnalyticsBento` (curva MPPE, ondas, treemap curricular y radar). |
| **Docente, Control de Estudios y Dirección** | En Desarrollo Paralelo | Rutas base y plantillas por rol (`/docente`, `/control-estudios`, `/analitica`, `/orientacion`, `/pasantias`, `/biblioteca`, `/representante`) listas para implementación funcional del equipo. |
| **IA, PDFs Client-Side y PWA Offline** | Planificado | Integración pendiente de Gemini 2.5 Flash, generación PDF (`@react-pdf/renderer`) y cola de sincronización offline (`@serwist/next` + `IndexedDB`). |

El sistema está siendo diseñado por estudiantes de **Ingeniería Informática de la Universidad Nacional Experimental de Guayana (UNEG)** como proyecto de Servicio Comunitario, con el doble objetivo de digitalizar los procesos administrativos del plantel a costo cero y servir como arquitectura de referencia viva para cientos de estudiantes de bachillerato técnico de la mención **Telemática**.

---

## Tabla de Contenidos

1. [Arquitectura General y Stack Tecnológico](#arquitectura-general-y-stack-tecnológico)
2. [Módulos del Sistema](#módulos-del-sistema)
3. [Capa de Inteligencia Artificial y Automatizaciones](#capa-de-inteligencia-artificial-y-automatizaciones)
4. [Estrategia Offline-First y Almacenamiento Híbrido](#estrategia-offline-first-y-almacenamiento-híbrido)
5. [Seguridad, Auditoría e Integridad de Datos](#seguridad-auditoría-e-integridad-de-datos)
6. [Parametrización e Ingesta Inicial (Data Seeding)](#parametrización-e-ingesta-inicial-data-seeding)
7. [Despliegue, Observabilidad y Notificaciones](#despliegue-observabilidad-y-notificaciones)
8. [Patrocinadores y Aliados Tecnológicos](#patrocinadores-y-aliados-tecnológicos)
9. [Licencia y Código de Conducta](#licencia-y-código-de-conducta)

---

## Arquitectura General y Stack Tecnológico

SIGA adopta una arquitectura **monolítica *serverless* full-stack** sobre Next.js (App Router) con renderizado en servidor (SSR) para garantizar tiempos de carga óptimos en dispositivos móviles de gama baja y equipos antiguos, acoplada a un BaaS en PostgreSQL con soporte vectorial y en tiempo real.

### 1. Frontend & UI/UX
| Componente | Tecnología | Propósito Técnico |
| :--- | :--- | :--- |
| **Framework Principal** | **Next.js (App Router) + React + TypeScript** | SSR/RSC para bajo consumo de cliente y tipado estricto en desarrollo colaborativo. |
| **Estilos y Componentes** | **Tailwind CSS + shadcn/ui (Radix UI) + Lucide Icons** | Sistema de diseño accesible, personalizable y con soporte de tema claro/oscuro. |
| **Visualización y BI** | **Recharts / Tremor** | Gráficos de mapas de calor (*materias filtro*), barras de SLA docente y curvas de asistencia. |
| **Formularios y Validación** | **React Hook Form + Zod** | Validación isomórfica (cliente y servidor) para fichas socioeconómicas y cargas de notas (1–20 / A–E). |
| **Tablas Complejas** | **TanStack Table (React Table)** | Sábanas de notas y padrones de ~1.300 estudiantes con filtrado instantáneo, ordenamiento y exportación. |

### 2. Backend & Lógica de Servidor
| Componente | Tecnología | Propósito Técnico |
| :--- | :--- | :--- |
| **Runtime y Endpoints** | **Node.js (Next.js App Router) + Supabase Edge Functions (Deno)** | Next.js solo maneja sesión y variables de Supabase; toda orquestación sensible (Neon, cron, servicios externos) vive aislada en **Supabase Edge Functions**. |
| **Acceso a Datos / ORM** | **Prisma ORM o Drizzle ORM + `@supabase/supabase-js`** | Modelado relacional tipado, migraciones limpias y consultas nativas bajo RLS. |
| **Tareas Programadas (Cron)** | **`pg_cron` + `pg_net` / Edge Functions** | Ejecución asíncrona segura de respaldos hacia Neon, resúmenes semanales y limpieza de *branches*. |

### 3. Base de Datos, Respaldo Activo, Analítica y Tiempo Real (BaaS)
| Componente | Tecnología | Propósito Técnico |
| :--- | :--- | :--- |
| **Motor Relacional Principal** | **PostgreSQL (Supabase)** | Esquema académico, administrativo y multi-sede (*Multi-Tenant*) en producción. |
| **Respaldo Activo, Analítica y Labs** | **Neon (vía Supabase Edge Functions)** | Sistema de respaldo activo de Supabase, descarga de consultas pesadas de analítica/BI y *branching* instantáneo para prácticas SQL de **Telemática**, operado exclusivamente mediante **Supabase Edge Functions** sin exponer llaves de Neon en Next.js. |
| **Seguridad a Nivel de Fila** | **PostgreSQL Row Level Security (RLS)** | Aislamiento estricto por rol: estudiantes solo leen sus notas; docentes solo editan sus secciones asignadas. |
| **Autenticación** | **Supabase Auth / OAuth** | Cédula/Correo + contraseña, Google OAuth (`@etcandresbello.org`) y *Magic Links* sin registro para tutores externos. |
| **Base Vectorial (RAG)** | **Extensión `pgvector`** | Almacenamiento de *embeddings* de guías docentes y libros dentro del mismo PostgreSQL para el Tutor IA. |
| **Eventos en Tiempo Real** | **Supabase Realtime** | Actualización instantánea de notificaciones académicas, trámites y alertas escolares sin recargar. |

### 4. Almacenamiento Híbrido y Generación de Documentos
| Componente | Tecnología | Propósito Técnico |
| :--- | :--- | :--- |
| **Generación de PDFs** | **`@react-pdf/renderer` (Client-Side)** | Ensamblaje de boletines, constancias y formatos MPPE en el navegador (**0 MB** de almacenamiento/cómputo en servidor). |
| **Códigos QR** | **`qrcode.react` + `html5-qrcode`** | Emisión y lectura vía cámara móvil para carnets estudiantiles, asistencia, biblioteca y verificación de documentos. |
| **Hojas de Cálculo** | **SheetJS (`xlsx`)** | Importación masiva de matrícula y exportación de estadísticas oficiales para Zona Educativa / CDCE. |
| **Imágenes y Archivos** | **Supabase Storage / Cloudinary + `browser-image-compression`** | Compresión previa en cliente a formato `.webp` para fotos tipo carnet y portadas de biblioteca. |
| **Documentos Pesados** | **Google Drive API** | Almacenamiento de informes de pasantías en PDF de 6.º año fuera de la cuota de base de datos/storage transaccional. |

### 5. Capa de Inteligencia Artificial
| Componente | Tecnología | Propósito Técnico |
| :--- | :--- | :--- |
| **Orquestación LLM** | **Vercel AI SDK (`ai`)** | Respuestas en *streaming* para chats y salidas estructuradas en JSON. |
| **Modelo Multimodal** | **Google Gemini API (`@google/genai` — Gemini 2.5 Flash)** | OCR de documentos, generación de evaluaciones, revisión normativa, análisis predictivo y Tutor Socrático. |

---

## Módulos del Sistema

### 1. Control de Estudios y Secretaría (Administrativos)
- **Periodos y Mallas Curriculares Dinámicas:** Apertura/cierre de años escolares divididos en 3 Momentos Pedagógicos y configuración flexible de menciones técnicas (1.º a 3.º ciclo básico; 4.º a 6.º Telemática, Aduanas y Turismo).
- **Inscripción, Prosecución y Expediente Digital:** Registro de nuevos ingresos (1.er año) y prosecución automática (2.º a 6.º año) basada en reglas de prelación y materias aprobadas. Incluye ficha socioeconómica, médica/alergias, tallas y documentos digitalizados.
- **Motor de Calificaciones y Auditoría MPPE:**
  - Escala numérica (1–20) para áreas de formación y escala literal (`A`, `B`, `C`, `D`, `E`) para grupos CRP y Orientación y Convivencia.
  - Gestión automatizada de Materias Pendientes (4 momentos de prueba), revisiones/reparaciones, equivalencias y transferencias entre planteles.
  - Bloqueo automático de carga fuera de fecha límite y bitácora inmutable de cambios.
- **Emisión Instantánea de Documentos Oficiales:** Generación en 1 clic de Boletines, Constancias (Estudio, Buena Conducta, Inscripción, Culminación) y Formato Oficial MPPE de Certificación de Calificaciones con firma digital y código QR apuntando a una ruta pública de verificación.

### 2. Analítica Avanzada y Business Intelligence (Dirección)
- **Radar de Cuellos de Botella Operativos (SLA Tracker):**
  - *Semáforo de Carga Docente:* Porcentaje de avance en tiempo real por profesor, materia y sección para detectar retrasos en emisión de boletines.
  - *Monitor de Secretaría:* Tiempos de respuesta entre solicitud y aprobación de constancias/certificaciones.
  - *Detector de Colapso en Inscripciones:* Medición del tiempo promedio de atención por etapa presencial (revisión documental, entrevista, foto).
- **Auditoría de Rendimiento ("Materias Filtro"):** Mapas de calor estadísticos por sección y asignatura para detectar anomalías pedagógicas (ej. tasa de reprobación atípica en una sección frente a sus pares).
- **Reportes Oficiales Automatizados:** Exportación en Excel/PDF de matrícula inicial, ingresos, egresos, repitientes, aprobados y aplazados desagregados por sexo, edad, año y mención para Zona Educativa / CDCE.

### 3. Aula Virtual (LMS Integrado)
- **Matriculación Automática:** Al inscribir al estudiante en un año/mención, queda suscrito automáticamente a las aulas virtuales de todas sus asignaturas sin códigos de invitación.
- **Contenidos y Buzón de Tareas:** Publicación modular (PDFs, presentaciones, videos embebidos YouTube/Drive y fragmentos de código para Telemática) y entregas con fecha/hora de cierre estricta y detección de entregas tardías.
- **Motor de Evaluaciones Online:** Exámenes de selección simple, verdadero/falso, emparejamiento y desarrollo con límite de tiempo y aleatorización de preguntas. Sincronización automática de la nota obtenida hacia la planilla oficial de Control de Estudios.

### 4. Gestión de Biblioteca Escolar (Nativo en SIGA)
- Módulo propio integrado en SIGA para inventario bibliográfico digital con código QR por ejemplar, control de préstamos domiciliarios mediante el Carnet Digital estudiantil con alertas de vencimiento y gestión de reserva/entrega de equipos audiovisuales (videobeams, laptops, cornetas) para docentes.

### 4.1 Entornos Exclusivos por Mención Técnica (1.º a 6.º Año)
- **Telemática:** *Sandbox* de código y SQL apoyado en ramas aisladas (*branching*) sobre **Neon PostgreSQL Serverless**, herramientas prácticas de direccionamiento IP y cableado estructurado (T568A/B), y bitácora técnica de diagnóstico/mantenimiento del laboratorio TI.
- **Aduanas:** Simulador de clasificación arancelaria (Sistema Armonizado), calculadora de valoración aduanera (CIF/FOB, Incoterms y tributos) y taller documental con facturas comerciales, *Bill of Lading* (B/L) y guías aéreas.
- **Turismo:** Repositorio de rutas patrimoniales y ecoturísticas de Ciudad Guayana/Bolívar, gestor de eventos protocolares y ferias culturales/gastronómicas, y simulador de recepción hotelera (*check-in/check-out*) con guiones bilingües.

### 5. Coordinación de Pasantías y Servicio Comunitario (6.º Año)
- **CRM de Empresas Receptoras:** Directorio de instituciones y empresas aliadas con histórico de cupos por mención (Telemática, Aduanas, Turismo).
- **Documentación Masiva:** Generación en 1 clic de cartas de postulación, aceptación, actas de supervisión y planillas de evaluación.
- **Bitácora Semanal y Evaluación Externa (*Magic Link*):** Carga de avances y borradores de informe por el pasante; evaluación del tutor empresarial desde el móvil en ~2 minutos mediante enlace seguro enviado por correo o WhatsApp sin necesidad de crear cuenta.

### 6. Módulo Docente (Profesores y Coordinadores)
- **Planificación Académica:** Creación del Plan de Evaluación por momento pedagógico alineado al currículo MPPE.
- **Pase de Asistencia *Offline-First* y QR:** Toma de asistencia en ~30 segundos desde el móvil (con sincronización diferida ante fallas eléctricas o de red) o mediante escaneo del QR del carnet estudiantil.
- **Diario de Clases e Incidencias:** Registro de contenido por bloque horario, reporte inmediato de incidencias disciplinarias a Coordinación y notificación automática de inasistencia docente a alumnos/representantes.

### 7. Módulo de Estudiantes
- **Dashboard Gamificado:** Horario interactivo, calendario de evaluaciones, progreso del lapso e insignias por asistencia perfecta o excelencia académica.
- **Simulador "¿Cuánto necesito para aprobar?":** Cálculo dinámico del puntaje requerido en la próxima evaluación según notas acumuladas.
- **Carnet Digital Inteligente:** QR dinámico para control estudiantil, biblioteca y trámites internos.
- **Trámites Express:** Solicitud de constancias, solvencias y revisiones de notas con notificación de estado.

### 8. Módulo de Representantes (Padres y Madres)
- **Perfil Unificado Multi-Hijo:** Sesión única para supervisar a todos los representados inscritos en la institución.
- **Alertas Tempranas Inmediatas:** Notificaciones automáticas vía Push, Telegram o correo ante inasistencia a primera hora, remisión a Orientación o publicación de calificaciones.
- **Citaciones Digitales con Acuse de Recibo:** Registro exacto de fecha y hora de apertura de la citación en el dispositivo del representante.

### 9. Orientación y Psicopedagogía (Integrado en Control de Estudios y Seguimiento Estudiantil)
- **Expediente Confidencial de Orientación:** Registro cifrado e integrado a Control de Estudios/Coordinación para actas de compromiso, acuerdos de convivencia, vulnerabilidades socioeconómicas y seguimiento psicopedagógico con acceso restringido.

---

## Capa de Inteligencia Artificial y Automatizaciones

| Capacidad | Módulo | Implementación / Flujo Técnico |
| :--- | :--- | :--- |
| **Escáner OCR de Inscripción** | Control de Estudios | `Gemini 2.5 Flash` extrae nombres, apellidos, fecha de nacimiento y cédula desde fotos de C.I., partida de nacimiento o boletines externos para autocompletar formularios en ~3s. |
| **Alerta Temprana de Deserción** | BI / Orientación | Modelo predictivo que cruza inasistencias + caída de rendimiento (1.er a 2.º corte) + reportes de Orientación para emitir alertas semanales de riesgo crítico. |
| **Generador de Exámenes y Rúbricas** | Aula Virtual | Extracción de texto de guías PDF docentes para generar bancos de ~20 preguntas y rúbricas estructuradas en JSON. |
| **Pre-Evaluador y Detector de Plagio/IA** | Aula Virtual | Análisis de ensayos/informes, detección de archivos duplicados entre estudiantes y sugerencia preliminar de nota/retroalimentación según rúbrica. |
| **Tutor Socrático 24/7 (RAG)** | Aula Virtual | Chatbot en *streaming* (`Vercel AI SDK` + `pgvector`) restringido al contexto de las guías subidas por el profesor; guía paso a paso sin resolver la tarea. |
| **Matchmaking de Pasantías** | Pasantías | Algoritmo de emparejamiento que cruza geolocalización/dirección en Puerto Ordaz, promedio académico, habilidades técnicas y cupos por mención. |
| **Revisor Normativo de Informes** | Pasantías | Validación automatizada de borradores contra lineamientos de la E.T.C. Andrés Bello (tercera persona, tiempos verbales en pasado, estructura de capítulos y coherencia). |
| **Planificador y Observaciones Cualitativas** | Docente | Sugerencia de estrategias/indicadores sobre temas MPPE y redacción personalizada de observaciones para boletines a partir de notas y asistencia. |
| **Resumen Semanal para Representantes** | Representantes / Cron | Job programado (viernes 5:00 PM) que sintetiza asistencia, notas recientes, entregas y próximos exámenes en un resumen ejecutivo de 5 líneas. |

---

## Estrategia Offline-First y Almacenamiento Híbrido

### Resiliencia ante Fallas Eléctricas y de Conectividad
- **PWA Instalable (`@serwist/next`):** Instalación directa desde el navegador en Android, iOS y escritorio sin depender de tiendas de aplicaciones.
- **Caché y Sincronización Local:** Combinación de **TanStack Query** + **IndexedDB** (`idb-keyval` / `Dexie.js`). Permite registrar asistencia o calificaciones sin conexión eléctrica ni internet en el aula; las mutaciones se encolan en almacenamiento local y se sincronizan automáticamente con la nube al recuperar conectividad.

### Optimización de Cuotas y Ancho de Banda
1. **0 MB en PDFs oficiales:** Los reportes y certificaciones se renderizan íntegramente en el navegador del cliente mediante `@react-pdf/renderer` a partir de datos JSON consultados en PostgreSQL.
2. **Compresión de imágenes en cliente:** Las fotografías (carnets y portadas de biblioteca) se comprimen a `.webp` en el navegador (`browser-image-compression`) antes de enviarse a Storage/Cloudinary.
3. **Descarga de archivos pesados:** Los informes extensos de pasantías en PDF se enrutan directamente hacia el almacenamiento institucional mediante **Google Drive API**.

---

## Seguridad, Auditoría e Integridad de Datos

- **Control de Acceso en Base de Datos (RLS):** Políticas de *Row Level Security* en PostgreSQL garantizan que ninguna consulta o mutación pueda exponer o alterar registros fuera del alcance del rol autenticado.
- **Bitácora de Auditoría Inmutable:** Toda modificación de calificaciones registra identificador del usuario autor, valor anterior, valor nuevo, marca de tiempo exacta y dirección IP de origen, junto con bloqueo automático tras el cierre del periodo.
- **Verificación Anti-Forjamiento:** Cada documento PDF oficial incluye un hash/identificador único embebido en un código QR verificable públicamente por terceros (universidades o empresas) contra la aplicación.
- **Confidencialidad Clínica/Orientación:** Cifrado dedicado para actas de compromiso, vulnerabilidades socioeconómicas y registros psicopedagógicos.

---

## Parametrización e Ingesta Inicial (Data Seeding)

Para inicializar el entorno productivo y alimentar los motores de reglas, generación de documentos y prompts de IA, el sistema requiere los siguientes conjuntos de datos maestros:

1. **Configuración Institucional y Legal:**
   - Códigos oficiales ante MPPE (Código DEA `OD01340701`, Código de Dependencia) y RIF.
   - Credenciales y datos de autoridades firmantes (Director/a, Subdirectores Académico y Administrativo/Técnico, Coordinador/a de Control de Estudios) y decretos/resoluciones de nombramiento.
   - Activos gráficos oficiales (escudo/logo vectorial y cintillos MPPE/CDCE) y configuración de subdominio sobre `etcandresbello.org`.
2. **Núcleo Académico y Reglas de Negocio:**
   - Pensum vigente de 1.º a 6.º año (código oficial, nombre, abreviatura, horas semanales por mención).
   - Plantillas oficiales en blanco (Boletín de 1.º–3.er momento, Certificación de Calificaciones MPPE, Resumen Final, Constancias y Planilla de Inscripción/Socioeconómica).
   - Reglas de cálculo de promedios, redondeos, equivalencias literales (CRP / Orientación) y normativa de Materias Pendientes y revisiones.
3. **Semilla de Base de Datos (Importación vía SheetJS):**
   - Nómina de estudiantes (cédula de identidad/escolar, datos demográficos, año, sección, mención) y datos de representantes.
   - Plantilla de personal docente (carga académica por materia/sección), administrativo, coordinadores, orientadores y bibliotecarios.
   - Bloques horarios de clases y horarios por sección.
4. **Núcleo Técnico (Pasantías 6.º Año):**
   - Formatos de postulación, aceptación, actas de supervisión y rúbricas de evaluación empresarial.
   - Manual/normativa vigente del Informe de Pasantías (estructura de capítulos, márgenes y reglas de estilo para el revisor IA) y directorio histórico de empresas receptoras.
5. **Biblioteca Escolar:**
   - Inventario bibliográfico, reglas de préstamo domiciliario y catálogo de equipos audiovisuales.

---

## Despliegue, Observabilidad y Notificaciones

- **CI/CD y Control de Versiones:** Git & GitHub con flujos automatizados mediante **GitHub Actions** (incluyendo tareas programadas de mantenimiento y respaldo).
- **Hosting, Edge y Seguridad Perimetral:** Despliegue continuo en **Cloudflare Pages / Workers** (bajo **Project Galileo**) y **Netlify / Vercel**, conectado al dominio institucional `etcandresbello.org` con protección WAF y resolución **Cloudflare DNS**.
- **Monitoreo de Errores y Analítica de Producto:** **Sentry** para captura y trazabilidad en tiempo real de excepciones en cliente y servidor, junto a **PostHog** para analítica de uso, métricas de rendimiento y telemetría académica.
- **Canales de Mensajería y Alertas:**
  - **Correos Transaccionales:** **Mailtrap (Email Delivery API / SMTP)** + **React Email** (complementado por SMTP institucional de Google Workspace) para envío de boletines, notificaciones y recuperación de credenciales.
  - **Alertas Instantáneas:** **Telegram Bot API** para notificaciones en tiempo real hacia representantes y docentes, complementado con notificaciones Push web.

---

## Landing Page Propio y Estructura del Repositorio

SIGA cuenta con un **Landing Page propio** (`src/app/(landing)/`) diseñado específicamente para presentar la plataforma ante la comunidad educativa de la **E.T.C. "Andrés Bello"**, integrando identidad institucional, acceso por roles, verificador público QR, módulos por mención y patrocinadores tecnológicos.

- **Contexto institucional migrado:** [`docs/CONTEXTO_INSTITUCIONAL.md`](docs/CONTEXTO_INSTITUCIONAL.md)
- **Estructura de carpetas y rutas del stack:** [`docs/ESTRUCTURA_PROYECTO.md`](docs/ESTRUCTURA_PROYECTO.md)
- **Arquitectura híbrida Supabase + Neon (Edge Functions):** [`docs/ARQUITECTURA_SUPABASE_NEON.md`](docs/ARQUITECTURA_SUPABASE_NEON.md)

---

## Patrocinadores y Aliados Tecnológicos

Este proyecto educativo sin fines de lucro es posible gracias al apoyo de iniciativas de código abierto y programas educativos verificados en el portal institucional:

- **GitHub:** Control de versiones, repositorio *open source* y automatización CI/CD.
- **Cloudflare:** Aceleración global, protección WAF, DNS e infraestructura Edge para `etcandresbello.org`.
- **Supabase:** Base de datos PostgreSQL principal en tiempo real, autenticación estudiantil, RLS y `pgvector`.
- **Neon:** Respaldo activo de Supabase, consultas de analítica académica/BI sin sobrecargar producción y bases de datos *serverless* para los laboratorios de **Telemática**.
- **Google Workspace:** Identidad institucional (`@etcandresbello.org`), colaboración académica y almacenamiento documental.
- **Mailtrap:** Pruebas seguras y entrega confiable de correos transaccionales escolares.
- **PostHog:** Analítica de producto, métricas de rendimiento y telemetría académica de SIGA.
- **Figma:** Diseño de interfaces y prototipado UI/UX colaborativo.
- **Sentry:** Monitoreo de errores, trazabilidad y diagnóstico en tiempo real.
- **Hosting & Despliegue Open Source:** [This site is powered by Netlify](https://www.netlify.com) / Vercel.

---

## Equipo de Desarrollo

Proyecto desarrollado en el marco del **Servicio Comunitario de Ingeniería Informática** — **Universidad Nacional Experimental de Guayana (UNEG)**:

- **Jesús Colmenares** — Líder de Proyecto y Arquitectura Full-Stack
- **Yosdelis Rondón** — Desarrollo Frontend y Gestión Académica
- **Josiannis Villegas** — Desarrollo Backend, Datos y Documentación
- **Asesora Académica:** Prof. Dubraska Roca (UNEG)

---

## Licencia y Código de Conducta

- Este proyecto se distribuye bajo la **Licencia MIT**. Consulta el archivo [`LICENSE`](LICENSE) para más detalles.
- Para contribuir o participar en este repositorio, por favor revisa nuestro [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
