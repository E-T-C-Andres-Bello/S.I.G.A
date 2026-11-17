import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowUpRight, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export const metadata: Metadata = {
  title: 'Aviso Legal, Marcas y Código Abierto · S.I.G.A. — E.T.C. "Andrés Bello"',
  description:
    'Aviso legal, descargo de marcas registradas, términos de uso, exención de garantías y licencia de código abierto de S.I.G.A. en la Escuela Técnica Comercial "Andrés Bello".',
};

const LEGAL_SECTIONS = [
  {
    index: "01 · Marcas registradas y propiedad de terceros",
    title: "Uso nominativo, independencia y protocolo de retiro",
    intro:
      'Todos los nombres comerciales, denominaciones, logotipos, isotipos y signos distintivos de terceros exhibidos en este portal y en la sección "Impulsado por" de S.I.G.A. son marcas registradas y propiedad exclusiva de sus respectivos titulares.',
    items: [
      {
        label: "Uso nominativo e informativo sin fines de lucro:",
        body: "su inclusión se realiza exclusivamente al amparo del uso referencial y descriptivo de buena fe, con el único propósito de identificar de forma veraz las plataformas, servicios o herramientas tecnológicas compatibles o empleadas en la arquitectura de S.I.G.A.",
      },
      {
        label: "Ausencia de aval, afiliación comercial o coautoría:",
        body: 'la exhibición de una marca o logotipo bajo el apartado "Impulsado por" no implica patrocinio comercial, afiliación societaria, representación legal, coautoría, respaldo oficial ni garantía sobre el funcionamiento de S.I.G.A., salvo en aquellos programas educativos, comunitarios o de código abierto formalmente concedidos a la institución conforme a los términos vigentes de cada proveedor.',
      },
      {
        label: "Integridad visual de activos (Brand Guidelines):",
        body: "los signos distintivos de terceros se presentan respetando sus archivos oficiales, proporciones geométricas, variantes cromáticas y áreas de resguardo (clear space), sin alteraciones, deformaciones ni efectos no autorizados.",
      },
      {
        label: "Procedimiento de atención y retiro rápido (Notice & Takedown):",
        body: "si algún titular de derechos considera que la referencia o representación de su marca requiere ajuste, atribución específica o retiro inmediato, puede notificarlo a admin@etcandresbello.org y la institución atenderá la solicitud de buena fe en un plazo máximo de 48 a 72 horas hábiles.",
      },
    ],
  },
  {
    index: "02 · Software Libre / Open Source y garantías",
    title: 'Licencia MIT y cláusula de exención ("Tal cual")',
    intro:
      'S.I.G.A. (Sistema Integral de Gestión Académica) se desarrolla y distribuye como un proyecto de código abierto (Open Source) bajo Licencia MIT, con fines exclusivamente académicos, pedagógicos y de modernización administrativa para la Escuela Técnica Comercial "Andrés Bello" en Unare II, Puerto Ordaz.',
    items: [
      {
        label: "Licencia MIT del código fuente:",
        body: "el código fuente, su documentación técnica y las condiciones de uso, copia, modificación y redistribución se rigen íntegramente por la Licencia MIT (archivo LICENSE) publicada en el repositorio oficial del proyecto.",
      },
      {
        label: "Reserva estricta de identidad institucional:",
        body: 'la apertura del código fuente bajo Licencia MIT no concede licencia, cesión ni autorización para utilizar el nombre oficial, escudo, insignias, sellos o formatos de la E.T.C. "Andrés Bello" con el fin de suplantar a la institución o emitir documentos académicos no oficiales.',
      },
      {
        label: 'Entrega "tal cual" (As-Is) y limitación integral de responsabilidad:',
        body: 'tanto este portal como el código público de S.I.G.A. se proporcionan "tal cual" (As-Is) y "según disponibilidad" (As-Available), sin garantías expresas ni implícitas de funcionamiento ininterrumpido, exactitud continua o adecuación comercial. Ni la institución ni sus autoridades, docentes o estudiantes colaboradores asumirán responsabilidad por daños directos, indirectos, incidentales, pérdida de datos, interrupciones de servicios externos o consecuencias derivadas del uso o despliegue independiente del software por terceros.',
      },
    ],
  },
  {
    index: "03 · Naturaleza institucional pública y alcance administrativo",
    title: "Servicio educativo público, IA orientativa y enlaces externos",
    intro:
      'La E.T.C. "Andrés Bello" (Código DEA OD01340701) es una institución educativa pública oficial adscrita al Ministerio del Poder Popular para la Educación (MPPE). Este portal carece de fines lucrativos, publicitarios o mercantiles.',
    items: [
      {
        label: "Carácter estrictamente orientativo de la portada:",
        body: "las descripciones funcionales mostradas en esta página tienen carácter meramente informativo y pedagógico; no constituyen actos administrativos ni sustituyen boletines sellados, constancias oficiales o lineamientos vigentes de la Dirección del plantel o del MPPE.",
      },
      {
        label: "Asistencia orientativa con Inteligencia Artificial:",
        body: "las sugerencias, retroalimentación pedagógica o lecturas preliminares generadas mediante modelos de lenguaje o herramientas automatizadas dentro de S.I.G.A. (como la tutoría socrática, el reconocimiento óptico de documentos OCR o la revisión previa de informes) tienen carácter exclusivamente orientativo y de apoyo; nunca sustituyen el criterio pedagógico, la verificación humana ni la evaluación oficial del docente.",
      },
      {
        label: "Enlaces y disponibilidad de plataformas de terceros:",
        body: "los hipervínculos que conducen a sitios web o plataformas tecnológicas externas se facilitan únicamente como referencia técnica; su disponibilidad, seguridad, políticas de privacidad y términos de servicio son responsabilidad exclusiva de cada operador externo.",
      },
      {
        label: "Modificaciones y continuidad del servicio:",
        body: "la institución se reserva la facultad de actualizar, suspender o modificar contenidos, funcionalidades o integraciones de este portal informativo en cualquier momento sin obligación de preaviso ni responsabilidad frente a terceros.",
      },
    ],
  },
  {
    index: "04 · Privacidad escolar (K12), datos académicos y telemetría",
    title: "Protección de datos, almacenamiento local y contacto",
    intro:
      "El tratamiento de la información dentro del ecosistema S.I.G.A. obedece estrictamente al deber de confidencialidad educativa e interés pedagógico.",
    items: [
      {
        label: "Sin comercialización ni cesión de datos:",
        body: "la institución no vende, alquila ni comercializa datos personales de visitantes, representantes, docentes ni estudiantes.",
      },
      {
        label: "Resguardo del entorno escolar (K12):",
        body: "el acceso a expedientes e información académica dentro de la aplicación se encuentra restringido por roles institucionales bajo control de la escuela y deber de reserva educativa.",
      },
      {
        label: "Telemetría técnica y almacenamiento local:",
        body: "las herramientas de diagnóstico técnico se destinan únicamente a estabilidad y rendimiento, mientras que en el portal informativo público el uso de localStorage se limita exclusivamente a recordar la preferencia visual de tema (claro u oscuro).",
      },
      {
        label: "Contacto legal, propiedad intelectual y seguridad:",
        body: "para consultas de titulares de marcas, solicitudes Notice & Takedown, reportes de seguridad (responsible disclosure) o requerimientos institucionales, escribe a admin@etcandresbello.org.",
      },
    ],
  },
  {
    index: "05 · Vigencia institucional e historia del proyecto",
    title: "Créditos de la institución y desarrollo comunitario",
    intro:
      'S.I.G.A. surge para modernizar la gestión académica de la Escuela Técnica Comercial "Andrés Bello" en Ciudad Guayana mediante el trabajo conjunto entre el plantel y el entorno universitario.',
    items: [
      {
        label: "Vigencia institucional y dirección:",
        body: '© 1998–2026 E.T.C. "Andrés Bello" · MPPE · Código DEA OD01340701 · Unare II, Puerto Ordaz · Dirección: Prof. Wilmer Escobar.',
      },
      {
        label: "Desarrollo comunitario:",
        body: "Proyecto de Servicio Comunitario · Ingeniería Informática (UNEG).",
      },
    ],
  },
];

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-12 text-foreground transition-colors sm:px-8 sm:py-16">
      <div className="mx-auto w-full max-w-4xl">
        {/* Barra superior */}
        <header className="flex flex-wrap items-center justify-between gap-4 pb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.02em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Volver a S.I.G.A.
            </Link>
            <span className="text-border" aria-hidden="true">
              /
            </span>
            <a
              href="https://www.etcandresbello.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              etcandresbello.org
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </a>
          </div>

          <ThemeToggle
            showLabel
            className="h-8 border-border bg-card px-3 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
          />
        </header>

        {/* Encabezado */}
        <section className="mb-10 rounded-3xl border border-border bg-card p-6 sm:p-10">
          <div className="flex items-center gap-3">
            <Image
              src="/images/institucion/logotipo.webp"
              alt='Escudo de la E.T.C. "Andrés Bello"'
              width={36}
              height={36}
              className="size-9 rounded-full object-contain"
            />
            <span className="inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.16em] text-primary uppercase">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              E.T.C. &ldquo;Andrés Bello&rdquo; · Transparencia y cumplimiento
            </span>
          </div>

          <h1 className="font-hero mt-4 text-2xl leading-tight font-medium tracking-[0.005em] text-foreground sm:text-4xl">
            Aviso legal, marcas y código abierto
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed tracking-[0.012em] text-muted-foreground sm:text-[15px]">
            Información sobre titularidad de marcas tecnológicas mencionadas en
            S.I.G.A., naturaleza abierta del proyecto bajo Licencia MIT y
            términos generales de este portal institucional (Código DEA
            OD01340701 · Unare II, Puerto Ordaz).
          </p>

          <p className="mt-4 text-xs tracking-[0.04em] text-muted-foreground/80">
            Última actualización: noviembre de 2026
          </p>
        </section>

        {/* Cláusulas */}
        <div className="flex flex-col gap-6">
          {LEGAL_SECTIONS.map((sec) => (
            <article
              key={sec.index}
              className="rounded-2xl border border-border bg-card p-6 sm:p-8"
            >
              <span className="text-[11px] font-medium tracking-[0.16em] text-primary uppercase">
                {sec.index}
              </span>
              <h2 className="mt-2 font-sans text-xl font-medium tracking-[0.005em] text-foreground sm:text-2xl">
                {sec.title}
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed tracking-[0.012em] text-muted-foreground">
                {sec.intro}
              </p>

              <ul className="mt-5 flex flex-col gap-3.5 border-t border-border/70 pt-5">
                {sec.items.map((item) => (
                  <li
                    key={item.label}
                    className="text-sm leading-relaxed tracking-[0.012em] text-foreground/90"
                  >
                    <strong className="font-medium text-foreground">
                      {item.label}{" "}
                    </strong>
                    <span className="text-muted-foreground">{item.body}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        {/* Pie legal */}
        <footer className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 text-xs tracking-[0.012em] text-muted-foreground sm:flex-row sm:items-center">
          <p>
            © 1998–2026 E.T.C. &ldquo;Andrés Bello&rdquo; · MPPE ·{" "}
            <a
              href="mailto:admin@etcandresbello.org"
              className="text-primary hover:underline"
            >
              admin@etcandresbello.org
            </a>
          </p>
          <div className="flex items-center gap-5">
            <a
              href="https://github.com/E-T-C-Andres-Bello/S.I.G.A"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              Repositorio S.I.G.A. ↗
            </a>
            <Link href="/" className="font-medium text-primary hover:underline">
              Volver a la portada
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
