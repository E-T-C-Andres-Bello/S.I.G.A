import { NextResponse } from "next/server";
import { analyticsFilterSchema } from "@/features/analitica/schemas";
import { getInstitutionalAnalyticsData } from "@/features/analitica/server";
import { getAuthenticatedDashboardContext } from "@/lib/supabase/dashboard-session";

export async function GET(request: Request) {
  const profile = await getAuthenticatedDashboardContext();
  const { searchParams } = new URL(request.url);

  const rawSchoolYearId = searchParams.get("schoolYearId");
  const rawMomento = searchParams.get("momentoNumber");

  const parsedFilters = analyticsFilterSchema.safeParse({
    schoolYearId: rawSchoolYearId ? rawSchoolYearId : null,
    momentoNumber: rawMomento ? Number(rawMomento) : null,
  });

  if (!parsedFilters.success) {
    return NextResponse.json(
      { error: "Parámetros de consulta inválidos." },
      { status: 400 }
    );
  }

  const result = await getInstitutionalAnalyticsData(profile, parsedFilters.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 403 });
  }

  return NextResponse.json(result.data, { status: 200 });
}

