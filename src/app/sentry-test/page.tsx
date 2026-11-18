import { notFound } from "next/navigation";
import { SentryTestClientPanel } from "./SentryTestClientPanel";

export const dynamic = "force-dynamic";

export default function SentryTestPage() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SENTRY_TEST !== "true") {
    notFound();
  }

  return <SentryTestClientPanel />;
}
