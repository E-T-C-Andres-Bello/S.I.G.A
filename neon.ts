import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  auth: false,
  buckets: {
    // "private" is the default; use "public_read" for anonymous reads
    assets: { access: "private" },
    uploads: { access: "private" },
    "student-avatars": { access: "public_read" },
    "school-announcements": { access: "public_read" },
  },
  functions: {
    studentreqmail: {
      name: "Workflow Trámites Estudiantiles",
      source: "./neon/functions/workflow-student-request-email/index.ts",
      env: {
        WORKFLOW_WEBHOOK_SECRET: {
          value: process.env.WORKFLOW_WEBHOOK_SECRET,
          required: false,
          onUndefined: "skip",
        },
        N8N_WEBHOOK_URL_STUDENT_REQUEST: {
          value: process.env.N8N_WEBHOOK_URL_STUDENT_REQUEST,
          required: false,
          onUndefined: "skip",
        },
        N8N_WEBHOOK_SECRET: {
          value: process.env.N8N_WEBHOOK_SECRET,
          required: false,
          onUndefined: "skip",
        },
        CONTROL_ESTUDIOS_NOTIFY_EMAIL: {
          value: process.env.CONTROL_ESTUDIOS_NOTIFY_EMAIL,
          required: false,
          onUndefined: "skip",
        },
        SIGA_PORTAL_BASE_URL: {
          value:
            process.env.SIGA_PORTAL_BASE_URL ??
            process.env.NEXT_PUBLIC_APP_URL,
          required: false,
          onUndefined: "skip",
        },
      },
    },
    bulletinai: {
      name: "Asistente IA Cartelera Bellista",
      source: "./neon/functions/workflow-bulletin-ai-assistant/index.ts",
      env: {
        WORKFLOW_WEBHOOK_SECRET: {
          value: process.env.WORKFLOW_WEBHOOK_SECRET,
          required: false,
          onUndefined: "skip",
        },
        N8N_WEBHOOK_URL_BULLETIN_AI: {
          value: process.env.N8N_WEBHOOK_URL_BULLETIN_AI,
          required: false,
          onUndefined: "skip",
        },
        N8N_WEBHOOK_BASE_URL: {
          value: process.env.N8N_WEBHOOK_BASE_URL,
          required: false,
          onUndefined: "skip",
        },
        N8N_WEBHOOK_SECRET: {
          value: process.env.N8N_WEBHOOK_SECRET,
          required: false,
          onUndefined: "skip",
        },
      },
    },
    bulletinnotify: {
      name: "Notificaciones Email Cartelera Bellista",
      source: "./neon/functions/workflow-bulletin-publish-email/index.ts",
      env: {
        WORKFLOW_WEBHOOK_SECRET: {
          value: process.env.WORKFLOW_WEBHOOK_SECRET,
          required: false,
          onUndefined: "skip",
        },
        N8N_WEBHOOK_URL_BULLETIN_PUBLISH: {
          value: process.env.N8N_WEBHOOK_URL_BULLETIN_PUBLISH,
          required: false,
          onUndefined: "skip",
        },
        N8N_WEBHOOK_BASE_URL: {
          value: process.env.N8N_WEBHOOK_BASE_URL,
          required: false,
          onUndefined: "skip",
        },
        N8N_WEBHOOK_SECRET: {
          value: process.env.N8N_WEBHOOK_SECRET,
          required: false,
          onUndefined: "skip",
        },
        SIGA_PORTAL_BASE_URL: {
          value:
            process.env.SIGA_PORTAL_BASE_URL ??
            process.env.NEXT_PUBLIC_APP_URL,
          required: false,
          onUndefined: "skip",
        },
      },
    },
    portfoliocoach: {
      name: "Coach IA Portafolio y CV",
      source: "./neon/functions/workflow-portfolio-ai-coach/index.ts",
      env: {
        WORKFLOW_WEBHOOK_SECRET: {
          value: process.env.WORKFLOW_WEBHOOK_SECRET,
          required: false,
          onUndefined: "skip",
        },
        N8N_WEBHOOK_URL_PORTFOLIO_AI: {
          value: process.env.N8N_WEBHOOK_URL_PORTFOLIO_AI,
          required: false,
          onUndefined: "skip",
        },
        N8N_WEBHOOK_BASE_URL: {
          value: process.env.N8N_WEBHOOK_BASE_URL,
          required: false,
          onUndefined: "skip",
        },
        N8N_WEBHOOK_SECRET: {
          value: process.env.N8N_WEBHOOK_SECRET,
          required: false,
          onUndefined: "skip",
        },
      },
    },
  },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
