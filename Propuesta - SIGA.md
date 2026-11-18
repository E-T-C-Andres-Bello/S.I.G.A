# Propuesta Técnica y Funcional: S.I.G.A.
## Sistema Integral de Gestión Académica — E.T.C. "Andrés Bello"

**Institución:** Escuela Técnica Comercial "Andrés Bello" (Unare II, Puerto Ordaz, Estado Bolívar) · **Código DEA:** `OD01340701`  
**Alcance:** Ecosistema digital unificado (Web + PWA *Offline-First*) organizado estrictamente por perfiles de uso: **Alumnos**, **Docentes** y **Administración / Coordinaciones**.

---

## Tabla de Contenidos

1. [Sección Alumnos](#1-sección-alumnos)
2. [Sección Docentes](#2-sección-docentes)
3. [Sección Administración y Coordinaciones](#3-sección-administración-y-coordinaciones)
4. [Información y Datos Necesarios para la Implementación](#4-información-y-datos-necesarios-para-la-implementación)
5. [Stack Tecnológico y Arquitectura del Sistema](#5-stack-tecnológico-y-arquitectura-del-sistema)

---

## 1. Sección Alumnos

Módulos diseñados exclusivamente para la experiencia académica, práctica técnica y autogestión del estudiante (1.º a 6.º año). El acceso completo utiliza correo institucional **`@etcandresbello.org`** (permitiendo un ingreso inicial limitado por **Cédula** para alumnos recién inscritos mientras activan su cuenta Google Workspace y registran un correo personal únicamente para recuperación).

### 1.1 Portal del Estudiante y Simulador Académico
* **Dashboard Estudiantil Gamificado:** Visualización personalizada del horario de clases, calendario de evaluaciones, progreso acumulado por Momento Pedagógico y medallas por desempeño y asistencia.
* **Simulador *"¿Cuánto necesito para aprobar?"*:** Calculadora en tiempo real conectada a las evaluaciones cargadas del estudiante para proyectar la calificación requerida en las actividades restantes y aprobar cada asignatura.
* **Carnet Digital Inteligente con QR:** Identificación estudiantil digital en el teléfono con código QR dinámico y criptográfico para validar identidad en portón, biblioteca y actos académicos.
* **Trámites y Solicitudes Express:** Gestión en línea de solicitudes de constancias de estudio, solvencias administrativas y revisiones formales de calificaciones con seguimiento de estatus.

### 1.2 Aula Virtual Unificada (`/aula-virtual`) y Tutor Socrático IA
* **Campus Único Integrado dentro de S.I.G.A.:** Todos los estudiantes (1.º a 6.º año) y sus respectivos docentes confluyen en una misma plataforma (`/aula-virtual` y `/aula-virtual/[courseId]`), manteniendo una única sesión `@etcandresbello.org` sin portales externos separados.
* **Matriculación Automática:** Al completarse la inscripción oficial en el sistema, el estudiante queda inscrito automáticamente en los cursos virtuales de todas sus asignaturas según año, mención y sección.
* **Repositorio de Contenidos Modulares:** Acceso directo a guías de estudio en PDF, presentaciones, recursos multimedia y ejemplos de código publicados por sus docentes.
* **Buzón de Entregas y Evaluaciones Online:** Carga digital de tareas con control de fecha límite, realización de evaluaciones objetivas en línea y consulta inmediata de retroalimentación y calificaciones.
* **IA — Tutor Socrático 24/7 (RAG):** Asistente de estudio entrenado con las guías oficiales cargadas por cada profesor de la E.T.C. "Andrés Bello". No entrega respuestas directas ni resuelve tareas por el alumno; formula preguntas guía paso a paso para fortalecer la comprensión. *(Las orientaciones generadas por IA son de apoyo académico y nunca sustituyen la evaluación oficial del docente).*

### 1.3 Laboratorios Prácticos por Mención Técnica (Integrados en `/aula-virtual`)
Herramientas interactivas complementarias dentro del Aula Virtual, adaptadas al perfil profesional de cada mención de la escuela:

* **Telemática:**
  * *Sandbox de Práctica de Código y SQL:* Entorno interactivo de consultas y laboratorio SQL aislado sobre **Neon Serverless** con bases de datos sintéticas de práctica (sin acceso ni exposición a datos reales de producción).
  * *Simulador de Redes y Protocolos:* Ejercicios guiados de direccionamiento IP, cálculo de subredes, capas OSI/TCP-IP y estándares de cableado estructurado T568A/B.
  * *Bitácora Técnica de Ensamblaje y Soporte TI:* Registro académico de prácticas de diagnóstico de hardware, redes e instalación de sistemas en el laboratorio de Telemática.
* **Aduanas:**
  * *Módulo de Clasificación Arancelaria:* Práctica de ubicación y análisis de códigos de mercancías bajo la nomenclatura del Sistema Armonizado.
  * *Calculadora de Costos y Valoración:* Simulador práctico de cálculo CIF/FOB, seguros, fletes y aplicación de Incoterms en operaciones de comercio exterior.
  * *Taller Documental:* Llenado guiado de formularios digitales modelo de conocimientos de embarque (*Bill of Lading*), guías aéreas y declaraciones aduanales.
* **Turismo:**
  * *Repositorio y Planificador de Rutas Patrimoniales:* Catálogo didáctico y diseño de itinerarios históricos, ecológicos y culturales de Ciudad Guayana y el Estado Bolívar.
  * *Gestor de Eventos y Protocolo:* Plantillas interactivas de planificación logística, presupuestos académicos y etiqueta ceremonial para proyectos de evento.
  * *Simulador de Recepción Hotelera y Guiones Bilingües:* Práctica de fichas de *check-in / check-out*, atención al visitante y guiones turísticos bilingües.

### 1.4 Biblioteca Escolar (Vista Estudiante)
* **Catálogo Digital de Libros y Proyectos:** Búsqueda por título, autor, área técnica o palabra clave de textos escolares y proyectos socioproductivos disponibles en la institución.
* **Préstamos y Alertas de Vencimiento:** Solicitud y registro de préstamos domiciliarios vinculados al Carnet Digital QR, con recordatorios automáticos previos a la fecha de devolución.

### 1.5 Portal del Pasante (6.º Año)
* **Bitácora Semanal del Pasante:** Registro estructurado desde el portal del estudiante de las horas cumplidas y actividades técnicas ejecutadas en su empresa receptora.
* **Carga y Pre-Revisión del Informe Final:** Subida de borradores del informe de pasantías para revisión de su tutor académico.
* **IA — Revisor Normativo del Informe de Pasantías:** Análisis automático del borrador antes de entregarlo al tutor para señalar desvíos de redacción en tercera persona, tiempos verbales en pasado y estructura formal exigida.

### 1.6 Bandeja de Notificaciones Internas
* **Avisos Académicos y de Trámites (In-App + Correo):** Notificaciones dentro de la plataforma y al correo registrado sobre calificaciones publicadas, evaluaciones próximas, estatus de trámites y vencimientos de biblioteca.

---

## 2. Sección Docentes

Módulos dedicados exclusivamente a la labor pedagógica, control de aula, evaluación y seguimiento académico por parte del profesorado.

### 2.1 Planificación Académica y Control de Aula
* **Planificación Académica Asistida por IA:** Estructuración rápida de planes de lapso, estrategias metodológicas e indicadores evaluativos alineados al currículo nacional del MPPE.
* **Pase de Asistencia *Offline-First* (PWA) y QR:** Registro de asistencia en aula desde celular o tableta incluso sin conexión a internet en el salón, con soporte para escaneo rápido de Carnet QR estudiantil y sincronización automática al recuperar señal.
* **Diario de Clases e Incidencias:** Registro digital del contenido impartido por bloque de hora y reporte formal de novedades de aula hacia Coordinación u Orientación.
* **Aviso de Inasistencia Docente:** Notificación previa desde el panel docente en caso de ausencia justificada para activar oportunamente la reorganización de bloques horarios en Coordinación.

### 2.2 Aula Virtual Unificada (`/aula-virtual`), Evaluaciones y Carga Directa de Notas
* **Gestión de Cursos por Sección y Materia:** Dentro del mismo espacio `/aula-virtual`, el profesor administra exclusivamente sus materias y secciones asignadas con publicación modular de guías, materiales multimedia y asignaciones con fechas de cierre y marcación automática de entregas tardías.
* **Motor de Evaluaciones con Sincronización a Planilla:** Creación de pruebas objetivas (selección simple/múltiple y verdadero/falso) con calificación instantánea y transferencia directa al libro de notas oficial del lapso, eliminando la doble transcripción manual.
* **Entornos Prácticos por Mención:** Publicación de ejercicios, rúbricas y casos prácticos para las secciones asignadas de Telemática, Aduanas y Turismo.
* **IA — Asistente Pedagógico Docente:**
  * *Generador de Exámenes y Rúbricas:* Propuesta de bancos de preguntas y criterios de evaluación a partir de guías PDF cargadas por el docente.
  * *Pre-Evaluador de Entregas y Detector de Similitudes:* Sugerencia de calificación basada en rúbricas previas y detección de entregas duplicadas o indicios de plagio antes de la validación final del profesor.

### 2.3 Cierre de Momentos Pedagógicos y Tutoría de Pasantías
* **IA — Generador de Observaciones Cualitativas:** Redacción sugerida de observaciones personalizadas para los boletines de cierre de momento, redactadas a partir del histórico real de notas, asistencia y entregas de cada estudiante para su aprobación docente.
* **Supervisión de Pasantes (Tutor Académico):** Seguimiento de la bitácora semanal de sus estudiantes asignados en 6.º año, revisión de avances del informe pre-validado por el Revisor Normativo IA y aprobación académica final.

### 2.4 Reserva de Recursos Audiovisuales
* **Agenda de Equipos Didácticos:** Solicitud y reserva por bloque de horario de videobeams, laptops, equipos de sonido y material didáctico administrados por Biblioteca para el desarrollo de clases.

---

## 3. Sección Administración y Coordinaciones

Módulos exclusivos de gestión institucional, control normativo MPPE, auditoría, orientación y vinculación empresarial para **Dirección**, **Coordinación de Mención (*Telemática*, *Aduanas*, *Turismo*)**, **Control de Estudios y Secretaría**, **Orientación y Psicopedagogía**, **Coordinación de Pasantías** y **Administración de Biblioteca** (gestionados mediante un sistema multi-rol con tabla exclusiva de `roles` que permite combinar funciones, por ejemplo Docente + Coordinador).

### 3.1 Dirección y Analítica Avanzada (BI)
* **Radar de Cuellos de Botella Operativos (SLA):**
  * *Semáforo de Carga Docente:* Monitoreo en tiempo real del porcentaje de notas y planillas cargadas por sección previo al cierre de cada momento.
  * *Monitor de Tiempos de Secretaría:* Medición del tiempo de respuesta desde que ingresa una solicitud de constancia o certificación hasta su emisión digital.
  * *Detector de Saturación en Inscripciones:* Identificación automática de las etapas con mayor demora o congestión durante las jornadas de inscripción.
* **Auditoría de Rendimiento ("Materias Filtro"):** Detección automatizada de asignaturas y secciones con mayor índice de reprobación o rezago académico para coordinar planes de nivelación.
* **IA — Alerta Temprana de Deserción y Riesgo Académico:** Detección proactiva de estudiantes en riesgo mediante análisis de variables académicas y de asistencia para activar intervención coordinada.
* **Reportes Estadísticos Oficiales (CDCE / Zona Educativa):** Generación automatizada de matrices estadísticas institucionales de matrícula, prosecución, asistencia y rendimiento en formatos Excel y PDF listos para entrega ante el Centro de Desarrollo de la Calidad Educativa (CDCE) y Zona Educativa.

### 3.2 Control de Estudios y Secretaría
* **Arquitectura de Periodos y Mallas Curriculares:** Configuración oficial del año escolar (3 Momentos Pedagógicos) y mallas curriculares desde 1.º hasta 6.º año diferenciadas por mención técnica (*Telemática*, *Aduanas* y *Turismo*).
* **Inscripción, Prosecución Automática y Expediente Digital:** Proceso anual de inscripción y prosecución automática con expediente completo del estudiante (documentos de identidad, ficha socioeconómica, notas certificadas y recaudos digitales).
* **IA — Escáner OCR de Documentos:** Digitalización automática de cédulas de identidad, partidas de nacimiento y boletas de calificaciones en aproximadamente 3 segundos para autocompletar planillas de inscripción y reducir errores de transcripción.
* **Motor Normativo de Calificaciones MPPE:** Soporte nativo para escala numérica `1–20` y literales `A–E`, administración automatizada de **Materias Pendientes** (hasta 4 momentos reglamentarios), procesos de revisión y equivalencias por traslado.
* **Cierre de Ventanas y Auditoría Inmutable:** Bloqueo automático de edición de notas tras finalizar el plazo de cada momento, exigiendo autorización formal de reapertura y dejando registro inmutable (usuario, fecha, hora y valor anterior/nuevo) en bitácora de auditoría.
* **Emisión PDF Oficial y Verificación QR (`/verificar`):** Generación en 1 clic de Boletines de Lapso, Constancias de Estudio/Inscripción y Certificaciones de Notas MPPE en PDF con código QR criptográfico de autenticidad verificable públicamente en la ruta `/verificar`.

### 3.3 Orientación y Psicopedagogía
* **Expediente Confidencial Cifrado:** Módulo de acceso estrictamente restringido mediante Row Level Security (RLS) por rol, separado de la vista académica ordinaria.
* **Gestión de Actas y Seguimiento Psicosocial:** Registro cifrado de actas de compromiso, acuerdos de convivencia escolar, factores de vulnerabilidad socioeconómica y evolución del acompañamiento psicopedagógico en articulación controlada con Dirección y Control de Estudios.

### 3.4 Coordinación de Pasantías y Servicio Comunitario (6.º Año)
* **CRM de Empresas Receptoras:** Base de datos institucional de empresas públicas y privadas de Ciudad Guayana (sector industrial, aduanero, tecnológico y turístico) con cupos disponibles, historial de pasantes y tutores empresariales registrados.
* **IA — Matchmaking de Ubicación:** Algoritmo de emparejamiento asistido que cruza mención técnica, dirección de residencia en Puerto Ordaz, rendimiento académico y habilidades del estudiante para recomendar las empresas idóneas.
* **Documentación Masiva en 1 Clic:** Emisión por lotes de Cartas de Postulación, Cartas de Aceptación, Actas de Compromiso y Planillas de Evaluación con firma digital institucional y código QR verificable.
* **Evaluación Externa por *Magic Link*:** Envío al tutor empresarial de un enlace seguro de un solo uso y tiempo limitado para completar la evaluación de desempeño del pasante en ~2 minutos desde su teléfono u oficina, sin requerir creación de cuenta ni contraseña.

### 3.5 Administración de Biblioteca Escolar
* **Inventario Bibliográfico con Etiquetado QR:** Registro y catalogación completa del fondo de libros, textos técnicos y proyectos de grado mediante etiquetas QR únicas por ejemplar.
* **Control de Préstamos y Solvencias:** Administración de salidas, devoluciones, prórrogas, historial de morosidad y emisión automática de solvencia bibliotecaria para trámites de egreso o inscripción.
* **Administración de Equipos Audiovisuales:** Gestión del inventario, disponibilidad por bloques y control de entrega/recepción de equipos didácticos reservados por los docentes.

---

## 4. Información y Datos Necesarios para la Implementación

Para la puesta en marcha inicial en la institución se requiere recopilar y validar únicamente la información operativa de gestión académica:

### 4.1 Datos Institucionales y Curriculares
* **Identidad Oficial:** Escudo oficial en alta resolución, Código DEA (`OD01340701`), RIF institucional, código estadístico, circuito educativo, dirección oficial y firma/sello digitalizado de Dirección y Control de Estudios.
* **Mallas Curriculares Oficiales:** Listado de asignaturas vigentes desde 1.º hasta 6.º año por cada mención (*Telemática*, *Aduanas*, *Turismo*) con horas semanales y códigos internos.
* **Reglamento Interno de Evaluación:** Parámetros de aproximación decimal, fechas oficiales de cierre de cada Momento Pedagógico y formatos oficiales de constancias y certificados.

### 4.2 Matrícula y Personal (Datos Iniciales de Carga)
* **Nómina de Personal:** Listado de directivos, coordinadores, orientadores, bibliotecarios y docentes con su cédula, correo institucional/personal, cargo, asignaturas y secciones asignadas.
* **Matrícula Estudiantil y Contacto de Emergencia:** Relación inicial de estudiantes (cédula escolar o de identidad, año, mención, sección, correo institucional/recuperación) junto con los datos de contacto de emergencia/representante legal resguardados en su ficha administrativa. *(Nota: el repositorio público en Git solo aloja datos sintéticos; los datos reales se cargan exclusivamente en el entorno privado de producción).*

### 4.3 Pasantías y Biblioteca
* **Directorio Empresarial:** Listado de empresas aliadas de Ciudad Guayana que reciben pasantes de 6.º año, incluyendo razón social, ramo, persona contacto y cupos habituales por mención.
* **Catálogo Inicial de Biblioteca:** Inventario base de libros de texto, obras de consulta, proyectos de grado archivados y listado de equipos audiovisuales disponibles para reserva docente.

---

## 5. Stack Tecnológico y Arquitectura del Sistema

Arquitectura diseñada bajo principios de **cero costos fijos de servidor innecesarios**, **aislamiento estricto de credenciales**, **operación *Offline-First*** ante fallas de conectividad y **respaldo activo redundante**.

* **Frontend y Experiencia PWA:**
  * **Next.js 15 (App Router)** + **React 19** + **TypeScript (`strict: true`)**.
  * **Tailwind CSS v4** + **shadcn/ui** + **Lucide Icons** para una interfaz accesible, rápida y coherente.
  * **Soporte PWA *Offline-First* (Service Workers + IndexedDB):** Garantiza que el pase de asistencia en aula y consultas básicas operen aun sin conexión temporal en los salones.
* **Perímetro de Seguridad y Backend:**
  * **Next.js Server Actions / Route Handlers:** Contienen **únicamente** las variables públicas de **Supabase**, sin exponer llaves privadas de base de datos externa, IA ni servicios terceros en el entorno web del cliente.
  * **Supabase Edge Functions (Deno):** Concentran de forma aislada todas las llaves sensibles (`NEON_*`, proveedores de IA, mensajería y bots), actuando como única puerta autenticada hacia servicios externos.
* **Base de Datos Híbrida (Supabase + Neon):**
  * **Supabase (PostgreSQL Transaccional Primario — OLTP):** Fuente única de verdad en tiempo real para autenticación JWT/Cookies (`@supabase/ssr`), autorización granular con **Row Level Security (RLS)** multi-rol, **Realtime**, **Storage** y **`pgvector`** para búsqueda semántica del Tutor Socrático RAG.
  * **Neon (PostgreSQL Serverless — Secundario y Laboratorios):** Conectado **exclusivamente** a través de Supabase Edge Functions para cumplir tres funciones:
    1. **Respaldo Activo Redundante (`siga-vault-analytics`):** Sincronización incremental automática de respaldo y *snapshots* inmutables por Momento Pedagógico.
    2. **Descarga Analítica y BI:** Procesamiento pesado de estadísticas de deserción, "materias filtro", SLA operativos y reportes CDCE sin impactar el rendimiento transaccional de Supabase.
    3. **Laboratorios de Telemática (`siga-telematica-labs`):** Entornos SQL aislados con rol de base de datos restringido y datos 100 % sintéticos para las prácticas estudiantiles de 1.º a 6.º año.
* **Inteligencia Artificial:**
  * **Vercel AI SDK** conectado a **Gemini 2.5 Flash** (vía entorno protegido) para el Tutor Socrático RAG, escáner OCR de documentos, pre-revisión de informes de pasantías, alertas tempranas de deserción y asistencia pedagógica docente.
* **Emisión Documental y Verificación Pública:**
  * **`@react-pdf/renderer` (generación client-side):** Renderizado instantáneo en el navegador de Boletines, Constancias, Certificaciones MPPE y Cartas de Pasantía con **código QR verificable** en `/verificar`, sin sobrecargar memoria en el servidor.
