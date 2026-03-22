import { createHash, randomUUID } from "node:crypto";

export const SESSION_COOKIE_NAME = "qs_sid";

const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_PUBLIC_SALT =
  process.env.QUIETSIGNAL_SESSION_SALT || "quietsignal-session-salt-v1";

export const sessionCookieOptions = {
  path: "/",
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const,
  maxAge: 60 * 60 * 24 * 30,
};

export function createServerSessionId() {
  return randomUUID();
}

export function isValidServerSessionId(value: string | undefined) {
  if (!value) {
    return false;
  }

  return SESSION_ID_PATTERN.test(value);
}

export function toPublicSignalId(sessionId: string) {
  const digest = createHash("sha256")
    .update(`${SESSION_PUBLIC_SALT}:${sessionId}`)
    .digest("hex");

  return `sig-${digest.slice(0, 16)}`;
}
