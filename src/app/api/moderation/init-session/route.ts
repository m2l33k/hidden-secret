import { NextResponse } from "next/server";
import {
  createServerSessionId,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  toPublicSignalId,
} from "@/lib/server/session-security";

export async function GET() {
  const sessionId = createServerSessionId();
  const response = NextResponse.json({
    publicSessionId: toPublicSignalId(sessionId),
  });

  response.cookies.set(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions);
  return response;
}
