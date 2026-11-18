import { handleStudentRequestEmailWorkflow } from "../workflows/student-request-email/handler.ts";

Deno.serve(handleStudentRequestEmailWorkflow);
