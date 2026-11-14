

Propuesto SIGA
Sistema Integral de Gestión Académica
E.T.C Andrés Bello

Aplicación para la gestión, automatización y optimización de todos los flujos presentes en
el  liceo E.T.C Andres  Bello.  Busca integrar  los  procesos estudiantiles (representante),
administrativos y obreros en un solo sistema completo.


















## ARQUITECTURA DE MÓDULOS, ROLES, AUTOMATIZACIONES E
## IA
MÓDULO DE CONTROL DE ESTUDIOS Y SECRETARIA (Administrativos)
- Gestión de periodos y mallas curriculares dinámicas:
o Apertura  y  cierre  de  años  escolares  divididos  en  los  3 Momentos
## Pedagógicos.
o Configuración flexible de menciones técnicas.
- Inscripción, Prosecución y Expediente Digital:
o Registro de nuevos ingresos 1er año y prosecución automática (2 a 6to año)
según reglas de prelación y materias aprobadas.
o Expediente digital completo: Ficha socioeconómica, ficha medica/alergias,
talla de uniforme/calcado y documentos digitalizados.
▪ IA - Escáner  OCR  de  Documentos  en  Inscripción: Cuando  el
representante sube una foto de la Cédula de Identidad, Partida de
Nacimiento o Notas de otro colegio, la IA extrae automáticamente
nombres, apellidos, fecha de nacimiento y número de cédula para
llenar la planilla en 3 segundos sin errores de tipeo.

- Motor de Calificaciones y Auditoria MPPE:
o Escala del 1 al 20 para áreas de formación y literales (A,B,C,D,E) para
grupos CRP, además de Orientación y Convivencia.
o Control automático de Materias Pendientes (4 momentos de prueba),
revisiones (reparaciones), equivalencias y transferencias entre planteles.
o Automatización: Bloqueo automático de carga de notas fuera de fecha
límite con bitácora de auditoría inmutable (quién cambió una nota, qué nota
tenía antes, a qué hora y desde qué IP).




- Emisión Instantánea de Documentos Oficiales (Con Firma Digital y QR Anti-
## Forjamiento):
o Generación en 1 clic de Boletines, Constancias de Estudio, Buena Conducta,
Inscripción, Culminación y el Formato Oficial MPPE de Certificación de
Calificaciones. Cada PDF incluye un código QR único que al ser escaneado
por cualquier universidad o empresa abre una ruta pública verificada de tu app
indicando que el documento es 100% auténtico

## MÓDULO DE ANALÍTICA AVANZADA, ESTADÍSTICA Y DETECCIÓN DE
## CUELLOS DE BOTELLA (BUSINESS INTELLIGENCE)
Diseñado para que Dirección y el personal administrativo detecten dónde se tranca el
liceo en tiempo real.
- Radar de Cuellos de Botella Operativos (SLA Tracker):
o Semáforo  de  Carga  de  Notas  Docente: Detecta  en  tiempo  real  qué
profesores están retrasando la emisión de boletines porque aún no han subido
el 100% de las notas del momento (muestra porcentaje de avance por profesor,
materia y sección).
o Monitor de Tiempos de Respuesta de Secretaría: Mide cuánto tiempo tarda
Control  de  Estudios  desde  que  un  estudiante  solicita  una
constancia/certificación  hasta  que  se  aprueba,  detectando  atascos
administrativos en semanas pico.
o Detector de Colapso en Inscripciones: Mide el tiempo promedio de atención
por representante durante las jornadas presenciales de inscripción y alerta qué
etapas del proceso (revisión de documentos, entrevista, foto) están generando
colas



- IA - Sistema de Alerta Temprana de Deserción y Reprobación Escolar (Machine
## Learning / Predictivo):
o Cruza automáticamente 3 variables: Inasistencias + Caída en notas del 1.er
al 2.do corte + Reportes en Orientación.
o Genera un listado semanal de "Estudiantes en Riesgo Crítico" antes de que
reprueben el año o abandonen el liceo, enviando una alerta automática a
Coordinación y Orientación.

- Auditoría de Rendimiento Académico ("Materias Filtro"):
o Mapas  de  calor  que  detectan  anomalías  estadísticas:  por  ejemplo,  si  en
Matemática de 3.er Año Sección B reprobó el 75% del salón mientras que en
las secciones A y C solo reprobó el 10%, el sistema marca una alerta de cuello
de botella pedagógico para que Coordinación revise qué ocurre con esa
sección o docente.

- Generación Automática de Estadísticas para Zona Educativa / CDCE:
o Cuadros  estadísticos  listos  en  Excel/PDF  de  matrícula  inicial,  ingresos,
egresos, repitientes, aprobados y aplazados por sexo, edad, año y mención.










Módulo de Aula Virtual (LMS Integrado + Tutor IA)
## • Aulas Digitales Automáticas:
-   Automatización: Al inscribir a un alumno en 4.º Año de Telemática, queda
automáticamente matriculado en las aulas virtuales de todas sus materias sin códigos
de invitación ni pasos manuales.
- Gestión de Contenidos y Tareas:
o Publicación  de  módulos  por  tema:  guías  PDF,  presentaciones,  videos
embebidos (YouTube/Drive) y fragmentos de código (ideal para la mención
## Telemática).
o Buzón  de  entrega  de  tareas  digitales  con  fecha/hora  de  cierre  estricta  y
detector de entregas tardías.
- Motor de Evaluaciones Online (Quizzes y Exámenes):
o Exámenes de selección simple, verdadero/falso, emparejamiento y desarrollo
con límite de tiempo y preguntas barajadas aleatoriamente para evitar copias.
o Automatización: Al terminar un examen online o calificar una tarea en el
Aula Virtual, la nota se pasa sola a la planilla oficial de Control de Estudios
(el profesor no tiene que transcribir nada dos veces).
- IA - Asistente Pedagógico para el Docente:
o Generador de Exámenes y Rúbricas: El profesor sube su guía en PDF (ej.
"Leyes de Aduanas en Venezuela") y la IA le genera automáticamente un
banco de 20 preguntas de examen o una rúbrica de evaluación lista para usar.
o Pre-Evaluador de Tareas y Detector de Plagio/IA: La IA revisa los ensayos
o informes subidos por los estudiantes, detecta si dos alumnos entregaron el
mismo archivo cambiado de nombre y sugiere una calificación preliminar con
retroalimentación basada en la rúbrica del profesor.
- IA - Tutor Socrático Estudiantil 24/7:
o Dentro de cada aula virtual, el estudiante tiene un chat con IA entrenado
únicamente con las guías que subió su profesor. Si el alumno no entiende
un ejercicio de programación o contabilidad a las 9:00 PM en su casa, el Tutor
IA le explica paso a paso sin hacerle la tarea.

## MÓDULO DE GESTIÓN DE BIBLIOTECA (IMPLEMENTACIÓN DE
## LA APLICACIÓN BOOKNEST)

## MÓDULO DE COORDINACIÓN DE PASANTÍAS Y SERVICIO
## COMUNITARIO (EXCLUSIVO ESCUELAS TÉCNICAS / 6.º AÑO)
- CRM de Empresas Aliadas en Ciudad Guayana: Base de datos de empresas
receptoras (CVG, Corpoelec, Seniat, Alcaldía, hoteles, clínicas, comercios) con cupos
históricos por mención (Telemática, Aduanas, Turismo).
- IA - Emparejador Inteligente (Matchmaking) de Pasantes:
o Asigna o sugiere la empresa ideal para cada alumno de 6.º año cruzando su
dirección de habitación en Puerto Ordaz (para que le quede cerca y no gaste
tanto en pasaje), su promedio de notas y sus habilidades técnicas.
- Generación Masiva de Documentación: Cartas de postulación, aceptación, actas de
supervisión y planillas de evaluación del tutor empresarial en 1 clic.
- Bitácora Semanal y Corrector IA del Informe de Pasantías:
o El estudiante sube sus avances semanales y su borrador de informe.
o IA - Revisor Normativo del Informe: Antes de que el Tutor Académico
pierda horas corrigiendo forma, la IA revisa el documento del alumno y le
indica si incumple los Lineamientos de la E.T.C. Andrés Bello (uso de
primera persona en vez de tercera persona, verbos que no están en pasado,
falta de capítulos o incoherencias de redacción).
- Evaluación Externa sin Registro (Magic Link): El Tutor Empresarial recibe un
enlace seguro en su correo o WhatsApp donde evalúa al pasante desde su celular en
2 minutos sin necesidad de crearse una cuenta en el sistema.



## MÓDULO DOCENTE (PROFESORES Y COORDINADORES)
- Planificación Académica Asistida por IA:
o Creación del Plan de Evaluación por momento pedagógico.
o IA: El profesor ingresa los temas del currículo del MPPE y la IA le sugiere
estrategias  de  evaluación  dinámicas,  indicadores  y  distribución  de
porcentajes.
- Pase de Asistencia Offline-First (PWA) y por QR:
o El profesor pasa la lista desde su celular en 30 segundos (incluso sin internet
ni electricidad en el salón; se sincroniza sola al recuperar señal) o escaneando
el QR del carnet de los alumnos al entrar al aula.
- Diario de Clases Digital e Incidencias: Registro del contenido dictado en el bloque
de horas y reporte inmediato de incidencias disciplinarias a Coordinación.
-  IA - Generador Automático de Observaciones Cualitativas para Boletines:
o Al final del lapso, en vez de que el profesor escriba a mano 40 observaciones
iguales, la IA analiza las notas y asistencia de cada alumno y redacta un
comentario pedagógico personalizado y respetuoso para el boletín.
- Aviso de asistencia
o Si el profesor tiene un inconveniente y no se puede presentar, avisa dentro de
la aplicación y esta automáticamente avisa a los representantes/alumnos.







## MÓDULO DE ESTUDIANTES
- Dashboard Gamificado: Horario interactivo, calendario de exámenes, progreso de
notas del lapso y medallas por asistencia perfecta o excelencia académica.
- Simulador "¿Cuánto necesito para aprobar?": Calculadora integrada donde el
alumno ve sus notas actuales y el sistema le dice exactamente cuántos puntos necesita
sacar en la próxima evaluación para aprobar la materia o mantener su promedio.
- Carnet Digital Inteligente (Con QR dinámico): Para entrada al liceo, uso de la
Biblioteca etc.
- Trámites Express: Solicitud de constancias, solvencias o revisión de calificaciones
desde el teléfono con notificación cuando estén listas.

## MÓDULO DE REPRESENTANTES (PADRES Y MADRES)
- Perfil  Unificado  Multi-Hijo: Un  solo  inicio  de  sesión  para  ver  a  todos  sus
representados inscritos en el plantel.
- Automatización - Alertas Tempranas Inmediatas (Push / Telegram / Correo):
o Notificación automática si su hijo no entró a la primera hora de clases, si fue
remitido a Orientación o cuando un profesor publica una nueva nota.
- Citaciones  Digitales  con  Confirmación  de  Lectura: Si  Coordinación  cita  al
representante, el sistema registra la fecha y hora exacta en que el representante abrió
la citación en su teléfono (evitando la excusa de "mi hijo no me entregó el papelito").
-  IA - Resumen Semanal para Padres Ocupados: Todos los viernes a las 5:00 PM,
el representante recibe un resumen ejecutivo de 5 líneas generado por IA: "Esta
semana Jesús asistió los 5 días, sacó 18 en Redes, entregó su tarea de Aduanas y la
próxima semana tiene examen de Matemática el miércoles".



## MÓDULO DE PERSONAL OBRERO, MANTENIMIENTO,
## INFRAESTRUCTURA Y VIGILANCIA
- Helpdesk / Sistema de Tickets de Mantenimiento por QR en cada Aula:
o Cada salón, baño y laboratorio tiene pegada una etiqueta con un código QR.
Si se daña un ventilador, un pupitre o un tomacorriente, cualquier profesor
escanea el QR del salón, selecciona la falla y sube una foto.
o  IA - Clasificador de Urgencia por Visión Artificial: Al subir la foto del
daño (ej. un cable de alta tensión suelto o un bote de agua grande), la IA
clasifica  la  prioridad  como Crítica  /  Peligro y  alerta  de  inmediato  al
coordinador de mantenimiento y al obrero encargado.
- Interfaz Móvil Ultra-Sencilla para el Personal Obrero:
o Pantalla con botones grandes, iconos claros y notas de voz (para que el
trabajador no tenga que escribir textos largos; puede responder con un audio
que la IA transcribe a texto diciendo qué repuesto hace falta para arreglar la
falla).
- Planificador de Guardias, Limpieza e Inventario de Insumos:
o Rutinas diarias de aseo por áreas (pasillos, canchas, baños, oficinas) y control
de entrega de cloro, desinfectante, escobas, bombillos y herramientas.
- Control de Portería, Visitantes y Pases de Salida (Vigilancia):
o Cuando un estudiante se retira antes de la hora por cita médica, Coordinación
emite un Pase de Salida Digital. El vigilante en el portón escanea el carnet
del alumno y ve en verde que está autorizado a salir y con qué representante
se retira.




## MÓDULO DE BIENESTAR ESTUDIANTIL, ORIENTACIÓN Y PAE
## (COMEDOR)
- Gestión Inteligente del PAE (Programa de Alimentación Escolar):
o Control de inventario de alimentos (kilos de arroz, proteínas, verduras que
entran y salen por día) y cálculo automático de raciones según la asistencia
real de estudiantes que vinieron a clases esa mañana (evitando desperdicio o
desvío de insumos).
- Expediente Confidencial de Orientación y Psicopedagogía:
o Registro  encriptado  de  actas  de  compromiso,  acuerdos  de  convivencia,
vulnerabilidades socioeconómicas y seguimiento psicológico.















## INFORMACIÓN Y DATOS NECESARIOS PARA LA APLICACIÓN
- Datos Institucionales y Legales (Dirección del Plantel)
- Códigos Oficiales ante el MPPE:
o Código DEA (Estadístico) y Código de Dependencia.
o Código CNAE / PAE (para los reportes del comedor).
o RIF de la institución o Asociación Civil (si aplica).
- Datos de las Autoridades Firmantes:
o Nombres completos, números de cédula y cargos exactos del Director(a),
Subdirector(a)  Académico, Subdirector(a)  Administrativo/Técnico y
Coordinador(a) de Control de Estudios.
o Decretos o resoluciones de nombramiento (a veces se colocan al pie de las
certificaciones de notas).
## • Identidad Visual Oficial:
o Escudo  o  logo  de  la  E.T.C. Andrés  Bello  en  la  mejor  calidad  posible
(PNG/Vector) y el cintillo oficial actual del Ministerio del Poder Popular para
la Educación (MPPE) y del Centro de Desarrollo de la Calidad Educativa
## (CDCE).
## • Acceso Tecnológico Actual:
o Confirmar quién administra actualmente el dominio etcandresbello.org para
poder crear un subdominio para la aplicación (ej. sistema.etcandresbello.org
o app.etcandresbello.org) y gestionar las cuentas institucionales gratuitas.





- Información de Control de Estudios y Evaluación (El Núcleo Académico)
- Pensum y Malla Curricular Vigente (1.º a 6.º Año):
o Lista exacta de las Áreas de Formación (materias) por cada año (de 1.º a 3.er
año en ciclo básico técnico, y de 4.º a 6.º año divididas por Telemática,
Aduanas y Turismo).
o Código oficial, nombre completo, abreviatura y horas académicas semanales
de cada materia.
- Formatos Oficiales en Blanco (En Excel o Word):
o Formato exacto del Boletín Informativo de 1.º, 2.º y 3.er momento.
o Formato MPPE de Certificación de Calificaciones y Resumen Final de
## Rendimiento Estudiantil.
o Modelos de Constancia de Estudio, Constancia de Inscripción, Buena
Conducta y Culminación.
o Planilla física actual que usan para la Inscripción / Ficha Socioeconómica
(para  que  el  formulario  digital  de  tu  app  pida  exactamente  los  mismos
campos).
- Reglas de Negocio y Evaluación:
o Cómo calculan los promedios y redondeos en cada momento pedagógico.
o Cómo registran los Grupos de Creación, Recreación y Producción (CRP)
y Orientación y Convivencia (escala literal A-E y sus equivalencias).
o Reglas para Materias Pendientes (cuántos momentos de prueba tienen y
cómo se cargan las actas de revisión/reparación).




- Datos de Matrícula y Personal (Semilla de la Base de Datos)
- Nómina o Data de Estudiantes Actuales (en Excel):
o Cédula de identidad (o cédula escolar si algún alumno de 1.º año aún no tiene),
nombres, apellidos, sexo, fecha de nacimiento, año, sección y mención.
o Datos básicos de sus representantes (Cédula, nombre, teléfono y dirección).
- Plantilla de Personal (Docente, Administrativo y Obrero):
o Lista de profesores con su cédula, correo, teléfono y carga académica (qué
materias y a qué secciones les dan clase este año escolar).
o Lista  del  personal  administrativo,  coordinadores  de  año/mención,
bibliotecarios, cocineras de la patria (PAE), vigilantes y personal obrero.
- Horarios de Clases:
o Cómo están divididos los bloques de horas (ej. de 7:00 AM a 7:45 AM,
recreos, salida) y los horarios actuales por sección.
- Coordinación de Pasantías y Núcleo Técnico (6.º Año)
- Formatos del Departamento de Pasantías:
o Modelos  de Carta  de  Postulación, Carta  de  Aceptación, Acta  de
Supervisión  del Tutor Académico y Planilla  de  Evaluación  del Tutor
Empresarial (con los ítems exactos y el puntaje que evalúa la empresa).
- Manual o Normativa del Informe de Pasantías vigente:
o Estructura de capítulos, márgenes y reglas de redacción (esto alimentará el
prompt del Revisor con IA para que corrija los informes automáticamente).
- Directorio de Empresas:
o Lista de empresas e instituciones públicas/privadas de Ciudad Guayana donde
históricamente han enviado pasantes de Telemática, Aduanas y Turismo.


- Infraestructura Física, Biblioteca y Comedor (Mantenimiento y Servicios)
- Mapa / Nomenclatura de Espacios Físicos del Liceo:
o Cómo  llaman  exactamente  a  cada  espacio:  cuántos  salones  hay  y  su
numeración  (ej. Aula  1  a  la  24),  cuántos  laboratorios  de
Telemática/Informática,  talleres,  baños  (planta  baja,  piso  1,  piso  2,
hembras/varones), oficinas, canchas y áreas verdes. (Con esta lista ustedes
generarán los códigos QR para pegar en las puertas de cada salón).
## • Biblioteca:
o Cómo llevan actualmente el inventario de libros (si tienen algún cuaderno o
Excel),  cuántos  días  prestan  un  libro  para  llevar  a  casa  y  qué  equipos
audiovisuales  (videobeams,  laptops,  cornetas)  manejan  en  calidad  de
préstamo para los profesores.
- Comedor (PAE):
o Qué datos les exige reportar diariamente el ministerio o la coordinación del
PAE (cantidad de almuerzos servidos por día, pesaje de insumos recibidos en
kilos/litros, menú del día).










## GESTIÓN DE LICENCIAS Y PATROCINIOS TECNOLÓGICOS
Nivel 1: Estas plataformas cuentan con programas establecidos para instituciones de
educación media/técnica (K-12). Al poseer el dominio institucional etcandresbello.org y
el documento de adscripción al MPPE, la aprobación es prácticamente del 100% y perpetua.
## Tecnología /
## Plataforma
Plan de Pago
## Objetivo
## Valor
## Comercial
## Aprox.
¿Para qué nos sirve en el Sistema
Integral del Liceo?
## 1. Google
## Workspace
for Education
## Education
## Fundamentals
$3,000+ / año
(Gratis
perpetuo para
colegios)
- 100 TB de almacenamiento en la
nube para guardar todos los PDFs
de pasantías, fotos y expedientes de
la app vía Google Drive API.
## • Correos @etcandresbello.org
ilimitados para estudiantes y
profesores.
- Inicio de sesión seguro (Google
OAuth) y envío de correos
transaccionales sin límites.
- GitHub
## Campus
## Program
GitHub
## Enterprise
## Cloud & Server
$21 / mes por
cada usuario
(Gratis para la
escuela)
- Repositorios privados ilimitados
con funciones Enterprise para alojar
el código del sistema a nombre del
liceo.
- GitHub Actions con minutos
ampliados para correr las
automatizaciones (Cron Jobs de
alertas de inasistencia y respaldos
de BD).
- Acceso a GitHub Copilot Student
gratis para los alumnos de la
mención Telemática.
## 3. Microsoft
## 365
## Education
Plan A1 para
## Instituciones
$36 / año por
usuario
(Gratis para
escuelas)
- Licencia institucional para todo el
liceo con 100 GB de OneDrive
por usuario (sirve como respaldo
secundario en la nube para la base
de datos y biblioteca digital).
- Word, Excel y PowerPoint Web
oficial integrado con el Aula
## Virtual.
Opcionalmente se podría solicitar Canva For K12 pero no es “valido” para Venezuela

Nivel 2: Estas  empresas  tienen  formularios  específicos  para  escuelas  acreditadas  o
proyectos educativos sin fines de lucro. Además de servirles a ustedes para programar el
sistema como profesionales, le dejan un valor enorme a los laboratorios del liceo.
- JetBrains Classroom Licenses (WebStorm, DataGrip, IntelliJ, PyCharm):
o Qué es: La suite de entornos de desarrollo (IDEs) y gestión de bases de datos
más potente del mundo.
o Beneficio: Otorgan licencias 100% gratuitas renovables indefinidamente para
todas las computadoras de los laboratorios de Telemática del liceo y para el
equipo de desarrollo, incluyendo un Floating License Server que permite usar
los programas sin internet en los laboratorios del liceo.
- Sentry (Plan Team / Sponsored Non-Profit & Education):
o Qué es: El estándar de la industria para monitoreo de errores en tiempo real
en aplicaciones web.
o Beneficio: Si un representante o profesor intenta subir una nota y ocurre un
error en su celular, Sentry nos avisa al instante en qué línea de código falló.
Tienen programa de patrocinio gratuito para educación y código abierto.
- 1Password / Bitwarden para Educación / Open Source:
o Qué es: Bóveda de seguridad empresarial para guardar las contraseñas del
servidor, claves API de la IA, accesos a la base de datos y dominio del liceo.
o Beneficio: Evita que las claves del liceo se pierdan en un chat de WhatsApp,
permitiendo entregarle a la Dirección y al departamento de Telemática una
bóveda maestra auditable.
- Figma for Education (Plan Professional Gratis):
o Qué es: Herramienta colaborativa de diseño UI/UX.
o Beneficio: Desbloquea proyectos, páginas e historial de versiones ilimitados
gratis.

Nivel 3: Estas empresas cobran entre $20 y $100 al mes por sus planes Pro, pero
tienen presupuestos de Impacto Social / Educación / Open Source. Con enviarles un
correo formal desde una cuenta @etcandresbello.org (adjuntando una carta firmada
y sellada por el Director del liceo), tienes altas probabilidades de que te regalen el
Plan Pro o entre $500 y $3,600 en créditos anuales.
-  Vercel  (Objetivo:  Plan  Pro  Gratis  o  Vercel  Open  Source  /  Education
## Sponsorship)
- Por qué pedirlo: El plan gratuito (Hobby) de Vercel tiene límites de 4 horas de CPU
activa al mes y construye 1 despliegue a la vez. El Plan Pro ($20/mes + asientos)
elimina esos cuellos de botella, permite que varios compañeros desplieguen al mismo
tiempo y soporta picos altos de tráfico el día de entrega de boletines o inscripciones.
- Truco adicional: Si declaran el código base del proyecto del liceo bajo licencia Open
Source (MIT) en el GitHub institucional del Andrés Bello, pueden postular al Vercel
Open Source Program, el cual otorga $3,600 en créditos de Vercel y paquetes de
patrocinio.
- Neon.tech o Supabase (Objetivo: Plan Launch/Pro de Base de Datos)
- Por qué pedirlo:
o En Supabase, el Plan Pro ($25/mes) evita que la base de datos se pause a los
7 días de inactividad, sube el espacio de 500 MB a 8 GB y activa copias de
seguridad automáticas diarias (Backups).
o En Neon.tech, el plan pago amplía el almacenamiento de 1 GB a 10 GB+ y
permite restaurar la base de datos a cualquier segundo exacto del pasado si
alguien borra una sección por error.
- A  quién  escribirle: Al  correo  de  soporte/partnerships  (support@supabase.io /
sales@neon.tech) solicitando un Educational / Public School Grant para una escuela
técnica pública de 1.300 estudiantes en Venezuela.


- Resend (Objetivo: Plan Pro de Correos Transaccionales - $20/mes)
- Por qué pedirlo: Resend es la mejor plataforma moderna para enviar correos desde
Next.js (boletines, alertas de inasistencia a representantes, códigos de recuperación
de contraseña). El plan gratis da 3.000 correos al mes (100 por día), pero en semana
de entrega de boletines para 1.300 alumnos necesitarán enviar los 1.300 correos el
mismo día. Escribiéndoles a soporte como proyecto educativo suelen ampliar el límite
diario gratis.
- Cloudinary o UploadThing (Objetivo: Plan Plus/Pro de Imágenes y Archivos)
- Por qué pedirlo: Para almacenar las fotos tipo carnet de los 1.300 estudiantes, las
portadas de los libros de la biblioteca y las fotos de reportes de averías del personal
obrero con compresión automática. Cloudinary tiene un programa de descuentos y
patrocinios para organizaciones educativas sin fines de lucro (Nonprofit/Education
## Program).
- Anthropic (Claude API) / OpenAI / Google Cloud Credits (Objetivo: Créditos
de IA Investigativa/Educativa)
- Por qué pedirlo: Aunque Google Gemini Flash ya tiene una capa gratuita excelente
en Venezuela, enviar una solicitud a los programas de Academic Research / Education
Credits de Anthropic, OpenAI o Groq explicando que están implementando un Tutor
Socrático IA y un Sistema Predictivo contra la Deserción Escolar en una Escuela
Técnica pública latinoamericana es exactamente el tipo de caso de estudio que estas
empresas aman patrocinar con $500 a $2,500 en créditos de API.







## STACK TECNOLÓGICO DE DESARROLLO (ARQUITECTURA DEL
## SISTEMA)
- Núcleo Frontend & UI/UX (Interfaz de Usuario)
- Framework Principal: Next.js (App Router) + React con TypeScript.
o Por qué: Permite renderizar en el servidor (SSR) para que la aplicación cargue
rápido incluso en teléfonos de gama baja o en las computadoras antiguas del
liceo,  y  mantiene  el  tipado  estricto  con  TypeScript  para  que  varios
compañeros programen al mismo tiempo sin romper el código.
- Estilos y Componentes UI: Tailwind CSS + shadcn/ui (basado en Radix UI) +
## Lucide Icons.
o Por qué: Te da componentes de nivel empresarial (tablas de notas, modales,
calendarios, menús accesibles y modo oscuro/claro) listos para usar y 100%
personalizables con los colores de la E.T.C. Andrés Bello.
- Gráficos y Módulo de Estadísticas (Cuellos de Botella): Recharts o Tremor.
o Por qué: Librerías nativas de React para armar el panel gerencial de Dirección
(mapas de calor de materias filtro, barras de avance de carga de notas de
profesores y curvas de asistencia).
- Manejo de Formularios y Validación: React Hook Form + Zod.
o Por  qué: Indispensable  para  validar  planillas  largas  (como  la  ficha  de
inscripción de 1.º a 6.º año o la carga de notas del 1 al 20) tanto en el navegador
como en el servidor sin errores.
- Tablas de Datos Complejas: TanStack Table (React Table).
o Por qué: Para las sábanas de notas de Control de Estudios y el listado de 1.300
alumnos con filtros instantáneos por año, sección y mención, ordenamiento y
exportación a Excel.


- Núcleo Backend & Lógica de Servidor
- Entorno  de  Ejecución: Node.js integrado  mediante Next.js  Server Actions  &
Route Handlers (API REST).
o Por qué: No necesitas pagar ni mantener un servidor backend separado; todo
el backend corre dentro del mismo proyecto de Next.js de forma serverless.
- ORM y Consultas a Base de Datos: Prisma ORM o Drizzle ORM (junto con el
cliente nativo @supabase/supabase-js).
o Por  qué: Facilita  el  diseño  del  esquema  relacional  completo  (secciones,
menciones, notas, pasantías, biblioteca) y ejecuta migraciones limpias hacia
## Supabase.
- Tareas  Programadas  y  Automatizaciones  (Cron  Jobs): Inngest o GitHub
## Actions.
o Por qué: Se encarga de las tareas automáticas en segundo plano (enviar el
resumen semanal de IA a los padres cada viernes, alertar libros vencidos de la
biblioteca y hacer un ping automático a Supabase para que nunca se pause en
vacaciones).
- Base de Datos, Autenticación y Tiempo Real (BaaS)
- Motor Principal: Supabase (PostgreSQL).
o Base  de  Datos  Relacional  (PostgreSQL): Almacenamiento  de  toda  la
estructura académica, administrativa y multi-sede (Multi-Tenant).
o Seguridad de Datos: Row Level Security (RLS) de PostgreSQL (garantiza
a nivel de base de datos que un estudiante solo pueda ver sus propias notas y
que un profesor solo pueda modificar las secciones que tiene asignadas).
o Autenticación: Supabase  Auth (inicio  de  sesión  con  Cédula/Correo  y
contraseña, más inicio en 1 clic con Google OAuth @etcandresbello.org y
Magic Links para los tutores empresariales de pasantías).


o Vectores  para  la  IA: Extensión pgvector dentro  del  mismo  Supabase
(permite  guardar  los  fragmentos  de  las  guías  de  estudio  y  libros  de  la
biblioteca en la misma base de datos para que el Tutor IA responda sin pagar
otra base de datos externa).
o Tiempo Real: Supabase Realtime (para que los tickets de mantenimiento
obrero y las alertas de portería aparezcan al instante en pantalla sin recargar
la página).
- Almacenamiento Híbrido y Generación de Documentos (Estrategia Ahorro de
## Espacio)
- Generación de PDFs Oficiales (Boletines, Constancias y Notas MPPE): @react-
pdf/renderer (Generación Client-Side en el navegador).
o Por qué: En lugar de gastar espacio en Supabase guardando miles de PDFs,
el navegador del usuario arma el PDF oficial en 1 segundo usando los datos
de la base de datos. Consume 0 MB de servidor.
- Códigos  QR  (Carnets,  Verificación  de  Documentos  y  Puertas  de  Aulas):
qrcode.react (para generarlos) + html5-qrcode (para escanearlos con la cámara del
celular del profesor, bibliotecario o vigilante).
- Hojas  de  Cálculo  (Importación/Exportación  de  Matrícula  y  Estadísticas
CDCE): SheetJS (xlsx).
- Almacenamiento de Imágenes y Archivos Pesados:
o Supabase Storage / Cloudinary: Fotos tipo carnet de los estudiantes y fotos
de reportes de averías del personal obrero (comprimidas en formato .webp
antes de subir desde el navegador usando browser-image-compression).
o Google Drive API: Conexión directa para guardar los Informes de Pasantías
en PDF de 6.º año en el almacenamiento institucional de Google sin gastar los
megas de Supabase.


- Capa de Inteligencia Artificial (IA)
- SDK de Integración: Vercel AI SDK (ai).
o Por qué: Permite conectar chatbots con respuesta en streaming (efecto de
escritura en tiempo real para el Tutor Virtual del Aula LMS) y respuestas
estructuradas en JSON en pocas líneas de código.
- Motor IA Principal (Texto, Visión/OCR y Razonamiento): Google Gemini API
(@google/genai - modelo Gemini 2.5 Flash).
o Funciones que cubre: Escáner OCR de cédulas en inscripción y captures de
pago móvil, generador de exámenes para profesores, revisor de normas del
Informe de Pasantías, clasificador visual de averías para obreros y Tutor
## Socrático 24/7.
- Voz y Transcripción (Audio a Texto): Web Speech API nativa del navegador +
Groq Cloud (Whisper Large v3).
o Funciones que cubre: Dictado por voz para que el personal obrero y de
vigilancia responda tickets hablando al celular sin escribir.











- Capacidad Offline-First y Móvil
- Aplicación Móvil Instalable (PWA): @serwist/next (evolución moderna de next-
pwa).
o Por qué: Permite que profesores, obreros, alumnos y representantes instalen
la app en la pantalla de inicio de su Android  o iPhone directo desde  el
navegador sin tener que pagar los $99/año de la App Store ni pasar por
revisiones lentas.
- Caché  Local  Sin  Internet (Offline  Sync): TanStack  Query  (React  Query) +
IndexedDB (idb-keyval o Dexie.js).
o Por qué: Si en el liceo se va la luz o se cae el internet de CANTV/datos
móviles, el profesor igual puede pasar la asistencia o anotar calificaciones en
su teléfono; los datos se guardan en la memoria interna del celular y se suben
solos a Supabase apenas recupere conexión.
- Despliegue, DevOps y Control de Calidad
- Control de Versiones y CI/CD: Git & GitHub (con automatización por GitHub
## Actions).
- Hosting  y  Red  de  Distribución  (CDN): Vercel (conectado  al  dominio
etcandresbello.org protegido por Cloudflare DNS).
- Correos Transaccionales y Alertas: Resend + React Email (o Nodemailer vía
SMTP  de  Google Workspace  del  liceo) + Telegram  Bot API (100%  gratuita  e
ilimitada  para  enviar  alertas  instantáneas  al  celular  de  los  representantes  y
profesores).


