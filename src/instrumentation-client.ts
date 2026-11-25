import * as Sentry from "@sentry/nextjs";
import {
  SIGA_DATA_COLLECTION,
  getSentryEnvironment,
  getSentryTracesSampleRate,
  isSentryRuntimeEnabled,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
} from "@/lib/analytics/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
const sentryActive = isSentryRuntimeEnabled(dsn);

if (sentryActive) {
  Sentry.init({
    dsn,
    enabled: true,
    environment: getSentryEnvironment(),
    dataCollection: SIGA_DATA_COLLECTION,
    tunnel: true,
    tracesSampleRate: getSentryTracesSampleRate(),
    beforeSend: scrubSentryEvent,
    beforeBreadcrumb: scrubSentryBreadcrumb,
  });
}

export const onRouterTransitionStart = sentryActive
  ? Sentry.captureRouterTransitionStart
  : () => {};
