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

function getPublicOrigin(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) return `${proto}://${host}`;
  return req.nextUrl.origin;
}

export async function GET(req: NextRequest) {
  const portalToken = req.nextUrl.searchParams.get("portal_token");
  const nextPath = normalizeNextPath(req.nextUrl.searchParams.get("next"));
  const origin = getPublicOrigin(req);

  if (!portalToken) {
    return NextResponse.redirect(new URL("/", origin));
  }

  try {
    const handoff = await verifyPortalHandoffToken(portalToken);
    const sessionToken = await signPortalSession(handoff);
    const response = NextResponse.redirect(new URL(nextPath, origin));
    response.cookies.set({
      ...getPortalSessionCookieConfig(),
      value: sessionToken,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/", origin));
  }
}
