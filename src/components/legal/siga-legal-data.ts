export type LegalLocale = "es" | "en";

export interface LegalMetaItem {
  label: string;
  value: string;
  href?: string;
  dateTime?: string;
}

export interface LegalTocItem {
  id: string;
  number: string;
  label: string;
}

export interface LegalKvItem {
  label: string;
  body: string;
  linkLabel?: string;
  linkHref?: string;
  linkExternal?: boolean;
}

export interface LegalNoteBox {
  tone: "info" | "warn";
  title: string;
  body: string;
  contactEmail?: string;
  afterEmail?: string;
}

export interface LegalBulletItem {
  label: string;
  body: string;
  linkLabel?: string;
  linkHref?: string;
  linkExternal?: boolean;
  afterLink?: string;
}

export interface LegalSubSection {
  title: string;
  kvGrid?: {
    columns?: 2 | 3;
    items: LegalKvItem[];
  };
  bullets?: LegalBulletItem[];
}

export interface LegalSection {
  id: string;
  index: string;
  title: string;
  intro?: string;
  breakableOnPrint?: boolean;
  pageBreakBeforePrint?: boolean;
  noteBox?: LegalNoteBox;
  kvGrid?: {
    columns?: 2 | 3;
    items: LegalKvItem[];
  };
  bullets?: LegalBulletItem[];
  subSections?: LegalSubSection[];
  cta?: {
    label: string;
    href: string;
    external?: boolean;
  };
}

export interface LegalDocumentContent {
  locale: LegalLocale;
  htmlLang: "es" | "en";
  canonicalUrl: string;
  alternateUrl: string;
  alternatePath: "/legal" | "/legal/en";
  alternateButtonLabel: string;
  alternateButtonAria: string;
  skipToContentLabel: string;
  backToSigaLabel: string;
  mainPortalLabel: string;
  printButtonLabel: string;
  printButtonAria: string;
  kicker: string;
  title: string;
  lead: string;
  metaAriaLabel: string;
  meta: LegalMetaItem[];
  tocAriaLabel: string;
  tocTitle: string;
  tocHint: string;
  toc: LegalTocItem[];
  contentAriaLabel: string;
  sections: LegalSection[];
  letterhead: {
    republic: string;
    ministry: string;
    school: string;
    address: string;
    deaLabel: string;
    deaValue: string;
    rifLabel: string;
    rifValue: string;
    docLabel: string;
    docValue: string;
    dateLabel: string;
    dateValue: string;
  };
  printSignoff: {
    authorityHeading: string;
    principalLabel: string;
    principalValue: string;
    schoolLine: string;
    verificationHeading: string;
    portalLabel: string;
    portalValue: string;
    contactLabel: string;
    contactValue: string;
  };
  printRunningFooter: {
    left: string;
    right: string;
  };
  footer: {
    copyright: string;
    communityCredit: string;
    alternateLinkLabel: string;
    repoLabel: string;
    backHomeLabel: string;
    backTopLabel: string;
  };
}

export const SIGA_LEGAL_ORIGIN = "https://siga.etcandresbello.org";
export const SCHOOL_PORTAL_URL = "https://www.etcandresbello.org";
export const SIGA_REPO_URL = "https://github.com/E-T-C-Andres-Bello/S.I.G.A";
export const SCHOOL_EMAIL = "admin@etcandresbello.org";

export const SIGA_LEGAL_CONTENT: Record<LegalLocale, LegalDocumentContent> = {
  es: {
    locale: "es",
    htmlLang: "es",
    canonicalUrl: `${SIGA_LEGAL_ORIGIN}/legal`,
    alternateUrl: `${SIGA_LEGAL_ORIGIN}/legal/en`,
    alternatePath: "/legal/en",
    alternateButtonLabel: "EN · English",
    alternateButtonAria: "Read legal notice in English",
    skipToContentLabel: "Saltar al contenido legal",
    backToSigaLabel: "Volver a S.I.G.A.",
    mainPortalLabel: "etcandresbello.org",
    printButtonLabel: "Imprimir / PDF",
    printButtonAria: "Imprimir o guardar este aviso legal en PDF",
    kicker: 'E.T.C. "Andrés Bello" · Transparencia, cumplimiento y marco legal',
    title: "Aviso legal, privacidad, marcas y código abierto",
    lead: 'Documento marco que regula el uso de S.I.G.A. (siga.etcandresbello.org), la titularidad de marcas de terceros, la Licencia MIT del código abierto, la protección de niños, niñas y adolescentes (LOPNNA), el resguardo de datos escolares, el carácter orientativo de la asistencia automatizada y el protocolo de divulgación responsable de seguridad.',
    metaAriaLabel: "Metadatos del documento legal",
    meta: [
      { label: "Versión del documento", value: "v2.0 · Vigente" },
      {
        label: "Última actualización",
        value: "22 de noviembre de 2026",
        dateTime: "2026-11-22",
      },
      { label: "Licencia S.I.G.A.", value: "MIT License (Código Abierto)" },
      {
        label: "Contacto legal y seguridad",
        value: SCHOOL_EMAIL,
        href: `mailto:${SCHOOL_EMAIL}`,
      },
    ],
    tocAriaLabel: "Índice de secciones legales",
    tocTitle: "Índice del documento · 10 apartados",
    tocHint: "Selecciona cualquier apartado para ir directamente",
    toc: [
      { id: "titularidad", number: "01", label: "Titularidad y gratuidad" },
      { id: "marcas", number: "02", label: "Marcas y patrocinios" },
      { id: "codigo-abierto", number: "03", label: "Licencia MIT de S.I.G.A." },
      {
        id: "propiedad-intelectual",
        number: "04",
        label: "Propiedad intelectual y créditos",
      },
      { id: "menores-imagen", number: "05", label: "Menores e imagen (LOPNNA)" },
      {
        id: "privacidad",
        number: "06",
        label: "Privacidad K12, IA y verificación",
      },
      { id: "uso-aceptable", number: "07", label: "Uso aceptable y cuentas" },
      { id: "seguridad", number: "08", label: "Seguridad y divulgación" },
      {
        id: "disponibilidad",
        number: "09",
        label: "Disponibilidad y accesibilidad",
      },
      { id: "marco-legal", number: "10", label: "Marco legal y jurisdicción" },
    ],
    contentAriaLabel: "Contenido del aviso legal de S.I.G.A.",
    sections: [
      {
        id: "titularidad",
        index: "01 · Identificación institucional, ámbito y gratuidad",
        title: "Titular de la plataforma, validez oficial y aviso anti-suplantación",
        kvGrid: {
          columns: 2,
          items: [
            {
              label: "Institución responsable",
              body: 'Escuela Técnica Comercial "Andrés Bello", plantel educativo público oficial adscrito al Ministerio del Poder Popular para la Educación (MPPE). Dirección del plantel: Prof. Wilmer Escobar.',
            },
            {
              label: "Identificación oficial (MPPE)",
              body: "Código DEA: OD01340701 · RIF (Zona Educativa): J-406048640. Por su carácter de institución pública nacional, el plantel no posee RIF comercial propio y se identifica fiscalmente bajo la Zona Educativa correspondiente.",
            },
            {
              label: "Sede física y horario de atención",
              body: "Av. 7 (Av. Guarapiche) con Calle 20, Sector II de Unare II, Parroquia Unare, Municipio Caroní, Puerto Ordaz, Estado Bolívar, Venezuela. Atención presencial: lunes a viernes, de 7:00 AM a 3:30 PM.",
            },
            {
              label: "Canales digitales oficiales",
              body: "Plataforma S.I.G.A.: https://siga.etcandresbello.org · Portal institucional: https://www.etcandresbello.org · Instagram oficial: @etandresbello · Correo legal y administrativo: admin@etcandresbello.org.",
            },
          ],
        },
        noteBox: {
          tone: "warn",
          title: "Aviso de gratuidad pública y prevención de fraudes (anti-phishing):",
          body: 'La E.T.C. "Andrés Bello" es una institución pública, oficial y gratuita, sin fines de lucro ni publicidad. S.I.G.A. nunca solicita pagos, transferencias bancarias, depósitos, contraseñas ni envío de cédulas o documentos personales mediante enlaces externos, formularios públicos no oficiales o mensajería informal. Todo trámite de inscripción formal o solicitud especial se gestiona en Control de Estudios o mediante canales verificables de la Dirección. Si detectas un sitio, perfil o mensaje que suplante al plantel o a S.I.G.A., repórtalo de inmediato a ',
          contactEmail: SCHOOL_EMAIL,
          afterEmail: ".",
        },
        bullets: [
          {
            label: "Aceptación de condiciones:",
            body: "el acceso, consulta o uso de la portada pública, del verificador de documentos o del entorno interno de S.I.G.A. implica la lectura y aceptación plena de este aviso legal y de las normativas internas del plantel vigentes.",
          },
          {
            label: "Primacía de los actos administrativos oficiales:",
            body: "las vistas en pantalla, cálculos orientativos, alertas académicas y resúmenes digitales facilitan la gestión escolar diaria, pero no sustituyen las actas físicas, libros de registro, boletines sellados, constancias certificadas ni circulares vigentes emitidas por Control de Estudios, la Dirección del plantel o el MPPE. Ante cualquier discrepancia material, prevalecerán siempre los registros oficiales certificados por la institución.",
          },
          {
            label: "Servicio educativo sin fines comerciales:",
            body: "el acceso a S.I.G.A. es gratuito para la comunidad educativa autorizada y no constituye oferta mercantil, relación comercial ni prestación de servicios remunerados.",
          },
        ],
      },
      {
        id: "marcas",
        index: "02 · Marcas registradas, patrocinios educativos y propiedad de terceros",
        title: "Uso nominativo, distinción de programas y protocolo de retiro",
        intro:
          'Todos los nombres comerciales, denominaciones, logotipos, isotipos y signos distintivos de terceros exhibidos en S.I.G.A. y en su apartado "Impulsado por" son marcas registradas y propiedad exclusiva de sus respectivos titulares.',
        kvGrid: {
          columns: 2,
          items: [
            {
              label: "Programas educativos, comunitarios y patrocinios",
              body: "Cualquier proveedor tecnológico que otorgue a la institución cuentas educativas escolares, programas de apoyo a organizaciones sin fines de lucro, iniciativas de código abierto o patrocinios formales se reconoce estrictamente bajo los términos y políticas públicas vigentes de cada programa.",
            },
            {
              label: "Infraestructura y plataformas compatibles",
              body: "Los servicios en la nube, plataformas de identidad escolar, correo transaccional, diseño, repositorios y herramientas de diagnóstico técnico exhibidos o enlazados se mencionan de forma general, veraz y descriptiva para transparentar el ecosistema que sostiene o es compatible con S.I.G.A.",
            },
          ],
        },
        bullets: [
          {
            label: "Uso nominativo e informativo sin fines de lucro:",
            body: "la inclusión de marcas se realiza al amparo del uso referencial de buena fe con fines exclusivamente educativos, documentales y de transparencia institucional.",
          },
          {
            label: "Ausencia de aval, coautoría o responsabilidad solidaria:",
            body: 'la exhibición de una marca o logotipo bajo "Impulsado por" no implica afiliación societaria, representación legal, coautoría, certificación comercial ni garantía del titular externo sobre el funcionamiento, disponibilidad o contenido de S.I.G.A.',
          },
          {
            label: "Integridad visual de activos (Brand Guidelines):",
            body: "los signos distintivos de terceros se presentan respetando sus archivos oficiales, proporciones geométricas, variantes claro y oscuro, áreas de resguardo y guías públicas de identidad vigentes, sin alteraciones ni usos engañosos.",
          },
          {
            label: "Procedimiento de atención y retiro rápido (Notice & Takedown):",
            body: "si algún titular de derechos considera que la referencia o representación de su marca requiere ajuste, atribución específica o retiro inmediato, puede notificarlo a ",
            linkLabel: SCHOOL_EMAIL,
            linkHref: `mailto:${SCHOOL_EMAIL}`,
            afterLink:
              " indicando el signo y la solicitud concreta. La institución atenderá el requerimiento de buena fe en un plazo máximo de 48 a 72 horas hábiles, sin que ello constituya admisión de infracción.",
          },
        ],
      },
      {
        id: "codigo-abierto",
        index: "03 · Software Libre, Licencia MIT de S.I.G.A. y garantías",
        title: 'Código abierto, contribuciones comunitarias y cláusula "Tal cual"',
        intro:
          'S.I.G.A. (Sistema Integral de Gestión Académica) se desarrolla y distribuye como un proyecto de código abierto con fines académicos, pedagógicos y de modernización administrativa para la E.T.C. "Andrés Bello", en sintonía con los principios de fomento al Software Libre en la gestión pública venezolana.',
        bullets: [
          {
            label: "Licencia MIT del código fuente:",
            body: "el código fuente de S.I.G.A. se distribuye bajo la Licencia MIT conforme al archivo de licencia publicado en el repositorio oficial del proyecto. Se permite su uso, copia, modificación, fusión, publicación y redistribución, siempre que se conserve el aviso de derechos de autor y el texto íntegro de la licencia en todas las copias o porciones sustanciales del software.",
          },
          {
            label: "Reserva estricta de identidad institucional:",
            body: 'la Licencia MIT recae exclusivamente sobre el código fuente y no concede licencia, cesión ni autorización para utilizar el nombre oficial, siglas, escudo, logotipo, sellos, plantillas oficiales, firmas ni dominios de la E.T.C. "Andrés Bello" con el fin de suplantar al plantel, atribuirse representación oficial o emitir boletines, carnets o constancias no autorizadas.',
          },
          {
            label: "Aportes y contribuciones al repositorio:",
            body: "todo colaborador externo, docente o estudiante que envíe mejoras, código o documentación al repositorio oficial declara contar con los derechos necesarios sobre su aporte, garantiza que no infringe derechos de terceros y acepta expresamente que se incorpore y redistribuya de forma irrevocable bajo la misma Licencia MIT del proyecto.",
          },
          {
            label: 'Entrega "tal cual" (As-Is) y limitación integral de responsabilidad:',
            body: 'tanto esta plataforma como el código público de S.I.G.A. se proporcionan "tal cual" y "según disponibilidad", sin garantías expresas ni implícitas de comercialización, idoneidad para un fin particular, continuidad ininterrumpida o ausencia de errores. En la máxima medida permitida por la ley, ni la institución ni sus autoridades, docentes o estudiantes colaboradores asumirán responsabilidad por daños directos, indirectos, incidentales, lucro cesante, pérdida de datos o consecuencias derivadas del uso, modificación o despliegue independiente del software por terceros.',
          },
        ],
        cta: {
          label: "Ver repositorio oficial de S.I.G.A. (MIT)",
          href: SIGA_REPO_URL,
          external: true,
        },
      },
      {
        id: "propiedad-intelectual",
        index: "04 · Propiedad intelectual, créditos comunitarios y licencias abiertas",
        title: "Contenidos educativos, Servicio Comunitario y software de terceros",
        bullets: [
          {
            label: "Titularidad de contenidos institucionales:",
            body: 'salvo en los componentes sujetos a licencias abiertas explícitas, los textos institucionales, la estructura editorial, las fotografías originales del plantel y los diseños propios pertenecen a la E.T.C. "Andrés Bello" o se emplean con autorización, protegidos conforme a la Ley sobre el Derecho de Autor. Se permite su consulta y cita educativa o periodística sin fines de lucro, indicando claramente la fuente.',
          },
          {
            label: "Materiales académicos cargados por docentes y estudiantes:",
            body: "las guías de estudio, asignaciones e informes cargados en las aulas virtuales y pasantías conservan los derechos de autor de sus respectivos creadores y se utilizan exclusivamente con fines pedagógicos internos. Queda prohibido subir obras protegidas de terceros sin autorización o cita lícita; cualquier titular puede solicitar su retiro a ",
            linkLabel: SCHOOL_EMAIL,
            linkHref: `mailto:${SCHOOL_EMAIL}`,
            afterLink: " (atención en 48 a 72 horas hábiles).",
          },
          {
            label: "Prohibición de clonación engañosa:",
            body: "queda prohibido replicar la apariencia visual, logotipos, formatos de constancia o contenidos de S.I.G.A. para operar sitios espejo no autorizados, campañas comerciales o plataformas que induzcan a error sobre su origen oficial.",
          },
          {
            label: "Crédito institucional y desarrollo comunitario:",
            body: 'S.I.G.A. fue impulsado como Proyecto de Servicio Comunitario de Ingeniería Informática (UNEG) en articulación con la E.T.C. "Andrés Bello". Dicho aporte académico y comunitario no implica relación laboral, comercial ni responsabilidad civil solidaria de los colaboradores sobre las decisiones administrativas o académicas del plantel.',
          },
        ],
        subSections: [
          {
            title: "Atribución de software abierto y tipografías empleadas en S.I.G.A.",
            kvGrid: {
              columns: 3,
              items: [
                {
                  label: "Next.js y React",
                  body: "Marco de aplicación web y librería de interfaz interactiva de S.I.G.A. · Licencia MIT.",
                },
                {
                  label: "Tailwind CSS, Lucide, Lenis y React-PDF",
                  body: "Sistema de estilos, iconografía, navegación fluida y generación de documentos en navegador · Licencias MIT e ISC.",
                },
                {
                  label: "Tipografías Inter y Space Grotesk",
                  body: "Familias tipográficas legibles utilizadas en la lectura académica e interfaz · SIL Open Font License (OFL).",
                },
              ],
            },
          },
        ],
      },
      {
        id: "menores-imagen",
        index: "05 · Protección de niños, niñas y adolescentes (LOPNNA) e imagen",
        title: "Interés superior del menor, fotografía escolar y retiro prioritario",
        intro:
          'En estricto apego al principio del interés superior de niños, niñas y adolescentes, al Artículo 65 de la LOPNNA (derecho al honor, reputación, propia imagen y vida privada) y al Artículo 60 de la Constitución de la República Bolivariana de Venezuela, la E.T.C. "Andrés Bello" aplica salvaguardas reforzadas sobre la imagen y datos de todo estudiante menor de edad.',
        bullets: [
          {
            label: "Fotografías institucionales y de identificación escolar:",
            body: "las fotografías del plantel tienen finalidad estrictamente documental y pedagógica sin fines comerciales ni publicitarios. Asimismo, las fotografías de perfil o carnet digital cargadas dentro de S.I.G.A. se utilizan únicamente para identificación interna escolar, biblioteca y trámites del plantel, permaneciendo fuera del acceso público abierto y de motores de búsqueda.",
          },
          {
            label: "Prohibición de exposición nominal pública:",
            body: "ninguna sección pública de S.I.G.A. vincula fotografías o rostros de estudiantes menores de edad con nombres completos, cédulas, calificaciones, direcciones o teléfonos.",
          },
          {
            label: "Participación y control de representantes legales:",
            body: "el tratamiento de la información escolar de estudiantes menores de edad se efectúa bajo la potestad educativa pública del plantel y con acceso informativo y control de madres, padres o representantes legales debidamente inscritos.",
          },
          {
            label: "Canal gratuito y prioritario de retiro o corrección:",
            body: "cualquier madre, padre, representante legal, estudiante o egresado que identifique su imagen o la de su representado y solicite su eliminación, actualización o difuminado puede hacerlo sin costo escribiendo a ",
            linkLabel: SCHOOL_EMAIL,
            linkHref: `mailto:${SCHOOL_EMAIL}`,
            afterLink:
              " o acudiendo presencialmente a la Dirección del plantel. Estas solicitudes se atienden con máxima prioridad en un plazo máximo de 48 horas hábiles.",
          },
        ],
      },
      {
        id: "privacidad",
        index: "06 · Privacidad escolar (K12), almacenamiento local, IA y verificación",
        title: "Resguardo de expedientes, operación sin conexión y derechos Habeas Data",
        breakableOnPrint: true,
        noteBox: {
          tone: "info",
          title: "Compromiso innegociable de privacidad escolar (K12):",
          body: 'La E.T.C. "Andrés Bello" no vende, alquila, cede comercialmente ni utiliza datos de estudiantes, representantes, docentes o personal para publicidad dirigida ni perfilado mercantil. Toda información tratada en S.I.G.A. obedece exclusivamente al interés educativo y a las obligaciones administrativas del plantel ante el MPPE.',
        },
        subSections: [
          {
            title: "A. Acceso restringido por rol, confidencialidad de Orientación y pasantías",
            bullets: [
              {
                label: "Acceso institucional cerrado (sin auto-registro abierto):",
                body: "el ingreso al entorno académico está restringido exclusivamente a cuentas institucionales @etcandresbello.org o a cédulas previamente registradas y autorizadas por Control de Estudios.",
              },
              {
                label: "Aislamiento estricto por rol escolar:",
                body: "cada persona accede únicamente a la información que le corresponde según su función verificada (estudiante sobre su propio expediente, representante sobre sus representados vinculados, docente sobre sus secciones asignadas, y personal autorizado de Control de Estudios y Dirección).",
              },
              {
                label: "Confidencialidad reforzada en Orientación y Bienestar:",
                body: "los registros de orientación escolar, acompañamiento psicopedagógico y situaciones de vulnerabilidad poseen reserva reforzada exclusiva para Orientación y Dirección, y nunca son visibles para otros docentes, estudiantes ni terceros no autorizados.",
              },
              {
                label: "Tutores empresariales de pasantías (6.º año):",
                body: "cuando se habilita un enlace seguro temporal para que un tutor empresarial registre la evaluación de pasantías, dicho acceso tiene vigencia acotada y se limita exclusivamente a la planilla del pasante asignado, sin exposición del resto del expediente escolar.",
              },
            ],
          },
          {
            title: "B. Almacenamiento en tu dispositivo, modo sin conexión y soporte técnico",
            kvGrid: {
              columns: 3,
              items: [
                {
                  label: "Preferencias visuales del navegador",
                  body: "Tu dispositivo recuerda de forma local tu selección de tema claro u oscuro, paleta de color y disposición del menú para mejorar tu experiencia de lectura.",
                },
                {
                  label: "Respaldo temporal sin conexión",
                  body: "Para asegurar la continuidad en el aula cuando falle la electricidad o el internet, S.I.G.A. puede guardar temporalmente en tu dispositivo el carnet digital o registros pendientes de asistencia y notas, sincronizándolos con protección contra duplicados al recuperar señal.",
                },
                {
                  label: "Red, correo escolar y diagnóstico técnico",
                  body: "Para entregar la plataforma de forma segura, enviar avisos escolares y detectar fallos de estabilidad se emplean proveedores tecnológicos especializados bajo políticas estrictas, limitando la telemetría técnica a rendimiento y corrección de errores, jamás a publicidad.",
                },
              ],
            },
            bullets: [
              {
                label: "Conservación de datos y cierre de sesión:",
                body: "los historiales académicos se conservan conforme a los plazos oficiales del sistema educativo venezolano. Los datos temporales guardados en el dispositivo pueden borrarse en cualquier momento cerrando sesión o limpiando los datos del navegador.",
              },
            ],
          },
          {
            title: "C. Asistencia orientativa con Inteligencia Artificial y verificación de constancias",
            bullets: [
              {
                label: "Carácter estrictamente orientativo de la IA y supervisión humana:",
                body: "las herramientas de apoyo automatizado dentro de S.I.G.A. —como la tutoría de estudio basada en guías subidas por los profesores, la lectura asistida de recaudos y la revisión previa de informes de pasantías— son únicamente auxiliares y orientativas. Pueden contener imprecisiones, nunca sustituyen el criterio pedagógico ni la verificación del docente, y ninguna calificación definitiva o decisión disciplinaria se adopta de forma puramente automatizada.",
              },
              {
                label: "Minimización en procesos asistidos:",
                body: "la información escolar enviada a herramientas de apoyo pedagógico se minimiza a lo estrictamente necesario para la consulta y no se destina a fines publicitarios ni comerciales.",
              },
              {
                label: "Verificación pública de documentos y constancias:",
                body: "a través del ",
                linkLabel: "portal público de verificación",
                linkHref: "/verificar",
                afterLink:
                  ", terceros autorizados (como universidades o empleadores) pueden confirmar la autenticidad y vigencia de una constancia o boletín mediante su código de validación. Dicha consulta muestra únicamente el estado de validez y metadatos mínimos esenciales del documento, sin revelar direcciones, teléfonos, expedientes confidenciales ni historiales privados.",
              },
            ],
          },
          {
            title: "D. Derechos de las familias y estudiantes (Habeas Data · Art. 28 CRBV)",
            bullets: [
              {
                label: "Acceso, actualización, rectificación y supresión:",
                body: "estudiantes, representantes, docentes y personal tienen derecho gratuito a conocer qué información les concierne en S.I.G.A., así como a solicitar la actualización, corrección de errores o supresión de datos improcedentes —sin perjuicio del deber legal de conservación de registros académicos oficiales exigidos por el MPPE— escribiendo a ",
                linkLabel: SCHOOL_EMAIL,
                linkHref: `mailto:${SCHOOL_EMAIL}`,
                afterLink:
                  " o presentándose en Control de Estudios o la Dirección del plantel.",
              },
            ],
          },
        ],
      },
      {
        id: "uso-aceptable",
        index: "07 · Condiciones de uso aceptable, cuentas y enlaces externos",
        title: "Custodia de credenciales, conducta permitida y sitios de terceros",
        bullets: [
          {
            label: "Uso lícito, educativo y de buena fe:",
            body: "al ingresar a S.I.G.A. aceptas utilizar la plataforma conforme a la ley, las normas de convivencia escolar y la buena fe, exclusivamente para fines académicos y administrativos autorizados.",
          },
          {
            label: "Custodia personal de cuentas y accesos:",
            body: "las credenciales institucionales son personales e intransferibles. Cada usuario (y su representante en el caso de menores de edad) es responsable de mantener la confidencialidad de su acceso, cerrar sesión en equipos compartidos y notificar de inmediato a la institución ante sospecha de acceso indebido.",
          },
          {
            label: "Trazabilidad y auditoría académica:",
            body: "con fines de transparencia institucional y control escolar, las modificaciones relevantes sobre calificaciones, cierres de lapso y documentos emitidos dejan constancia interna inalterable de autoría, fecha y cambio realizado.",
          },
          {
            label: "Conductas estrictamente prohibidas:",
            body: "queda prohibido intentar acceder a expedientes ajenos, eludir controles de permisos, automatizar extracciones masivas de información, provocar sobrecarga o interrupciones de servicio, introducir código malicioso, alterar registros académicos o falsificar constancias y códigos de verificación. Estas conductas podrán derivar en medidas disciplinarias escolares y en responsabilidades civiles o penales conforme a la Ley Especial contra los Delitos Informáticos.",
          },
          {
            label: "Enlaces a sitios y plataformas externas:",
            body: 'los enlaces hacia el portal institucional principal, redes oficiales, repositorios abiertos o páginas de aliados tecnológicos se facilitan por conveniencia informativa; la E.T.C. "Andrés Bello" no controla su contenido, disponibilidad ni políticas de privacidad, las cuales son responsabilidad exclusiva de sus respectivos operadores.',
          },
        ],
      },
      {
        id: "seguridad",
        index: "08 · Seguridad informática, incidentes y divulgación responsable",
        title: "Protección técnica y política de reporte de vulnerabilidades",
        pageBreakBeforePrint: true,
        intro:
          'La institución aplica medidas técnicas y organizativas razonables acordes a su naturaleza educativa pública (cifrado en tránsito y reposo, control de acceso por rol y registro de auditoría), y valora la colaboración de investigadores de seguridad y de la comunidad para proteger S.I.G.A.',
        bullets: [
          {
            label: "Gestión diligente ante incidentes:",
            body: "aunque ningún sistema informático está exento por completo de riesgos externos, ante cualquier incidente de seguridad relevante que pueda comprometer información escolar, la institución actuará con diligencia para contenerlo, investigarlo y comunicarlo oportunamente a las autoridades educativas y personas potencialmente afectadas.",
          },
          {
            label: "Canal oficial de divulgación responsable (VDP):",
            body: "si detectas una vulnerabilidad técnica, envía una descripción clara y reproducible a ",
            linkLabel: SCHOOL_EMAIL,
            linkHref: `mailto:${SCHOOL_EMAIL}`,
            afterLink:
              " con el asunto sugerido [Seguridad] Reporte de vulnerabilidad.",
          },
          {
            label: "Metadatos estándar de contacto de seguridad:",
            body: "los datos de contacto estandarizados bajo RFC 9116 se publican en nuestro ",
            linkLabel: "archivo público de seguridad institucional",
            linkHref: "/.well-known/security.txt",
            afterLink: " para facilitar reportes responsables.",
          },
          {
            label: "Reglas de actuación de buena fe:",
            body: "abstente de consultar, copiar, modificar o eliminar datos reales de estudiantes, familias o personal; no ejecutes pruebas de denegación de servicio, ingeniería social ni escaneos disruptivos que afecten la operación escolar; y concede un plazo razonable de análisis y corrección antes de cualquier divulgación pública.",
          },
          {
            label: "Compromiso de respuesta y Safe Harbor:",
            body: "confirmaremos la recepción de tu reporte en un plazo estimado de 72 horas hábiles y no promoveremos acciones legales contra quienes investiguen y reporten de buena fe cumpliendo estrictamente estas pautas.",
          },
        ],
      },
      {
        id: "disponibilidad",
        index: "09 · Disponibilidad, fuerza mayor y accesibilidad digital",
        title: "Continuidad del servicio, contingencias e inclusión",
        bullets: [
          {
            label: "Disponibilidad, respaldo sin conexión y fuerza mayor:",
            body: 'aunque se procura mantener S.I.G.A. operativo de manera continua e incorpora respaldo temporal sin conexión para mitigar interrupciones durante las clases, la E.T.C. "Andrés Bello" no garantiza disponibilidad ininterrumpida ni asume responsabilidad por pausas derivadas de mantenimientos, actualizaciones, fallas del suministro eléctrico o de telecomunicaciones, incidentes de proveedores externos o eventos de fuerza mayor.',
          },
          {
            label: "Evolución y modificación del servicio:",
            body: "la institución se reserva la facultad de actualizar, mejorar, suspender temporalmente o ajustar módulos, integraciones y contenidos de S.I.G.A. cuando resulte necesario por razones pedagógicas, técnicas o administrativas.",
          },
          {
            label: "Compromiso de accesibilidad e inclusión digital:",
            body: "S.I.G.A. se diseña para toda la comunidad bellista —incluyendo adultos mayores y personas con discapacidad— aplicando estructura semántica clara, contraste adaptado en modo claro y oscuro, navegación por teclado y respeto a la preferencia de movimiento reducido del dispositivo. Si encuentras alguna barrera de accesibilidad, notifícalo a ",
            linkLabel: SCHOOL_EMAIL,
            linkHref: `mailto:${SCHOOL_EMAIL}`,
            afterLink: " para priorizar su corrección.",
          },
        ],
      },
      {
        id: "marco-legal",
        index: "10 · Marco normativo, vigencia, divisibilidad y jurisdicción",
        title: "Referencia jurídica venezolana, idioma oficial y resolución",
        bullets: [
          {
            label: "Marco normativo de referencia (República Bolivariana de Venezuela):",
            body: "este documento se interpreta y aplica en armonía con la Constitución de la República Bolivariana de Venezuela (Arts. 28, 60, 102 y 103), la Ley Orgánica para la Protección de Niños, Niñas y Adolescentes (LOPNNA, en especial el principio de interés superior y el Art. 65), la Ley Orgánica de Educación (LOE) y resoluciones vigentes del MPPE, la Ley de Infogobierno, la Ley Especial contra los Delitos Informáticos, la Ley sobre Mensajes de Datos y Firmas Electrónicas y la Ley sobre el Derecho de Autor.",
          },
          {
            label: "Modificaciones y control de versiones:",
            body: "la institución podrá actualizar este aviso para adaptarlo a mejoras técnicas de S.I.G.A. o a nuevas disposiciones legales y ministeriales. Cada revisión indicará su número de versión y fecha de vigencia en la cabecera del documento.",
          },
          {
            label: "Divisibilidad y no renuncia:",
            body: "si cualquier cláusula de este documento fuese declarada nula, inválida o inaplicable por autoridad competente, las restantes conservarán plena vigencia y eficacia. La demora u omisión de la institución en ejercer algún derecho o medida prevista en este aviso no constituye renuncia al mismo.",
          },
          {
            label: "Idioma prevalente:",
            body: "este documento ofrece una ",
            linkLabel: "versión informativa en inglés",
            linkHref: "/legal/en",
            afterLink:
              " para facilitar la revisión por colaboradores, revisores y proveedores internacionales. En caso de cualquier discrepancia o duda interpretativa, prevalecerá siempre la versión oficial en español.",
          },
          {
            label: "Ley aplicable y jurisdicción:",
            body: "este aviso legal y el uso de S.I.G.A. se rigen íntegramente por las leyes de la República Bolivariana de Venezuela. Toda controversia procurará resolverse inicialmente por la vía amistosa y administrativa directa ante la Dirección del plantel; en su defecto, quedará sometida a los tribunales competentes del Estado Bolívar (Municipio Caroní, Puerto Ordaz).",
          },
        ],
      },
    ],
    letterhead: {
      republic: "República Bolivariana de Venezuela",
      ministry: "Ministerio del Poder Popular para la Educación",
      school: 'Escuela Técnica Comercial "Andrés Bello"',
      address:
        "Av. 7 (Av. Guarapiche) con Calle 20 · Unare II, Puerto Ordaz, Edo. Bolívar",
      deaLabel: "Código DEA",
      deaValue: "OD01340701",
      rifLabel: "RIF (Z.E.)",
      rifValue: "J-406048640",
      docLabel: "Documento",
      docValue: "Legal v2.0",
      dateLabel: "Vigencia",
      dateValue: "22/11/2026",
    },
    printSignoff: {
      authorityHeading: "Autoridad institucional",
      principalLabel: "Dirección del Plantel:",
      principalValue: "Prof. Wilmer Escobar",
      schoolLine:
        'Escuela Técnica Comercial "Andrés Bello" · Código DEA OD01340701',
      verificationHeading: "Verificación y canal oficial",
      portalLabel: "Documento oficial:",
      portalValue: `${SIGA_LEGAL_ORIGIN}/legal`,
      contactLabel: "Contacto legal y seguridad:",
      contactValue: SCHOOL_EMAIL,
    },
    printRunningFooter: {
      left: 'E.T.C. "Andrés Bello" · Código DEA OD01340701 · RIF (Zona Educativa) J-406048640',
      right: "siga.etcandresbello.org · Aviso Legal S.I.G.A. v2.0 (22/11/2026)",
    },
    footer: {
      copyright:
        '© 1998–2026 E.T.C. "Andrés Bello" · MPPE · Dirección: Prof. Wilmer Escobar',
      communityCredit:
        "S.I.G.A. · Proyecto de Servicio Comunitario · Ingeniería Informática (UNEG)",
      alternateLinkLabel: "English version",
      repoLabel: "Repositorio S.I.G.A.",
      backHomeLabel: "Volver a la portada",
      backTopLabel: "Volver arriba",
    },
  },

  en: {
    locale: "en",
    htmlLang: "en",
    canonicalUrl: `${SIGA_LEGAL_ORIGIN}/legal/en`,
    alternateUrl: `${SIGA_LEGAL_ORIGIN}/legal`,
    alternatePath: "/legal",
    alternateButtonLabel: "ES · Español",
    alternateButtonAria: "Leer el aviso legal en español",
    skipToContentLabel: "Skip to legal content",
    backToSigaLabel: "Back to S.I.G.A.",
    mainPortalLabel: "etcandresbello.org",
    printButtonLabel: "Print / PDF",
    printButtonAria: "Print or save this legal notice as PDF",
    kicker: 'E.T.C. "Andrés Bello" · Transparency, compliance & legal framework',
    title: "Legal notice, privacy, trademarks & open source",
    lead: 'Framework document governing the use of S.I.G.A. (siga.etcandresbello.org), third-party trademark attribution, the S.I.G.A. MIT License, minors’ image and privacy safeguards (LOPNNA), school data governance, advisory AI disclaimers, and our responsible security disclosure policy.',
    metaAriaLabel: "Legal document metadata",
    meta: [
      { label: "Document version", value: "v2.0 · Active" },
      {
        label: "Last updated",
        value: "November 22, 2026",
        dateTime: "2026-11-22",
      },
      { label: "S.I.G.A. license", value: "MIT License (Open Source)" },
      {
        label: "Legal & security contact",
        value: SCHOOL_EMAIL,
        href: `mailto:${SCHOOL_EMAIL}`,
      },
    ],
    tocAriaLabel: "Legal sections index",
    tocTitle: "Table of contents · 10 sections",
    tocHint: "Select any section to jump directly",
    toc: [
      { id: "ownership", number: "01", label: "Identity & anti-phishing" },
      { id: "trademarks", number: "02", label: "Trademarks & sponsorships" },
      { id: "open-source", number: "03", label: "S.I.G.A. MIT License" },
      {
        id: "intellectual-property",
        number: "04",
        label: "IP & third-party credits",
      },
      { id: "minors-image", number: "05", label: "Minors & image rights" },
      { id: "privacy", number: "06", label: "K12 privacy, AI & verification" },
      { id: "acceptable-use", number: "07", label: "Acceptable use & accounts" },
      { id: "security", number: "08", label: "Security disclosure (VDP)" },
      {
        id: "availability",
        number: "09",
        label: "Availability & accessibility",
      },
      {
        id: "governing-law",
        number: "10",
        label: "Governing law & jurisdiction",
      },
    ],
    contentAriaLabel: "S.I.G.A. legal notice content",
    sections: [
      {
        id: "ownership",
        index: "01 · Institutional identity, scope & free public education",
        title: "Platform operator, official validity & anti-impersonation notice",
        kvGrid: {
          columns: 2,
          items: [
            {
              label: "Operating institution",
              body: 'Escuela Técnica Comercial "Andrés Bello," an official public technical high school under Venezuela’s Ministry of People’s Power for Education (MPPE). School Principal: Prof. Wilmer Escobar.',
            },
            {
              label: "Official MPPE identification",
              body: "DEA School Code: OD01340701 · Tax ID / RIF (Regional Education Zone): J-406048640. As an official public school, the institution does not hold a private commercial tax ID and operates under the Regional Education Zone.",
            },
            {
              label: "Physical address & office hours",
              body: "Av. 7 (Av. Guarapiche) & Calle 20, Sector II of Unare II, Parroquia Unare, Caroní Municipality, Puerto Ordaz, Bolívar State, Venezuela. In-person hours: Monday – Friday, 7:00 AM – 3:30 PM.",
            },
            {
              label: "Official digital channels",
              body: "S.I.G.A. Platform: https://siga.etcandresbello.org · Main school portal: https://www.etcandresbello.org · Official Instagram: @etandresbello · Legal & administrative email: admin@etcandresbello.org.",
            },
          ],
        },
        noteBox: {
          tone: "warn",
          title: "Free public education & anti-phishing / fraud warning:",
          body: 'E.T.C. "Andrés Bello" is a non-profit, tuition-free public educational institution without commercial advertising. S.I.G.A. never requests payments, wire transfers, fees, passwords, or identity documents through external links, unofficial public forms, or informal messaging accounts. All official enrollment and special administrative procedures are handled through Student Records (Control de Estudios) or verifiable announcements from the Principal’s Office. Please report any impersonation or fraudulent site immediately to ',
          contactEmail: SCHOOL_EMAIL,
          afterEmail: ".",
        },
        bullets: [
          {
            label: "Acceptance of terms:",
            body: "accessing, viewing, or using the public portal, the document verifier, or the authenticated S.I.G.A. workspace constitutes full reading and acceptance of this legal notice and applicable school rules.",
          },
          {
            label: "Primacy of official administrative records:",
            body: "on-screen views, advisory grade calculations, alerts, and digital summaries support everyday academic operations, but do not replace physical ledgers, stamped report cards, certified transcripts, or binding circulars issued by Student Records, the Principal’s Office, or the MPPE. In the event of any discrepancy, official certified school records shall always prevail.",
          },
          {
            label: "Non-commercial educational service:",
            body: "access to S.I.G.A. is free of charge for authorized school community members and involves no commercial offer or paid service.",
          },
        ],
      },
      {
        id: "trademarks",
        index: "02 · Third-party trademarks, educational sponsorships & attribution",
        title: "Nominative use, program distinction & Notice & Takedown",
        intro:
          'All trade names, product names, logos, wordmarks, badges, and distinctive signs of third parties displayed on S.I.G.A. and in its "Powered by" showcase are registered trademarks and the exclusive property of their respective owners.',
        kvGrid: {
          columns: 2,
          items: [
            {
              label: "Educational, community & sponsored programs",
              body: "Any technology provider granting the school K12 educational accounts, non-profit support programs, open-source initiatives, or formal sponsorships is acknowledged strictly under the current public terms and guidelines of each program.",
            },
            {
              label: "Compatible infrastructure & platforms",
              body: "Cloud infrastructure, school identity providers, transactional email, design platforms, code repositories, and technical diagnostic tools displayed or linked are referenced generally, truthfully, and descriptively to document the ecosystem supporting or compatible with S.I.G.A.",
            },
          ],
        },
        bullets: [
          {
            label: "Good-faith, non-commercial nominative use:",
            body: "third-party marks are displayed solely for truthful identification, educational transparency, and technical documentation without commercial gain.",
          },
          {
            label: "No endorsement, co-authorship, or joint liability:",
            body: 'displaying a trademark or logo under "Powered by" does not imply corporate affiliation, legal representation, co-authorship, commercial certification, or any warranty by the external trademark holder regarding S.I.G.A.’s operation or content.',
          },
          {
            label: "Visual brand integrity (Brand Guidelines):",
            body: "third-party assets are displayed using official files, geometric proportions, light/dark variants, clear space, and public brand guidelines, without distortion or misleading use.",
          },
          {
            label: "Notice & Takedown procedure:",
            body: "if any rights holder believes a trademark reference or asset requires adjustment, specific attribution, or immediate removal, please email ",
            linkLabel: SCHOOL_EMAIL,
            linkHref: `mailto:${SCHOOL_EMAIL}`,
            afterLink:
              " with details of the sign and request. The institution will address it in good faith within 48 to 72 business hours, without constituting any admission of infringement.",
          },
        ],
      },
      {
        id: "open-source",
        index: "03 · Free & Open Source Software, S.I.G.A. MIT License & disclaimers",
        title: 'MIT License, community contributions & "As-Is" disclaimer',
        intro:
          'S.I.G.A. (Sistema Integral de Gestión Académica) is developed and distributed as an Open Source educational and institutional modernization initiative for E.T.C. "Andrés Bello," aligned with public-sector open software principles in Venezuela.',
        bullets: [
          {
            label: "MIT License for source code:",
            body: "the S.I.G.A. source code is distributed under the MIT License as published in the license file of the official repository. Permission is granted to use, copy, modify, merge, publish, and distribute the software subject to preserving the copyright notice and full license text in all copies or substantial portions.",
          },
          {
            label: "Strict reservation of institutional identity:",
            body: 'the MIT License applies exclusively to the source code and does not grant any right, assignment, or authorization to use the official name, acronym, crest, logo, seals, official certificate templates, signatures, or domains of E.T.C. "Andrés Bello" to impersonate the school, imply official representation, or issue unauthorized report cards, ID cards, or certificates.',
          },
          {
            label: "Community contributions:",
            body: "any external contributor, teacher, or student submitting improvements, code, or documentation to the official repository represents that they hold the necessary rights, warrants that their submission does not infringe third-party rights, and irrevocably agrees that it will be incorporated and redistributed under the project’s MIT License.",
          },
          {
            label: '"As-Is" provision & comprehensive limitation of liability:',
            body: 'both this platform and the public S.I.G.A. codebase are provided "as is" and "as available," without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, uninterrupted uptime, or absence of errors. To the fullest extent permitted by law, neither the institution nor its leadership, faculty, or student contributors shall be liable for any direct, indirect, incidental, consequential damages, lost profits, data loss, or outcomes arising from third-party use, modification, or independent deployment.',
          },
        ],
        cta: {
          label: "View official S.I.G.A. repository (MIT)",
          href: SIGA_REPO_URL,
          external: true,
        },
      },
      {
        id: "intellectual-property",
        index: "04 · Intellectual property, community credits & open-source licenses",
        title: "Educational content, Community Service & third-party software",
        bullets: [
          {
            label: "Institutional content ownership:",
            body: 'except where explicitly distributed under an open license, institutional copy, editorial layout, original campus photographs, and custom graphic assets belong to E.T.C. "Andrés Bello" (or are used with permission) and are protected under Venezuela’s Copyright Law. Non-commercial educational or journalistic citation is permitted with clear attribution.',
          },
          {
            label: "Academic materials uploaded by faculty and students:",
            body: "study guides, assignments, and internship reports uploaded within virtual classrooms remain the intellectual property of their respective authors and are used strictly for internal educational purposes. Uploading unauthorized third-party copyrighted works is prohibited; any rights holder may request removal via ",
            linkLabel: SCHOOL_EMAIL,
            linkHref: `mailto:${SCHOOL_EMAIL}`,
            afterLink: " (handled within 48 to 72 business hours).",
          },
          {
            label: "Prohibition of misleading cloning:",
            body: "replicating the visual identity, emblems, certificate formats, or content of S.I.G.A. to operate unauthorized mirrors, commercial campaigns, or deceptive sites is strictly prohibited.",
          },
          {
            label: "Institutional & Community Service credit:",
            body: 'S.I.G.A. was developed as an Informatics Engineering Community Service Project (UNEG) in collaboration with E.T.C. "Andrés Bello." This academic and civic contribution creates no employment, commercial relationship, or joint civil liability for student collaborators regarding the school’s administrative or academic decisions.',
          },
        ],
        subSections: [
          {
            title: "Third-party open-source software & fonts used in S.I.G.A.",
            kvGrid: {
              columns: 3,
              items: [
                {
                  label: "Next.js & React",
                  body: "Web application framework and interactive interface library powering S.I.G.A. · MIT License.",
                },
                {
                  label: "Tailwind CSS, Lucide, Lenis & React-PDF",
                  body: "Styling engine, iconography, smooth navigation, and client-side document generation · MIT & ISC Licenses.",
                },
                {
                  label: "Inter & Space Grotesk Fonts",
                  body: "Legible open font families used across academic views and interface copy · SIL Open Font License (OFL).",
                },
              ],
            },
          },
        ],
      },
      {
        id: "minors-image",
        index: "05 · Child & adolescent protection (LOPNNA) & image rights",
        title: "Best interests of minors, school photography & priority removal",
        intro:
          'In strict compliance with the best interests of children and adolescents, Article 65 of Venezuela’s Organic Law for the Protection of Children and Adolescents (LOPNNA — right to honor, reputation, personal image, and privacy), and Article 60 of the Constitution, E.T.C. "Andrés Bello" enforces heightened safeguards over all minor student imagery and records.',
        bullets: [
          {
            label: "Institutional photography & school ID photos:",
            body: "campus photographs serve strictly documentary and educational purposes with zero commercial or advertising use. Profile and digital student ID photos uploaded inside S.I.G.A. are used solely for internal school identification, library lending, and administrative procedures, remaining outside public open access and search engine indexing.",
          },
          {
            label: "No public nominal exposure:",
            body: "no public section of S.I.G.A. links minor student photographs or faces to full names, national ID numbers, grades, home addresses, or phone numbers.",
          },
          {
            label: "Parental and legal guardian oversight:",
            body: "academic data processing for minor students operates under the school’s public educational mandate with informational access and oversight for registered parents or legal guardians.",
          },
          {
            label: "Free, priority removal or correction channel:",
            body: "any parent, legal guardian, student, or alumnus who identifies their image or their child’s image and requests deletion, update, or blurring may contact ",
            linkLabel: SCHOOL_EMAIL,
            linkHref: `mailto:${SCHOOL_EMAIL}`,
            afterLink:
              " or visit the Principal’s Office in person at no cost. Such requests receive highest priority and are addressed within 48 business hours.",
          },
        ],
      },
      {
        id: "privacy",
        index: "06 · K12 school privacy, local storage, AI & document verification",
        title: "Student record protection, offline operation & Habeas Data rights",
        breakableOnPrint: true,
        noteBox: {
          tone: "info",
          title: "Non-negotiable K12 school privacy commitment:",
          body: 'E.T.C. "Andrés Bello" never sells, rents, commercially transfers, or uses student, parent, teacher, or staff information for targeted advertising or commercial profiling. All data processed in S.I.G.A. serves exclusively educational duties and official administrative obligations before the MPPE.',
        },
        subSections: [
          {
            title: "A. Role-restricted access, Counseling confidentiality & internships",
            bullets: [
              {
                label: "Closed institutional access (no open self-registration):",
                body: "access to the authenticated workspace is strictly limited to official @etcandresbello.org accounts or national ID numbers previously registered and authorized by Student Records.",
              },
              {
                label: "Strict role-based isolation:",
                body: "each person accesses only the records matching their verified school role (students view their own records, legal guardians view their linked dependents, teachers manage their assigned sections, and authorized Student Records and Principal’s Office staff oversee administrative duties).",
              },
              {
                label: "Enhanced confidentiality for Counseling & Student Welfare:",
                body: "school counseling files, psycho-pedagogical follow-ups, and vulnerability records carry heightened confidentiality restricted exclusively to Counseling and the Principal’s Office, and are never visible to other teachers, students, or unauthorized parties.",
              },
              {
                label: "External internship supervisors (6th year):",
                body: "when a temporary secure link is issued so a company supervisor can submit a 6th-year internship evaluation, access is time-bound and restricted solely to that assigned intern’s evaluation form, without exposing the rest of the student’s record.",
              },
            ],
          },
          {
            title: "B. Device storage, offline continuity & technical support services",
            kvGrid: {
              columns: 3,
              items: [
                {
                  label: "Browser display preferences",
                  body: "Your device locally remembers your light or dark theme choice, visual palette, and menu layout to keep reading comfortable.",
                },
                {
                  label: "Temporary offline backup",
                  body: "To keep classrooms running during power or internet outages, S.I.G.A. may temporarily keep your digital student ID or pending attendance and grade entries on your device, synchronizing them with duplicate protection once connectivity returns.",
                },
                {
                  label: "Network, school email & technical diagnostics",
                  body: "Specialized infrastructure providers support secure delivery, academic notifications, and fault diagnostics under strict safeguards, restricting technical telemetry solely to stability and error fixing—never advertising.",
                },
              ],
            },
            bullets: [
              {
                label: "Retention & signing out:",
                body: "official academic histories are retained according to Venezuelan educational statutory periods. Temporary device data can be cleared anytime by signing out or clearing browser storage.",
              },
            ],
          },
          {
            title: "C. Advisory Artificial Intelligence & public document verification",
            bullets: [
              {
                label: "Strictly advisory AI scope & human oversight:",
                body: "automated support tools within S.I.G.A.—such as the study tutor grounded in teacher-provided guides, assisted document reading, and preliminary internship report checks—are purely advisory and supportive. They may contain inaccuracies, never replace pedagogical judgment or teacher verification, and no final grade or disciplinary action is decided solely by automated means.",
              },
              {
                label: "Data minimization in assisted tools:",
                body: "school content processed by instructional support tools is minimized to what is strictly necessary for the task and is never used for advertising or commercial sale.",
              },
              {
                label: "Public verification of certificates & documents:",
                body: "through the ",
                linkLabel: "public verification portal",
                linkHref: "/verificar",
                afterLink:
                  ", authorized third parties (such as universities or employers) may verify the authenticity and status of a certificate or report card using its validation code. Verification returns only validity status and minimal essential document metadata, never revealing home addresses, phone numbers, confidential files, or full academic histories.",
              },
            ],
          },
          {
            title: "D. Family & student rights (Habeas Data · Art. 28 CRBV)",
            bullets: [
              {
                label: "Access, update, rectification & deletion:",
                body: "students, parents, legal guardians, faculty, and staff have the free right to know what personal information concerns them in S.I.G.A. and to request updates, correction of inaccuracies, or removal of improper data—subject to statutory retention duties for official MPPE academic records—by emailing ",
                linkLabel: SCHOOL_EMAIL,
                linkHref: `mailto:${SCHOOL_EMAIL}`,
                afterLink:
                  " or visiting Student Records or the Principal’s Office in person.",
              },
            ],
          },
        ],
      },
      {
        id: "acceptable-use",
        index: "07 · Acceptable use policy, accounts & external links",
        title: "Account custody, permitted conduct & third-party websites",
        bullets: [
          {
            label: "Lawful, educational, good-faith use:",
            body: "by accessing S.I.G.A., you agree to use the platform lawfully, respectfully, and in good faith, strictly for authorized educational and school administrative purposes.",
          },
          {
            label: "Personal custody of school credentials:",
            body: "institutional accounts are personal and non-transferable. Each user (and their parent or legal guardian in the case of minors) is responsible for keeping credentials confidential, signing out on shared devices, and immediately reporting any suspected unauthorized access.",
          },
          {
            label: "Academic auditability:",
            body: "for institutional transparency and educational oversight, material changes to grades, term closings, and issued documents are recorded in tamper-resistant internal audit logs showing actor, timestamp, and change history.",
          },
          {
            label: "Strictly prohibited conduct:",
            body: "attempting to access other users’ records, bypassing role permissions, running abusive automated scraping, causing service disruption or denial of service, injecting malicious code, tampering with academic records, or forging certificates and verification codes are strictly prohibited and may lead to school disciplinary action as well as civil or criminal liability under Venezuela’s Special Law Against Computer Crimes.",
          },
          {
            label: "External hyperlinks:",
            body: 'links to the main school portal, official social media, open-source repositories, or technology platforms are provided for convenience only; E.T.C. "Andrés Bello" does not control and is not responsible for their content, uptime, security, or privacy practices.',
          },
        ],
      },
      {
        id: "security",
        index: "08 · Information security, incidents & Responsible Disclosure (VDP)",
        title: "Technical safeguards & vulnerability reporting policy",
        pageBreakBeforePrint: true,
        intro:
          'The school maintains reasonable technical and organizational safeguards appropriate to a public educational institution (encryption in transit and at rest, role-based access controls, and audit logging) and welcomes good-faith collaboration from security researchers and community members.',
        bullets: [
          {
            label: "Diligent security incident handling:",
            body: "while no computer system is completely immune to external risk, in the event of a significant security incident potentially affecting school information, the institution will act diligently to contain and investigate it and provide timely notice to educational authorities and potentially affected individuals.",
          },
          {
            label: "Official vulnerability reporting channel (VDP):",
            body: "if you identify a technical vulnerability, please send clear, reproducible details to ",
            linkLabel: SCHOOL_EMAIL,
            linkHref: `mailto:${SCHOOL_EMAIL}`,
            afterLink:
              " using the suggested subject [Security] Vulnerability Report.",
          },
          {
            label: "Standard security contact metadata:",
            body: "machine-readable RFC 9116 contact directives are published in our ",
            linkLabel: "public institutional security contact file",
            linkHref: "/.well-known/security.txt",
            afterLink: " to streamline responsible disclosures.",
          },
          {
            label: "Good-faith testing rules:",
            body: "do not access, copy, alter, or delete real student, family, or staff records; do not conduct denial-of-service attacks, social engineering, or disruptive scans that impair school operations; and allow reasonable remediation time prior to any public disclosure.",
          },
          {
            label: "Response commitment & Safe Harbor:",
            body: "we aim to acknowledge reports within 72 business hours and will not pursue legal action against researchers conducting good-faith security reporting strictly within these guidelines.",
          },
        ],
      },
      {
        id: "availability",
        index: "09 · Service availability, force majeure & digital accessibility",
        title: "Continuity of service, contingencies & inclusive design",
        bullets: [
          {
            label: "Availability, offline support & force majeure:",
            body: 'while we strive to keep S.I.G.A. continuously available and provide temporary offline backup to cushion outages during school hours, E.T.C. "Andrés Bello" makes no guarantee of uninterrupted uptime and is not liable for interruptions caused by maintenance, updates, power or telecommunications failures, third-party provider incidents, or force majeure events.',
          },
          {
            label: "Service evolution & adjustments:",
            body: "the institution reserves the right to update, improve, temporarily suspend, or adjust S.I.G.A. modules, integrations, and content whenever required for pedagogical, technical, or administrative reasons.",
          },
          {
            label: "Digital accessibility & inclusion commitment:",
            body: "S.I.G.A. is designed for the entire school community—including older adults and people with disabilities—using clear semantic structure, high-contrast light and dark themes, keyboard navigation, and respect for device reduced-motion settings. If you encounter an accessibility barrier, please notify ",
            linkLabel: SCHOOL_EMAIL,
            linkHref: `mailto:${SCHOOL_EMAIL}`,
            afterLink: " so we can prioritize remediation.",
          },
        ],
      },
      {
        id: "governing-law",
        index: "10 · Legal framework, updates, severability & jurisdiction",
        title: "Venezuelan statutory references, prevailing language & venue",
        bullets: [
          {
            label: "Applicable statutory framework (Bolivarian Republic of Venezuela):",
            body: "this notice is interpreted and applied in harmony with the Constitution of the Bolivarian Republic of Venezuela (Arts. 28, 60, 102, and 103), the Organic Law for the Protection of Children and Adolescents (LOPNNA, notably the best interests principle and Art. 65), the Organic Law of Education (LOE) and MPPE resolutions, the Infogovernment Law, the Special Law Against Computer Crimes, the Law on Data Messages and Electronic Signatures, and the Copyright Law.",
          },
          {
            label: "Updates & version control:",
            body: "the institution may revise this notice to reflect technical improvements to S.I.G.A. or new legal and ministerial provisions. Every revision displays its version number and effective date in the document header.",
          },
          {
            label: "Severability & no waiver:",
            body: "if any provision of this document is held void, invalid, or unenforceable by a competent authority, the remaining provisions shall remain in full force and effect. Any delay or omission by the institution in exercising a right or remedy hereunder shall not constitute a waiver thereof.",
          },
          {
            label: "Prevailing language:",
            body: "this English text is provided for transparency and convenience for international collaborators, reviewers, and providers. In the event of any discrepancy or conflict of interpretation, the ",
            linkLabel: "official Spanish version",
            linkHref: "/legal",
            afterLink: " shall always prevail.",
          },
          {
            label: "Governing law & jurisdiction:",
            body: "this legal notice and the use of S.I.G.A. are governed exclusively by the laws of the Bolivarian Republic of Venezuela. Any dispute shall first be addressed amicably through direct administrative communication with the Principal’s Office; failing resolution, it shall be subject to the competent courts of Bolívar State (Caroní Municipality, Puerto Ordaz).",
          },
        ],
      },
    ],
    letterhead: {
      republic: "Bolivarian Republic of Venezuela",
      ministry: "Ministry of People’s Power for Education (MPPE)",
      school: 'Escuela Técnica Comercial "Andrés Bello"',
      address:
        "Av. 7 (Av. Guarapiche) & Calle 20 · Unare II, Puerto Ordaz, Bolívar State",
      deaLabel: "DEA Code",
      deaValue: "OD01340701",
      rifLabel: "RIF (Ed. Zone)",
      rifValue: "J-406048640",
      docLabel: "Document",
      docValue: "Legal v2.0",
      dateLabel: "Updated",
      dateValue: "2026-11-22",
    },
    printSignoff: {
      authorityHeading: "Institutional authority",
      principalLabel: "School Principal:",
      principalValue: "Prof. Wilmer Escobar",
      schoolLine: 'Escuela Técnica Comercial "Andrés Bello" · DEA Code OD01340701',
      verificationHeading: "Verification & official channel",
      portalLabel: "Official document:",
      portalValue: `${SIGA_LEGAL_ORIGIN}/legal/en`,
      contactLabel: "Legal & security contact:",
      contactValue: SCHOOL_EMAIL,
    },
    printRunningFooter: {
      left: 'E.T.C. "Andrés Bello" · DEA Code OD01340701 · RIF (Education Zone) J-406048640',
      right: "siga.etcandresbello.org · S.I.G.A. Legal Notice v2.0 (2026-11-22)",
    },
    footer: {
      copyright:
        '© 1998–2026 E.T.C. "Andrés Bello" · MPPE · Principal: Prof. Wilmer Escobar',
      communityCredit:
        "S.I.G.A. · Community Service Project · Informatics Engineering (UNEG)",
      alternateLinkLabel: "Versión en español",
      repoLabel: "S.I.G.A. repository",
      backHomeLabel: "Back to home",
      backTopLabel: "Back to top",
    },
  },
};
