# Propuesta S.I.G.A. — Sistema Integral de Gestión Académica

**Institución:** Escuela Técnica Comercial (E.T.C.) "Andrés Bello" (`etcandresbello.org`) — Código DEA: `OD01340701`  
**Ubicación:** Unare II, Puerto Ordaz, Municipio Caroní, Estado Bolívar, Venezuela

Aplicación web y PWA *offline-first* para la gestión, automatización y optimización integral de todos los flujos académicos, administrativos, estudiantiles, de biblioteca y pasantías presentes en la **E.T.C. "Andrés Bello"**. Integra en un solo sistema unificado los procesos de estudiantes, representantes, docentes, Control de Estudios, Orientación y Coordinación de Pasantías.

---

## Tabla de Contenidos

1. [Arquitectura de Módulos, Roles, Automatizaciones e IA](#1-arquitectura-de-módulos-roles-automatizaciones-e-ia)
2. [Entornos Exclusivos por Mención Técnica (1.º a 6.º Año)](#2-entornos-exclusivos-por-mención-técnica-1º-a-6º-año)
3. [Información y Datos Necesarios para la Implementación](#3-información-y-datos-necesarios-para-la-implementación)
4. [Gestión de Licencias y Patrocinios Tecnológicos](#4-gestión-de-licencias-y-patrocinios-tecnológicos)
5. [Stack Tecnológico de Desarrollo (Arquitectura del Sistema)](#5-stack-tecnológico-de-desarrollo-arquitectura-del-sistema)

---

## 1. Arquitectura de Módulos, Roles, Automatizaciones e IA

### 1.1 Módulo de Control de Estudios y Secretaría (Administrativos)

- **Gestión de periodos y mallas curriculares dinámicas:**
  - Apertura y cierre de años escolares divididos en los 3 Momentos Pedagógicos.
  - Configuración flexible de menciones técnicas (formación continua de 1.º a 6.º año en **Telemática**, **Aduanas** y **Turismo**).
- **Inscripción, Prosecución y Expediente Digital:**
  - Registro de nuevos ingresos (1.er año) y prosecución automática (2.º a 6.º año) según reglas de prelación y materias aprobadas.
  - Expediente digital completo: ficha socioeconómica, ficha médica/alergias, talla de uniforme/calzado y documentos digitalizados.
  - **IA — Escáner OCR de Documentos en Inscripción:** Cuando el representante sube una foto de la Cédula de Identidad, Partida de Nacimiento o Notas de otro colegio, la IA extrae automáticamente nombres, apellidos, fecha de nacimiento y número de cédula para llenar la planilla en ~3 segundos sin errores de tipeo.
- **Motor de Calificaciones y Auditoría MPPE:**
  - Escala del 1 al 20 para áreas de formación y literales (`A`, `B`, `C`, `D`, `E`) para grupos CRP y Orientación y Convivencia.
  - Control automático de Materias Pendientes (4 momentos de prueba), revisiones (reparaciones), equivalencias y transferencias entre planteles.
  - **Automatización:** Bloqueo automático de carga de notas fuera de fecha límite con bitácora de auditoría inmutable (quién cambió una nota, qué nota tenía antes, a qué hora y desde qué IP).
- **Emisión Instantánea de Documentos Oficiales (Con Firma Digital y QR Anti-Forjamiento):**
  - Generación en 1 clic de Boletines, Constancias de Estudio, Buena Conducta, Inscripción, Culminación y el Formato Oficial MPPE de Certificación de Calificaciones.
  - Cada PDF incluye un código QR único que, al ser escaneado por cualquier universidad o empresa, abre una ruta pública verificada de la aplicación (`/verificar`) indicando que el documento es 100% auténtico.

### 1.2 Módulo de Analítica Avanzada, Estadística y Detección de Cuellos de Botella (Business Intelligence)

*Diseñado para que Dirección y el personal administrativo detecten dónde se tranca el liceo en tiempo real.*

- **Radar de Cuellos de Botella Operativos (SLA Tracker):**
  - **Semáforo de Carga de Notas Docente:** Detecta en tiempo real qué profesores están retrasando la emisión de boletines porque aún no han subido el 100% de las notas del momento (muestra porcentaje de avance por profesor, materia y sección).
  - **Monitor de Tiempos de Respuesta de Secretaría:** Mide cuánto tiempo tarda Control de Estudios desde que un estudiante solicita una constancia/certificación hasta que se aprueba, detectando atascos administrativos en semanas pico.
  - **Detector de Colapso en Inscripciones:** Mide el tiempo promedio de atención por representante durante las jornadas presenciales de inscripción y alerta qué etapas del proceso (revisión de documentos, entrevista, foto) están generando colas.
- **IA — Sistema de Alerta Temprana de Deserción y Reprobación Escolar (Predictivo):**
  - Cruza automáticamente 3 variables: inasistencias + caída en notas del 1.er al 2.do corte + reportes en Orientación.
  - Genera un listado semanal de *"Estudiantes en Riesgo Crítico"* antes de que reprueben el año o abandonen el liceo, enviando una alerta automática a Coordinación y Orientación.
- **Auditoría de Rendimiento Académico ("Materias Filtro"):**
  - Mapas de calor que detectan anomalías estadísticas (por ejemplo, si en Matemática de 3.er Año Sección B reprobó el 75% del salón mientras que en las secciones A y C solo reprobó el 10%), marcando una alerta de cuello de botella pedagógico para Coordinación.
- **Generación Automática de Estadísticas para Zona Educativa / CDCE:**
  - Cuadros estadísticos listos en Excel/PDF de matrícula inicial, ingresos, egresos, repitientes, aprobados y aplazados por sexo, edad, año y mención.

### 1.3 Módulo de Aula Virtual (LMS Integrado + Tutor IA)

- **Aulas Digitales Automáticas:**
  - **Automatización:** Al inscribir a un alumno en un año y mención (ej. 4.º Año de Telemática), queda automáticamente matriculado en las aulas virtuales de todas sus materias sin códigos de invitación ni pasos manuales.
- **Gestión de Contenidos y Tareas:**
  - Publicación de módulos por tema: guías PDF, presentaciones, videos embebidos (YouTube/Drive) y fragmentos de código (ideal para la mención Telemática).
  - Buzón de entrega de tareas digitales con fecha/hora de cierre estricta y detector de entregas tardías.
- **Motor de Evaluaciones Online (Quizzes y Exámenes):**
  - Exámenes de selección simple, verdadero/falso, emparejamiento y desarrollo con límite de tiempo y preguntas barajadas aleatoriamente para evitar copias.
  - **Automatización:** Al terminar un examen online o calificar una tarea en el Aula Virtual, la nota se transfiere automáticamente a la planilla oficial de Control de Estudios (sin doble transcripción).
- **IA — Asistente Pedagógico para el Docente:**
  - **Generador de Exámenes y Rúbricas:** El profesor sube su guía en PDF (ej. *"Leyes de Aduanas en Venezuela"*) y la IA genera automáticamente un banco de 20 preguntas de examen o una rúbrica de evaluación lista para usar.
  - **Pre-Evaluador de Tareas y Detector de Plagio/IA:** La IA revisa los ensayos o informes subidos por los estudiantes, detecta si dos alumnos entregaron el mismo archivo cambiado de nombre y sugiere una calificación preliminar con retroalimentación basada en la rúbrica del profesor.
- **IA — Tutor Socrático Estudiantil 24/7:**
  - Dentro de cada aula virtual, el estudiante dispone de un chat con IA entrenado únicamente con las guías que subió su profesor (RAG). Si el alumno no entiende un ejercicio de programación, aduanas o contabilidad en su casa, el Tutor IA le explica paso a paso sin hacerle la tarea.

### 1.4 Módulo de Gestión de Biblioteca Escolar (Nativo en SIGA)

- **Inventario Bibliográfico Digital:** Catálogo centralizado integrado directamente en SIGA de libros, guías técnicas y proyectos de grado por mención, con búsqueda instantánea y código QR por ejemplar.
- **Control de Préstamos Domiciliarios:** Registro de préstamos y devoluciones mediante el Carnet Digital QR del estudiante, con alertas automáticas de vencimiento para alumnos y representantes.
- **Gestión de Equipos Audiovisuales:** Reserva y control de entrega/devolución de videobeams, laptops, cornetas y material didáctico para los docentes del plantel.

### 1.5 Módulo de Coordinación de Pasantías y Servicio Comunitario (Exclusivo Escuelas Técnicas / 6.º Año)

- **CRM de Empresas Aliadas en Ciudad Guayana:** Base de datos de empresas receptoras (CVG, Corpoelec, Seniat, Alcaldía, hoteles, clínicas, comercios) con cupos históricos por mención (Telemática, Aduanas, Turismo).
- **IA — Emparejador Inteligente (*Matchmaking*) de Pasantes:**
  - Asigna o sugiere la empresa ideal para cada alumno de 6.º año cruzando su dirección de habitación en Puerto Ordaz (para minimizar costos de traslado), su promedio de notas y sus habilidades técnicas.
- **Generación Masiva de Documentación:** Cartas de postulación, aceptación, actas de supervisión y planillas de evaluación del tutor empresarial en 1 clic.
- **Bitácora Semanal y Corrector IA del Informe de Pasantías:**
  - El estudiante sube sus avances semanales y su borrador de informe.
  - **IA — Revisor Normativo del Informe:** Antes de que el Tutor Académico invierta horas corrigiendo forma, la IA revisa el documento del alumno y señala incumplimientos de los lineamientos de la E.T.C. Andrés Bello (uso de primera persona en vez de tercera persona, verbos que no están en pasado, falta de capítulos o incoherencias de redacción).
- **Evaluación Externa sin Registro (*Magic Link*):** El Tutor Empresarial recibe un enlace seguro en su correo o WhatsApp donde evalúa al pasante desde su celular en ~2 minutos sin necesidad de crearse una cuenta en el sistema.

### 1.6 Módulo Docente (Profesores y Coordinadores)

- **Planificación Académica Asistida por IA:**
  - Creación del Plan de Evaluación por momento pedagógico.
  - **IA:** El profesor ingresa los temas del currículo del MPPE y la IA sugiere estrategias de evaluación dinámicas, indicadores y distribución de porcentajes.
- **Pase de Asistencia *Offline-First* (PWA) y por QR:**
  - El profesor pasa la lista desde su celular en ~30 segundos (incluso sin internet ni electricidad en el salón; se sincroniza automáticamente al recuperar señal) o escaneando el QR del carnet de los alumnos al entrar al aula.
- **Diario de Clases Digital e Incidencias:** Registro del contenido dictado en el bloque de horas y reporte inmediato de incidencias disciplinarias a Coordinación.
- **IA — Generador Automático de Observaciones Cualitativas para Boletines:**
  - Al final del lapso, la IA analiza las notas y asistencia de cada alumno y redacta un comentario pedagógico personalizado y respetuoso para el boletín.
- **Aviso de Inasistencia Docente:** Si el profesor tiene un inconveniente y no puede asistir, notifica dentro de la aplicación y el sistema avisa automáticamente a los representantes y alumnos afectados.

### 1.7 Módulo de Estudiantes

- **Dashboard Gamificado:** Horario interactivo, calendario de exámenes, progreso de notas del lapso y medallas por asistencia perfecta o excelencia académica.
- **Simulador "¿Cuánto necesito para aprobar?":** Calculadora integrada donde el alumno visualiza sus notas actuales y el sistema calcula exactamente cuántos puntos necesita en la próxima evaluación para aprobar o mantener su promedio.
- **Carnet Digital Inteligente (Con QR dinámico):** Para control de acceso estudiantil, uso de la Biblioteca y trámites internos.
- **Trámites Express:** Solicitud de constancias, solvencias o revisión de calificaciones desde el teléfono con notificación cuando estén listas.

### 1.8 Módulo de Representantes (Padres y Madres)

- **Perfil Unificado Multi-Hijo:** Un solo inicio de sesión para supervisar a todos sus representados inscritos en el plantel.
- **Automatización — Alertas Tempranas Inmediatas (Push / Telegram / Correo):**
  - Notificación automática si su hijo no entró a la primera hora de clases, si fue remitido a Orientación o cuando un profesor publica una nueva nota.
- **Citaciones Digitales con Confirmación de Lectura:** Si Coordinación cita al representante, el sistema registra la fecha y hora exacta en que el representante abrió la citación en su teléfono.
- **IA — Resumen Semanal para Padres Ocupados:** Todos los viernes a las 5:00 PM, el representante recibe un resumen ejecutivo de 5 líneas generado por IA con asistencia, notas recientes, entregas y próximos exámenes.

### 1.9 Orientación y Psicopedagogía (Integrado en Control de Estudios y Seguimiento Estudiantil)

- **Expediente Confidencial de Orientación y Psicopedagogía:**
  - Registro cifrado e integrado al seguimiento estudiantil de Control de Estudios y Coordinación, para actas de compromiso, acuerdos de convivencia, vulnerabilidades socioeconómicas y acompañamiento psicológico con acceso restringido exclusivamente al personal autorizado.

---

## 2. Entornos Exclusivos por Mención Técnica (1.º a 6.º Año)

Cada especialidad técnica de la **E.T.C. "Andrés Bello"** dispone de herramientas prácticas exclusivas integradas dentro del Aula Virtual y su panel de mención desde 1.º hasta 6.º año:

### 2.1 Mención Telemática (Exclusivo)
- **Sandbox de Código y Prácticas Técnicas:** Editor/visor interactivo para fragmentos de código, consultas SQL iniciales y ejercicios de lógica algorítmica directamente en el Aula Virtual.
- **Simulador de Redes y Cableado Estructurado:** Guías interactivas de direccionamiento IP, modelos OSI/TCP-IP y verificación de normas de ponchado `T568A/B`.
- **Bitácora Técnica del Laboratorio TI:** Registro guiado de diagnósticos de hardware, mantenimiento preventivo de equipos del plantel e historial de incidencias técnicas.

### 2.2 Mención Aduanas (Exclusivo)
- **Simulador de Clasificación Arancelaria:** Buscador práctico de partidas del Sistema Armonizado y consulta de nomenclaturas de mercancías para ejercicios académicos.
- **Calculadora de Valoración Aduanera y Tributos:** Herramienta paso a paso para cálculo de base imponible (`CIF`/`FOB`), Incoterms y aranceles *ad valorem*.
- **Taller Documental de Comercio Exterior:** Plantillas interactivas y casos prácticos con facturas comerciales, conocimientos de embarque (*Bill of Lading* B/L), guías aéreas y manifiestos de carga.

### 2.3 Mención Turismo (Exclusivo)
- **Repositorio y Planificador de Rutas Patrimoniales:** Fichas técnicas georreferenciadas de circuitos de Ciudad Guayana y Bolívar (Parque La Llovizna, Cachamay, Canaima, Orinoco) para diseño de recorridos ecoturísticos.
- **Gestor de Eventos, Protocolo y Muestras Culturales:** Planificación de ferias gastronómicas, actos cívicos, cronogramas protocolares y control de logística estudiantil.
- **Simulador de Recepción Hotelera y Guiones Bilingües:** Flujo práctico de reservas (*check-in*/*check-out*), cotización de paquetes turísticos y portafolio de guiones interpretativos en inglés turístico.

---

## 3. Información y Datos Necesarios para la Implementación

### 3.1 Datos Institucionales y Legales (Dirección del Plantel)
- **Códigos Oficiales ante el MPPE:** Código DEA (`OD01340701`), Código de Dependencia y RIF de la institución o Asociación Civil.
- **Datos de las Autoridades Firmantes:** Nombres completos, números de cédula y cargos exactos del Director(a), Subdirector(a) Académico, Subdirector(a) Administrativo/Técnico y Coordinador(a) de Control de Estudios, junto con decretos o resoluciones de nombramiento.
- **Identidad Visual Oficial:** Escudo/logo de la E.T.C. "Andrés Bello" (PNG/Vector) y cintillos oficiales del MPPE y CDCE.
- **Acceso Tecnológico:** Administración del dominio `etcandresbello.org` para configurar subdominios (`siga.etcandresbello.org` / `app.etcandresbello.org`) y cuentas institucionales.

### 3.2 Información de Control de Estudios y Evaluación (Núcleo Académico)
- **Pensum y Malla Curricular Vigente (1.º a 6.º Año):** Lista exacta de Áreas de Formación por año y mención (**Telemática**, **Aduanas** y **Turismo**), incluyendo código oficial, nombre completo, abreviatura y horas académicas semanales.
- **Formatos Oficiales en Blanco (Excel/Word):** Boletín Informativo (1.º, 2.º y 3.er momento), Formato MPPE de Certificación de Calificaciones y Resumen Final, Constancias (Estudio, Inscripción, Buena Conducta, Culminación) y planilla actual de Inscripción / Ficha Socioeconómica.
- **Reglas de Negocio y Evaluación:** Cálculo de promedios y redondeos por momento pedagógico, registro de CRP y Orientación y Convivencia (escala literal `A`–`E`), y normativa de Materias Pendientes y revisiones.

### 3.3 Datos de Matrícula y Personal (Semilla de Base de Datos)
- **Nómina de Estudiantes Actuales (Excel):** Cédula de identidad (o cédula escolar), nombres, apellidos, sexo, fecha de nacimiento, año, sección, mención y datos básicos de sus representantes.
- **Plantilla de Personal:** Docentes (cédula, correo, teléfono y carga académica por materia/sección), personal administrativo, coordinadores de año/mención, orientadores y bibliotecarios.
- **Horarios de Clases:** División de bloques horarios (7:00 AM – 3:30 PM, recreos, salida) y horarios por sección.

### 3.4 Coordinación de Pasantías y Núcleo Técnico (6.º Año)
- **Formatos del Departamento:** Modelos de Carta de Postulación, Carta de Aceptación, Acta de Supervisión del Tutor Académico y Planilla de Evaluación del Tutor Empresarial.
- **Manual o Normativa del Informe de Pasantías:** Estructura de capítulos, márgenes y reglas de redacción para parametrizar el Revisor Normativo con IA.
- **Directorio de Empresas:** Listado histórico de empresas e instituciones públicas/privadas de Ciudad Guayana receptoras de pasantes por mención.

### 3.5 Biblioteca Escolar
- **Biblioteca:** Inventario actual de libros, días de préstamo domiciliario y catálogo de equipos audiovisuales en calidad de préstamo para docentes.

---

## 4. Gestión de Licencias y Patrocinios Tecnológicos

### Nivel 1 — Programas Educativos K-12 Perpetuos
Al poseer el dominio institucional `etcandresbello.org` y el documento de adscripción al MPPE, estas plataformas ofrecen programas gratuitos permanentes para educación media/técnica:

| Tecnología / Plataforma | Plan Objetivo | Valor Comercial Aprox. | Uso en S.I.G.A. |
| :--- | :--- | :--- | :--- |
| **Google Workspace for Education** | *Education Fundamentals* | \$3,000+ / año *(Gratis perpetuo)* | 100 TB en nube para PDFs de pasantías, fotos y expedientes vía Google Drive API; correos `@etcandresbello.org` ilimitados; Google OAuth. |
| **GitHub Campus Program** | *GitHub Enterprise Cloud & Server* | \$21 / mes por usuario *(Gratis para escuelas)* | Repositorios privados/Enterprise del sistema, GitHub Actions ampliados para cron jobs/respaldos y GitHub Copilot Student para alumnos de Telemática. |
| **Microsoft 365 Education** | *Plan A1 para Instituciones* | \$36 / año por usuario *(Gratis para escuelas)* | 100 GB de OneDrive por usuario como respaldo secundario y suite Office Web integrada con el Aula Virtual. |

### Nivel 2 — Programas Educativos y Open Source Confirmados / Aplicables
- **Cloudflare (Proyecto Galileo):** Protección WAF perimetral, aceleración global, DNS y seguridad web oficial para `etcandresbello.org`.
- **Sentry (Sponsored Non-Profit & Education):** Monitoreo de errores y trazabilidad en tiempo real en cliente y servidor.
- **PostHog (Analítica Open Source / Producto):** Analítica de uso, métricas de rendimiento y telemetría académica de S.I.G.A.
- **Figma for Education (Plan Professional Gratis K12):** Diseño colaborativo de interfaces UI/UX e historial de versiones ilimitado.
- **JetBrains Classroom Licenses:** Suite de IDEs (WebStorm, DataGrip, IntelliJ, PyCharm) con *Floating License Server* para los laboratorios de Telemática y el equipo de desarrollo.
- **1Password / Bitwarden (Educación / Open Source):** Bóveda auditable de contraseñas, claves API y accesos institucionales.

### Nivel 3 — Plataformas Cloud, Base de Datos, Correo e IA (Planes Pro / Créditos Educativos)
- **Vercel / Netlify (Open Source / Education):** Despliegue continuo sin cuellos de botella en picos de inscripción y entrega de boletines.
- **Supabase / Neon.tech (Grant Educativo / Pro):** PostgreSQL administrado con mayor capacidad, copias de seguridad automáticas y sin pausa por inactividad.
- **Mailtrap / Resend (Patrocinio Educativo):** Pruebas seguras (Sandbox) y envío transaccional masivo de boletines, alertas y recuperación de contraseñas.
- **Cloudinary / UploadThing (Nonprofit / Education):** Almacenamiento y optimización automática de fotos tipo carnet y portadas de biblioteca.
- **Google Gemini API + Créditos Educativos (Anthropic / OpenAI / Groq):** Capa gratuita de Gemini 2.5 Flash y créditos académicos para potenciar el Tutor Socrático IA, OCR, análisis predictivo y revisión normativa.

---

## 5. Stack Tecnológico de Desarrollo (Arquitectura del Sistema)

### 5.1 Núcleo Frontend & UI/UX
- **Framework Principal:** **Next.js (App Router) + React + TypeScript** — Renderizado en servidor (SSR) para carga rápida en teléfonos de gama baja o computadoras antiguas del plantel, con tipado estricto.
- **Estilos y Componentes UI:** **Tailwind CSS + shadcn/ui (Radix UI) + Lucide Icons** — Componentes accesibles, tema claro/oscuro y tokens alineados a la identidad de la E.T.C. Andrés Bello.
- **Gráficos y BI:** **Recharts / Tremor** — Mapas de calor de materias filtro, barras de avance docente y curvas de asistencia.
- **Formularios y Validación:** **React Hook Form + Zod** — Validación isomórfica (navegador y servidor) para fichas extensas y escalas de notas.
- **Tablas Complejas:** **TanStack Table (React Table)** — Sábanas de notas y padrones estudiantiles con filtros instantáneos, ordenamiento y exportación a Excel.

### 5.2 Núcleo Backend & Lógica de Servidor
- **Entorno de Ejecución:** **Node.js** integrado mediante **Next.js Server Actions & Route Handlers (API REST)** — Arquitectura *serverless* unificada.
- **ORM y Consultas:** **Prisma ORM o Drizzle ORM** junto con `@supabase/supabase-js`.
- **Tareas Programadas (Cron Jobs):** **Inngest o GitHub Actions** — Resúmenes semanales de IA a representantes, alertas de biblioteca y tareas programadas.

### 5.3 Base de Datos, Autenticación y Tiempo Real (BaaS)
- **Motor Principal:** **Supabase (PostgreSQL)** — Estructura relacional académica, administrativa y multi-sede (*Multi-Tenant*).
- **Seguridad de Datos:** **Row Level Security (RLS)** de PostgreSQL y RPCs `SECURITY DEFINER` con aislamiento estricto por rol y plantel.
- **Autenticación:** **Supabase Auth** — Inicio de sesión con Cédula/Correo y contraseña, **Google OAuth** (`@etcandresbello.org`) y **Magic Links** para tutores empresariales.
- **Vectores para IA:** Extensión **`pgvector`** dentro de PostgreSQL para almacenar fragmentos de guías y materiales del Tutor IA (RAG).
- **Tiempo Real:** **Supabase Realtime** para notificaciones académicas instantáneas, actualizaciones de trámites y alertas en vivo.

### 5.4 Almacenamiento Híbrido y Generación de Documentos
- **Generación de PDFs Oficiales:** **`@react-pdf/renderer` (Client-Side)** — Ensamblaje de boletines, constancias y formatos MPPE en el navegador (**0 MB** en servidor).
- **Códigos QR:** **`qrcode.react`** (generación) + **`html5-qrcode`** (escaneo desde cámara móvil para asistencia, biblioteca y verificación).
- **Hojas de Cálculo:** **SheetJS (`xlsx`)** para importación de matrícula y exportación estadística CDCE.
- **Imágenes y Archivos Pesados:** **Supabase Storage / Cloudinary** con compresión previa en cliente a `.webp` (`browser-image-compression`), más **Google Drive API** para informes pesados de pasantías.

### 5.5 Capa de Inteligencia Artificial
- **SDK de Integración:** **Vercel AI SDK (`ai`)** — Streaming en tiempo real y salidas estructuradas en JSON.
- **Motor IA Principal:** **Google Gemini API (`@google/genai` — Gemini 2.5 Flash)** — OCR de inscripción, generador de exámenes, revisor normativo de informes, análisis predictivo de deserción y Tutor Socrático 24/7.

### 5.6 Capacidad Offline-First y Móvil
- **PWA Instalable:** **`@serwist/next`** — Instalación directa en Android, iOS y escritorio sin tiendas de aplicaciones.
- **Caché Local y Sincronización:** **TanStack Query + IndexedDB (`idb-keyval` o `Dexie.js`)** — Operación continua de asistencia y calificaciones ante cortes eléctricos o de internet, con sincronización automática al reconectar.

### 5.7 Despliegue, Observabilidad y Notificaciones
- **Control de Versiones y CI/CD:** **Git & GitHub + GitHub Actions**.
- **Hosting y Red:** **Vercel / Netlify / Cloudflare Pages** conectado a `etcandresbello.org` protegido por **Cloudflare DNS (Proyecto Galileo)**.
- **Observabilidad y Analítica:** **Sentry** (monitoreo de errores) + **PostHog** (analítica de producto y telemetría académica).
- **Correos y Alertas:** **Mailtrap / Resend + React Email** (o Nodemailer vía SMTP Google Workspace) + **Telegram Bot API** + Push Notifications.
