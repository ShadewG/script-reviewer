import { NextRequest, NextResponse } from "next/server";
import {
  buildPortalRedirectUrl,
  PORTAL_SESSION_COOKIE,
  readPortalSession,
} from "@/lib/auth/portal";

const PUBLIC_PATHS = new Set(["/auth/portal", "/favicon.ico"]);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/generated/")) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const session = await readPortalSession(req.cookies.get(PORTAL_SESSION_COOKIE)?.value);
  if (session) {
    return NextResponse.next();
  }

  const redirectUrl = buildPortalRedirectUrl(req.nextUrl);

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "Authentication required",
        redirectTo: redirectUrl.toString(),
      },
      { status: 401 }
    );
  }

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
