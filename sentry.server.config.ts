import * as Sentry from "@sentry/nextjs";
import {
  SIGA_DATA_COLLECTION,
  getSentryEnvironment,
  getSentryTracesSampleRate,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
} from "@/lib/analytics/sentry-scrub";

const dsn = process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: getSentryEnvironment(),
  dataCollection: SIGA_DATA_COLLECTION,
  tracesSampleRate: getSentryTracesSampleRate(),
  integrations: [Sentry.serveTunnelIntegration()],
  beforeSend: scrubSentryEvent,
  beforeBreadcrumb: scrubSentryBreadcrumb,
});
