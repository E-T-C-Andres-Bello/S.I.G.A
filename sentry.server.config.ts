import * as Sentry from "@sentry/nextjs";
import {
  SIGA_DATA_COLLECTION,
  getSentryEnvironment,
  getSentryTracesSampleRate,
  isSentryRuntimeEnabled,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
} from "@/lib/analytics/sentry-scrub";

const dsn =
  process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

if (isSentryRuntimeEnabled(dsn)) {
  Sentry.init({
    dsn,
    enabled: true,
    environment: getSentryEnvironment(),
    dataCollection: SIGA_DATA_COLLECTION,
    tracesSampleRate: getSentryTracesSampleRate(),
    integrations: [Sentry.serveTunnelIntegration()],
    beforeSend: scrubSentryEvent,
    beforeBreadcrumb: scrubSentryBreadcrumb,
  });
}
