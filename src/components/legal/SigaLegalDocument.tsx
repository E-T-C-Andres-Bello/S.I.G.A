import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  Globe,
  Info,
  ShieldCheck,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";
import { LegalPrintButton } from "./LegalPrintButton";
import {
  SCHOOL_EMAIL,
  SCHOOL_PORTAL_URL,
  SIGA_LEGAL_CONTENT,
  SIGA_REPO_URL,
  type LegalBulletItem,
  type LegalKvItem,
  type LegalLocale,
  type LegalNoteBox,
} from "./siga-legal-data";
import "./legal-print.css";

interface SigaLegalDocumentProps {
  locale: LegalLocale;
}

function renderInlineLink(
  label: string,
  href: string,
  external?: boolean
) {
  const className =
    "siga-legal-inline-link font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  if (href.startsWith("mailto:") || href.startsWith("/.well-known/")) {
    return (
      <a href={href} className={className}>
        {label}
      </a>
    );
  }

  if (external || href.startsWith("http")) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

function LegalNote({ note }: { note: LegalNoteBox }) {
  const isWarn = note.tone === "warn";

  return (
    <div
      className={cn(
        "siga-legal-note mt-4 flex items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed",
        isWarn
          ? "siga-legal-note--warn border-amber-500/35 bg-amber-500/10 text-foreground dark:border-amber-400/35 dark:bg-amber-400/10"
          : "border-primary/25 bg-primary/5 text-foreground"
      )}
    >
      {isWarn ? (
        <AlertTriangle
          className="siga-legal-screen-only mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        />
      ) : (
        <Info
          className="siga-legal-screen-only mt-0.5 size-4 shrink-0 text-primary"
          aria-hidden="true"
        />
      )}
      <p className="m-0 text-sm leading-relaxed text-foreground/90">
        <strong className="font-semibold text-foreground">{note.title} </strong>
        <span>{note.body}</span>
        {note.contactEmail && (
          <>
            {renderInlineLink(note.contactEmail, `mailto:${note.contactEmail}`)}
            {note.afterEmail ?? ""}
          </>
        )}
      </p>
    </div>
  );
}

function LegalKvGrid({
  items,
  columns = 2,
}: {
  items: LegalKvItem[];
  columns?: 2 | 3;
}) {
  return (
    <div
      className={cn(
        "siga-legal-kv-grid mt-4 grid gap-3",
        columns === 3
          ? "siga-legal-kv-grid--3 sm:grid-cols-3"
          : "sm:grid-cols-2"
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="siga-legal-kv-box rounded-xl border border-border/80 bg-muted/35 p-4"
        >
          <span className="siga-legal-kv-label block text-[11px] font-semibold tracking-[0.12em] text-primary uppercase">
            {item.label}
          </span>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {item.body}
            {item.linkLabel && item.linkHref ? (
              <>
                {" "}
                {renderInlineLink(
                  item.linkLabel,
                  item.linkHref,
                  item.linkExternal
                )}
              </>
            ) : null}
          </p>
        </div>
      ))}
    </div>
  );
}

function LegalBulletList({
  bullets,
  borderTop = true,
}: {
  bullets: LegalBulletItem[];
  borderTop?: boolean;
}) {
  return (
    <ul
      className={cn(
        "siga-legal-list mt-5 flex flex-col gap-3.5",
        borderTop && "border-t border-border/70 pt-5"
      )}
    >
      {bullets.map((item) => (
        <li
          key={item.label}
          className="text-sm leading-relaxed tracking-[0.012em] text-foreground/90"
        >
          <strong className="font-semibold text-foreground">{item.label} </strong>
          <span className="text-muted-foreground">
            {item.body}
            {item.linkLabel && item.linkHref
              ? renderInlineLink(
                  item.linkLabel,
                  item.linkHref,
                  item.linkExternal
                )
              : null}
            {item.afterLink ?? ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SigaLegalDocument({ locale }: SigaLegalDocumentProps) {
  const content = SIGA_LEGAL_CONTENT[locale];
  const isSpanish = locale === "es";

  return (
    <div id="inicio" lang={content.htmlLang} className="min-h-screen bg-background text-foreground transition-colors">
      <a
        href="#contenido-legal"
        className="siga-legal-screen-only sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-xs focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        {content.skipToContentLabel}
      </a>

      <main className="siga-legal-main px-5 py-10 sm:px-8 sm:py-14">
        <div className="siga-legal-print-doc">
          <div className="siga-legal-print-head-space" aria-hidden="true">
            <div className="siga-legal-print-space-cell" />
          </div>

          <div className="siga-legal-print-body">
            <div className="siga-legal-print-cell">
              <div className="siga-legal-shell mx-auto w-full max-w-4xl">
                {/* Membrete institucional exclusivo para impresión / PDF */}
                <header className="siga-legal-letterhead" aria-hidden="true">
                  <div className="siga-legal-lh-row">
                    <Image
                      src="/images/institucion/logotipo.webp"
                      alt=""
                      width={68}
                      height={68}
                      priority
                      unoptimized
                      className="siga-legal-lh-logo"
                    />
                    <div className="siga-legal-lh-center">
                      <p className="siga-legal-lh-gov">
                        {content.letterhead.republic}
                      </p>
                      <p className="siga-legal-lh-min">
                        {content.letterhead.ministry}
                      </p>
                      <p className="siga-legal-lh-school">
                        {content.letterhead.school}
                      </p>
                      <p className="siga-legal-lh-addr">
                        {content.letterhead.address}
                      </p>
                    </div>
                    <dl className="siga-legal-lh-codes">
                      <div>
                        <dt>{content.letterhead.deaLabel}</dt>
                        <dd>{content.letterhead.deaValue}</dd>
                      </div>
                      <div>
                        <dt>{content.letterhead.rifLabel}</dt>
                        <dd>{content.letterhead.rifValue}</dd>
                      </div>
                      <div>
                        <dt>{content.letterhead.docLabel}</dt>
                        <dd>{content.letterhead.docValue}</dd>
                      </div>
                      <div>
                        <dt>{content.letterhead.dateLabel}</dt>
                        <dd>{content.letterhead.dateValue}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="siga-legal-lh-rule" />
                </header>

                {/* Barra superior en pantalla */}
                <header className="siga-legal-screen-only flex flex-wrap items-center justify-between gap-4 pb-8">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href="/"
                      className="inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.02em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                    >
                      <ArrowLeft className="size-3.5" aria-hidden="true" />
                      {content.backToSigaLabel}
                    </Link>
                    <span className="text-border" aria-hidden="true">
                      /
                    </span>
                    <a
                      href={SCHOOL_PORTAL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                    >
                      {content.mainPortalLabel}
                      <ArrowUpRight className="size-3" aria-hidden="true" />
                    </a>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={content.alternatePath}
                      hrefLang={isSpanish ? "en" : "es"}
                      lang={isSpanish ? "en" : "es"}
                      aria-label={content.alternateButtonAria}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <Globe className="size-3.5 shrink-0" aria-hidden="true" />
                      <span>{content.alternateButtonLabel}</span>
                    </Link>

                    <LegalPrintButton
                      label={content.printButtonLabel}
                      ariaLabel={content.printButtonAria}
                    />

                    <ThemeToggle
                      showLabel={isSpanish}
                      className="h-8 border-border bg-card px-3 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    />
                  </div>
                </header>

                {/* Encabezado editorial y metadatos de vigencia */}
                <section className="siga-legal-hero mb-8 rounded-3xl border border-border bg-card p-6 sm:p-10">
                  <div className="siga-legal-screen-only flex items-center gap-3">
                    <Image
                      src="/images/institucion/logotipo.webp"
                      alt='Escudo de la E.T.C. "Andrés Bello"'
                      width={36}
                      height={36}
                      priority
                      className="size-9 rounded-full object-contain"
                    />
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.14em] text-primary uppercase">
                      <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
                      {content.kicker}
                    </span>
                  </div>

                  <h1 className="siga-legal-hero-title font-hero mt-4 text-2xl leading-tight font-medium tracking-[0.005em] text-foreground sm:text-4xl">
                    {content.title}
                  </h1>

                  <p className="siga-legal-hero-lead mt-3 max-w-3xl text-sm leading-relaxed tracking-[0.012em] text-muted-foreground sm:text-[15px]">
                    {content.lead}
                  </p>

                  <dl
                    aria-label={content.metaAriaLabel}
                    className="siga-legal-meta mt-6 grid gap-3 border-t border-border/80 pt-5 sm:grid-cols-2 lg:grid-cols-4"
                  >
                    {content.meta.map((item) => (
                      <div key={item.label} className="flex flex-col gap-0.5">
                        <dt className="text-[11px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
                          {item.label}
                        </dt>
                        <dd className="text-sm font-medium text-foreground">
                          {item.href ? (
                            renderInlineLink(item.value, item.href)
                          ) : item.dateTime ? (
                            <time dateTime={item.dateTime}>{item.value}</time>
                          ) : (
                            item.value
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>

                {/* Índice navegable de 10 apartados (solo pantalla) */}
                <nav
                  aria-label={content.tocAriaLabel}
                  className="siga-legal-screen-only mb-8 rounded-2xl border border-border bg-card p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 pb-4">
                    <span className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
                      {content.tocTitle}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {content.tocHint}
                    </span>
                  </div>

                  <ol className="grid gap-2 sm:grid-cols-2">
                    {content.toc.map((entry) => (
                      <li key={entry.id}>
                        <a
                          href={`#${entry.id}`}
                          className="flex items-baseline gap-2.5 rounded-xl border border-border/70 bg-background/60 px-3.5 py-2.5 text-sm text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <span className="text-xs font-semibold tracking-[0.08em] text-primary">
                            {entry.number}
                          </span>
                          <span className="leading-snug">{entry.label}</span>
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>

                {/* Cláusulas 01 – 10 */}
                <section
                  id="contenido-legal"
                  aria-label={content.contentAriaLabel}
                  className="siga-legal-sections flex flex-col gap-6"
                >
                  {content.sections.map((section) => (
                    <article
                      key={section.id}
                      id={section.id}
                      className={cn(
                        "siga-legal-card scroll-mt-6 rounded-2xl border border-border bg-card p-6 sm:p-8",
                        section.breakableOnPrint && "siga-legal-card--breakable",
                        section.pageBreakBeforePrint &&
                          "siga-legal-card--page-break"
                      )}
                    >
                      <span className="siga-legal-card-index text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
                        {section.index}
                      </span>

                      <h2 className="siga-legal-card-title mt-2 font-sans text-xl font-medium tracking-[0.005em] text-foreground sm:text-2xl">
                        {section.title}
                      </h2>

                      {section.intro ? (
                        <p className="mt-2.5 text-sm leading-relaxed tracking-[0.012em] text-muted-foreground">
                          {section.intro}
                        </p>
                      ) : null}

                      {section.kvGrid ? (
                        <LegalKvGrid
                          items={section.kvGrid.items}
                          columns={section.kvGrid.columns}
                        />
                      ) : null}

                      {section.noteBox ? (
                        <LegalNote note={section.noteBox} />
                      ) : null}

                      {section.bullets ? (
                        <LegalBulletList bullets={section.bullets} />
                      ) : null}

                      {section.subSections
                        ? section.subSections.map((sub) => (
                            <div key={sub.title} className="mt-6">
                              <h3 className="siga-legal-subhead text-xs font-semibold tracking-[0.1em] text-foreground uppercase">
                                {sub.title}
                              </h3>
                              {sub.kvGrid ? (
                                <LegalKvGrid
                                  items={sub.kvGrid.items}
                                  columns={sub.kvGrid.columns}
                                />
                              ) : null}
                              {sub.bullets ? (
                                <LegalBulletList
                                  bullets={sub.bullets}
                                  borderTop={!sub.kvGrid}
                                />
                              ) : null}
                            </div>
                          ))
                        : null}

                      {section.cta ? (
                        <div className="siga-legal-screen-only mt-6">
                          <a
                            href={section.cta.href}
                            target={section.cta.external ? "_blank" : undefined}
                            rel={
                              section.cta.external
                                ? "noopener noreferrer"
                                : undefined
                            }
                            className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-medium tracking-[0.04em] text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            <span>{section.cta.label}</span>
                            <ArrowUpRight className="size-3.5" aria-hidden="true" />
                          </a>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </section>

                {/* Bloque de cierre institucional exclusivo para impresión / PDF */}
                <aside className="siga-legal-print-signoff" aria-hidden="true">
                  <div className="siga-legal-print-signoff-grid">
                    <div>
                      <p className="siga-legal-print-signoff-label">
                        {content.printSignoff.authorityHeading}
                      </p>
                      <p className="siga-legal-print-signoff-val">
                        <strong>{content.printSignoff.principalLabel}</strong>{" "}
                        {content.printSignoff.principalValue}
                      </p>
                      <p className="siga-legal-print-signoff-val">
                        {content.printSignoff.schoolLine}
                      </p>
                    </div>
                    <div>
                      <p className="siga-legal-print-signoff-label">
                        {content.printSignoff.verificationHeading}
                      </p>
                      <p className="siga-legal-print-signoff-val">
                        <strong>{content.printSignoff.portalLabel}</strong>{" "}
                        {content.printSignoff.portalValue}
                      </p>
                      <p className="siga-legal-print-signoff-val">
                        <strong>{content.printSignoff.contactLabel}</strong>{" "}
                        {content.printSignoff.contactValue}
                      </p>
                    </div>
                  </div>
                </aside>

                {/* Pie de página en pantalla */}
                <footer className="siga-legal-screen-only mt-10 flex flex-col gap-5 border-t border-border pt-6 text-xs tracking-[0.012em] text-muted-foreground">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <p>
                      {content.footer.copyright} ·{" "}
                      <a
                        href={`mailto:${SCHOOL_EMAIL}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {SCHOOL_EMAIL}
                      </a>
                    </p>
                    <p className="text-muted-foreground/85">
                      {content.footer.communityCredit}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-4">
                    <div className="flex flex-wrap items-center gap-5">
                      <Link
                        href={content.alternatePath}
                        hrefLang={isSpanish ? "en" : "es"}
                        lang={isSpanish ? "en" : "es"}
                        className="hover:text-foreground hover:underline"
                      >
                        {content.footer.alternateLinkLabel}
                      </Link>
                      <a
                        href={SIGA_REPO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                      >
                        {content.footer.repoLabel}
                        <ArrowUpRight className="size-3" aria-hidden="true" />
                      </a>
                      <Link
                        href="/"
                        className="font-medium text-primary hover:underline"
                      >
                        {content.footer.backHomeLabel}
                      </Link>
                    </div>

                    <a
                      href="#inicio"
                      className="inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ArrowUp className="size-3.5" aria-hidden="true" />
                      <span>{content.footer.backTopLabel}</span>
                    </a>
                  </div>
                </footer>
              </div>
            </div>
          </div>

          <div className="siga-legal-print-foot-space" aria-hidden="true">
            <div className="siga-legal-print-space-cell" />
          </div>
        </div>

        {/* Pie fijo en cada página impresa */}
        <div className="siga-legal-print-running-foot" aria-hidden="true">
          <span>{content.printRunningFooter.left}</span>
          <span>{content.printRunningFooter.right}</span>
        </div>
      </main>
    </div>
  );
}
