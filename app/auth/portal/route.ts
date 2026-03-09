import { NextRequest, NextResponse } from "next/server";
import {
  getPortalSessionCookieConfig,
  signPortalSession,
  verifyPortalHandoffToken,
} from "@/lib/auth/portal";

function normalizeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }
  return nextPath;
}

export async function GET(req: NextRequest) {
  const portalToken = req.nextUrl.searchParams.get("portal_token");
  const nextPath = normalizeNextPath(req.nextUrl.searchParams.get("next"));

  if (!portalToken) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  try {
    const handoff = await verifyPortalHandoffToken(portalToken);
    const sessionToken = await signPortalSession(handoff);
    const response = NextResponse.redirect(new URL(nextPath, req.nextUrl));
    response.cookies.set({
      ...getPortalSessionCookieConfig(),
      value: sessionToken,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
}
