import { NextResponse } from "next/server";
import { getServerAuthSession, isAuthConfigured } from "@/lib/auth/server";
import { verifyPreEnrolledAccess } from "@/lib/auth/verification";
import { withUserDb } from "@/lib/db/neon";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  if (!isAuthConfigured()) {
    return NextResponse.json({ ok: false, items: [] }, { status: 503 });
  }

  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json({ ok: false, items: [] }, { status: 401 });
  }

  const verification = await verifyPreEnrolledAccess({
    authUserId: session.authUserId,
    email: session.email,
    loginMethod: "credentials",
  });

  if (!verification.ok) {
    return NextResponse.json({ ok: false, items: [] }, { status: 403 });
  }

  try {
    const rows = await withUserDb(
      { authUserId: session.authUserId, email: session.email },
      async (client) => {
        const res = await client.query<{
          id: string;
          category: string;
          title: string;
          body: string;
          action_url: string | null;
          is_read: boolean;
          read_at: string | null;
          created_at: string;
        }>(
          `SELECT id, category, title, body, action_url, is_read, read_at, created_at
             FROM public.notifications
            WHERE recipient_user_id = $1::uuid
            ORDER BY created_at DESC
            LIMIT 40`,
          [verification.internalUserId]
        );
        return res.rows;
      }
    );

    const items = rows.map((row) => ({
      id: row.id,
      category: row.category,
      title: row.title,
      body: row.body,
      actionUrl: row.action_url,
      isRead: row.is_read,
      readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
    }));

    return NextResponse.json({ ok: true, items });
  } catch {
    return NextResponse.json({ ok: false, items: [] }, { status: 500 });
  }
}
