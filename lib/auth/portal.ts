import { jwtVerify, SignJWT, type JWTPayload } from "jose";

export const SCRIPT_REVIEWER_APP_ID = "script-reviewer";
export const PORTAL_SESSION_COOKIE = "script_shield_portal_session";
export const PORTAL_SESSION_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;
const PORTAL_BASE_URL_FALLBACK = "https://portal-production-fa69.up.railway.app";

type PortalTokenPayload = JWTPayload & {
  portalUserId?: string;
  discordId?: string;
  email?: string;
  username?: string;
  avatar?: string;
  isAdmin?: boolean;
  appId?: string;
  appUserId?: string;
};

export type PortalSession = {
  kind: "script-reviewer-session";
  portalUserId: string;
  discordId: string;
  email?: string;
  username?: string;
  avatar?: string;
  isAdmin?: boolean;
  appId: typeof SCRIPT_REVIEWER_APP_ID;
  appUserId?: string;
  iat?: number;
  exp?: number;
};

function getPortalSecret() {
  const secret = process.env.PORTAL_JWT_SECRET;
  if (!secret) {
    throw new Error("PORTAL_JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export function getPortalBaseUrl() {
  return (process.env.PORTAL_BASE_URL || PORTAL_BASE_URL_FALLBACK).replace(/\/$/, "");
}

function normalizeNextPath(nextPath?: string | null) {
  if (!nextPath) return "/";
  if (!nextPath.startsWith("/")) return "/";
  if (nextPath.startsWith("//")) return "/";
  return nextPath;
}

function coercePortalPayload(payload: PortalTokenPayload): Omit<PortalSession, "kind"> {
  if (payload.appId !== SCRIPT_REVIEWER_APP_ID) {
    throw new Error("Portal token app mismatch");
  }
  if (!payload.portalUserId || !payload.discordId) {
    throw new Error("Portal token missing required claims");
  }
  return {
    portalUserId: payload.portalUserId,
    discordId: payload.discordId,
    email: payload.email,
    username: payload.username,
    avatar: payload.avatar,
    isAdmin: payload.isAdmin,
    appId: SCRIPT_REVIEWER_APP_ID,
    appUserId: payload.appUserId,
    iat: payload.iat,
    exp: payload.exp,
  };
}

export async function verifyPortalHandoffToken(token: string) {
  const { payload } = await jwtVerify<PortalTokenPayload>(token, getPortalSecret(), {
    algorithms: ["HS256"],
  });
  return coercePortalPayload(payload);
}

export async function signPortalSession(session: Omit<PortalSession, "kind" | "iat" | "exp">) {
  return new SignJWT({
    kind: "script-reviewer-session",
    portalUserId: session.portalUserId,
    discordId: session.discordId,
    email: session.email,
    username: session.username,
    avatar: session.avatar,
    isAdmin: session.isAdmin,
    appId: SCRIPT_REVIEWER_APP_ID,
    appUserId: session.appUserId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PORTAL_SESSION_MAX_AGE_SECONDS}s`)
    .sign(getPortalSecret());
}

export async function readPortalSession(cookieValue?: string | null): Promise<PortalSession | null> {
  if (!cookieValue) return null;
  try {
    const { payload } = await jwtVerify<PortalTokenPayload & { kind?: string }>(
      cookieValue,
      getPortalSecret(),
      { algorithms: ["HS256"] }
    );
    if (payload.kind !== "script-reviewer-session") {
      return null;
    }
    return {
      kind: "script-reviewer-session",
      ...coercePortalPayload(payload),
    };
  } catch {
    return null;
  }
}

export function buildPortalRedirectUrl(source: URL, nextPath?: string | null) {
  const redirectUrl = new URL("/api/auth/redirect", getPortalBaseUrl());
  redirectUrl.searchParams.set("app", SCRIPT_REVIEWER_APP_ID);
  redirectUrl.searchParams.set("returnTo", source.origin);
  redirectUrl.searchParams.set("next", normalizeNextPath(nextPath ?? `${source.pathname}${source.search}`));
  return redirectUrl;
}

export function getPortalSessionCookieConfig() {
  return {
    name: PORTAL_SESSION_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PORTAL_SESSION_MAX_AGE_SECONDS,
  };
}
