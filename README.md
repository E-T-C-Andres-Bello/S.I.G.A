# SIGA — Sistema Integral de Gestión Académica

**E.T.C. Andrés Bello**

Plataforma web y PWA *offline-first* para la gestión integral, automatización y optimización de los flujos académicos, administrativos, estudiantiles, de pasantías, biblioteca, comedor y mantenimiento operativo de la **E.T.C. Andrés Bello** (~1.300 estudiantes, 1.º a 6.º año en menciones técnicas de **Telemática**, **Aduanas** y **Turismo**), alineada con los estándares y formatos del **MPPE** y **CDCE**.

---

## Tabla de Contenidos

1. [Arquitectura General y Stack Tecnológico](#arquitectura-general-y-stack-tecnológico)
2. [Módulos del Sistema](#módulos-del-sistema)
3. [Capa de Inteligencia Artificial y Automatizaciones](#capa-de-inteligencia-artificial-y-automatizaciones)
4. [Estrategia Offline-First y Almacenamiento Híbrido](#estrategia-offline-first-y-almacenamiento-híbrido)
5. [Seguridad, Auditoría e Integridad de Datos](#seguridad-auditoría-e-integridad-de-datos)
6. [Parametrización e Ingesta Inicial (Data Seeding)](#parametrización-e-ingesta-inicial-data-seeding)
7. [Despliegue, Observabilidad y Notificaciones](#despliegue-observabilidad-y-notificaciones)

---

## Arquitectura General y Stack Tecnológico

SIGA adopta una arquitectura **monolítica *serverless* full-stack** sobre Next.js (App Router) con renderizado en servidor (SSR) para garantizar tiempos de carga óptimos en dispositivos móviles de gama baja y equipos antiguos, acoplada a un BaaS en PostgreSQL (Supabase) con soporte vectorial y en tiempo real.

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
| **Runtime y Endpoints** | **Node.js (Next.js Server Actions & Route Handlers)** | API REST y mutaciones *serverless* integradas sin servidor backend independiente. |
| **Acceso a Datos / ORM** | **Prisma ORM o Drizzle ORM + `@supabase/supabase-js`** | Modelado relacional tipado, migraciones limpias y consultas nativas a Supabase. |
| **Tareas Programadas (Cron)** | **Inngest / GitHub Actions** | Ejecución asíncrona de resúmenes semanales, alertas de biblioteca y *keep-alive* de BD. |

### 3. Base de Datos, Autenticación y Tiempo Real (BaaS)
| Componente | Tecnología | Propósito Técnico |
| :--- | :--- | :--- |
| **Motor Relacional** | **Supabase (PostgreSQL)** | Esquema académico, administrativo y multi-sede (*Multi-Tenant*). |
| **Seguridad a Nivel de Fila** | **PostgreSQL Row Level Security (RLS)** | Aislamiento estricto por rol: estudiantes solo leen sus notas; docentes solo editan sus secciones asignadas. |
| **Autenticación** | **Supabase Auth** | Cédula/Correo + contraseña, Google OAuth (`@etcandresbello.org`) y *Magic Links* sin registro para tutores externos. |
| **Base Vectorial (RAG)** | **Extensión `pgvector`** | Almacenamiento de *embeddings* de guías docentes y libros dentro del mismo PostgreSQL para el Tutor IA. |
| **Eventos en Tiempo Real** | **Supabase Realtime** | Actualización instantánea en pantalla de tickets de mantenimiento y alertas de portería sin recargar. |

### 4. Almacenamiento Híbrido y Generación de Documentos
| Componente | Tecnología | Propósito Técnico |
| :--- | :--- | :--- |
| **Generación de PDFs** | **`@react-pdf/renderer` (Client-Side)** | Ensamblaje de boletines, constancias y formatos MPPE en el navegador (**0 MB** de almacenamiento/cómputo en servidor). |
| **Códigos QR** | **`qrcode.react` + `html5-qrcode`** | Emisión y lectura vía cámara móvil para carnets, aulas/mantenimiento, biblioteca y verificación de documentos. |
| **Hojas de Cálculo** | **SheetJS (`xlsx`)** | Importación masiva de matrícula y exportación de estadísticas oficiales para Zona Educativa / CDCE. |
| **Imágenes y Archivos** | **Supabase Storage / Cloudinary + `browser-image-compression`** | Compresión previa en cliente a formato `.webp` para fotos tipo carnet, portadas y evidencias de averías. |
| **Documentos Pesados** | **Google Drive API** | Almacenamiento de informes de pasantías en PDF de 6.º año fuera de la cuota de base de datos/storage transaccional. |

### 5. Capa de Inteligencia Artificial y Voz
| Componente | Tecnología | Propósito Técnico |
| :--- | :--- | :--- |
| **Orquestación LLM** | **Vercel AI SDK (`ai`)** | Respuestas en *streaming* para chats y salidas estructuradas en JSON. |
| **Modelo Multimodal** | **Google Gemini API (`@google/genai` — Gemini 2.5 Flash)** | OCR de documentos, generación de evaluaciones, revisión normativa, visión artificial y Tutor Socrático. |
| **Voz a Texto (STT)** | **Web Speech API + Groq Cloud (`Whisper Large v3`)** | Transcripción de notas de voz para respuesta rápida de tickets por personal obrero y de vigilancia. |

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

### 4. Gestión de Biblioteca (Integración BookNest)
- Implementación de **BookNest** para inventario bibliográfico, control de préstamos domiciliarios con alertas de vencimiento y gestión de préstamos de equipos audiovisuales (videobeams, laptops, cornetas) para docentes.

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
- **Carnet Digital Inteligente:** QR dinámico para control de acceso al plantel, biblioteca y pases de salida.
- **Trámites Express:** Solicitud de constancias, solvencias y revisiones de notas con notificación de estado.

### 8. Módulo de Representantes (Padres y Madres)
- **Perfil Unificado Multi-Hijo:** Sesión única para supervisar a todos los representados inscritos en la institución.
- **Alertas Tempranas Inmediatas:** Notificaciones automáticas vía Push, Telegram o correo ante inasistencia a primera hora, remisión a Orientación o publicación de calificaciones.
- **Citaciones Digitales con Acuse de Recibo:** Registro exacto de fecha y hora de apertura de la citación en el dispositivo del representante.

### 9. Personal Obrero, Mantenimiento, Infraestructura y Vigilancia
- **Helpdesk por QR de Espacios:** Etiquetas QR en aulas, laboratorios, baños y talleres; cualquier docente escanea el espacio, selecciona la falla y adjunta fotografía.
- **Interfaz Móvil Simplificada:** Botones de alto contraste e ingreso de reportes/repuestos mediante notas de voz transcritas automáticamente.
- **Planificador de Guardias, Aseo e Insumos:** Rutinas diarias por áreas y control de inventario (cloro, desinfectante, escobas, bombillos, herramientas).
- **Control de Portería y Pases de Salida:** Emisión digital de autorización por Coordinación; el vigilante escanea el carnet del estudiante para validar en tiempo real la salida y la identidad del representante autorizado.

### 10. Bienestar Estudiantil, Orientación y PAE (Comedor)
- **Gestión Inteligente del PAE:** Control de inventario diario de alimentos (kg/litros de entrada y salida) y cálculo automático de raciones basado en la asistencia real registrada en la mañana para evitar mermas o desvíos.
- **Expediente Confidencial de Orientación:** Registro cifrado de actas de compromiso, acuerdos de convivencia, vulnerabilidades socioeconómicas y seguimiento psicopedagógico.

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
| **Clasificador Visual de Urgencias y STT** | Mantenimiento | Visión artificial (`Gemini 2.5 Flash`) clasifica fallas críticas/peligrosas desde la foto del ticket y dispara alertas inmediatas; `Web Speech API` + `Groq Whisper Large v3` transcribe notas de voz de obreros. |

---

## Estrategia Offline-First y Almacenamiento Híbrido

### Resiliencia ante Fallas Eléctricas y de Conectividad
- **PWA Instalable (`@serwist/next`):** Instalación directa desde el navegador en Android, iOS y escritorio sin depender de tiendas de aplicaciones.
- **Caché y Sincronización Local:** Combinación de **TanStack Query** + **IndexedDB** (`idb-keyval` / `Dexie.js`). Permite registrar asistencia o calificaciones sin conexión eléctrica ni internet en el aula; las mutaciones se encolan en almacenamiento local y se sincronizan automáticamente con Supabase al recuperar conectividad.

### Optimización de Cuotas y Ancho de Banda
1. **0 MB en PDFs oficiales:** Los reportes y certificaciones se renderizan íntegramente en el navegador del cliente mediante `@react-pdf/renderer` a partir de datos JSON consultados en PostgreSQL.
2. **Compresión de imágenes en cliente:** Las fotografías (carnets, portadas, reportes de fallas) se comprimen a `.webp` en el navegador (`browser-image-compression`) antes de enviarse a Supabase Storage / Cloudinary.
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
   - Códigos oficiales ante MPPE (Código DEA, Código de Dependencia), Código CNAE/PAE y RIF.
   - Credenciales y datos de autoridades firmantes (Director/a, Subdirectores Académico y Administrativo/Técnico, Coordinador/a de Control de Estudios) y decretos/resoluciones de nombramiento.
   - Activos gráficos oficiales (escudo/logo vectorial y cintillos MPPE/CDCE) y configuración de subdominio sobre `etcandresbello.org`.
2. **Núcleo Académico y Reglas de Negocio:**
   - Pensum vigente de 1.º a 6.º año (código oficial, nombre, abreviatura, horas semanales por mención).
   - Plantillas oficiales en blanco (Boletín de 1.º–3.er momento, Certificación de Calificaciones MPPE, Resumen Final, Constancias y Planilla de Inscripción/Socioeconómica).
   - Reglas de cálculo de promedios, redondeos, equivalencias literales (CRP / Orientación) y normativa de Materias Pendientes y revisiones.
3. **Semilla de Base de Datos (Importación vía SheetJS):**
   - Nómina de estudiantes (cédula de identidad/escolar, datos demográficos, año, sección, mención) y datos de representantes.
   - Plantilla de personal docente (carga académica por materia/sección), administrativo, coordinadores, bibliotecarios, personal PAE, vigilancia y obrero.
   - Bloques horarios de clases y horarios por sección.
4. **Núcleo Técnico (Pasantías 6.º Año):**
   - Formatos de postulación, aceptación, actas de supervisión y rúbricas de evaluación empresarial.
   - Manual/normativa vigente del Informe de Pasantías (estructura de capítulos, márgenes y reglas de estilo para el revisor IA) y directorio histórico de empresas receptoras.
5. **Infraestructura Física, Biblioteca y Comedor:**
   - Taxonomía/nomenclatura exacta de espacios físicos (aulas, laboratorios, talleres, baños, oficinas, canchas) para la generación masiva de etiquetas QR.
   - Inventario bibliográfico, reglas de préstamo y catálogo de equipos audiovisuales.
   - Estructura diaria de reporte PAE (almuerzos servidos, pesaje de insumos en kg/l, menú diario).

---

## Despliegue, Observabilidad y Notificaciones

- **CI/CD y Control de Versiones:** Git & GitHub con flujos automatizados mediante **GitHub Actions** (incluyendo tareas programadas de mantenimiento/respaldo).
- **Hosting y Red:** Despliegue continuo en **Vercel** conectado al dominio institucional `etcandresbello.org` bajo protección y resolución **Cloudflare DNS**.
- **Monitoreo de Errores:** **Sentry** integrado para captura y trazabilidad en tiempo real de excepciones en cliente y servidor.
- **Canales de Mensajería y Alertas:**
  - **Correos Transaccionales:** **Resend + React Email** (o **Nodemailer** vía SMTP institucional de Google Workspace) para envío masivo de boletines, notificaciones y recuperación de credenciales.
  - **Alertas Instantáneas:** **Telegram Bot API** para notificaciones en tiempo real hacia representantes y docentes, complementado con notificaciones Push web.
