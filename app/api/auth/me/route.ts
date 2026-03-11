import { cookies } from "next/headers";
import { readPortalSession, PORTAL_SESSION_COOKIE } from "@/lib/auth/portal";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const session = await readPortalSession(
    cookieStore.get(PORTAL_SESSION_COOKIE)?.value,
  );

  if (!session) {
    return Response.json({ user: null }, { status: 401 });
  }

  return Response.json({
    user: {
      id: session.portalUserId,
      discordId: session.discordId,
      username: session.username ?? null,
      avatar: session.avatar ?? null,
      email: session.email ?? null,
      isAdmin: session.isAdmin ?? false,
    },
  });
}
