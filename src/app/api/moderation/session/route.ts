import { NextRequest, NextResponse } from "next/server";
import {
  createServerSessionId,
  isValidServerSessionId,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  toPublicSignalId,
} from "@/lib/server/session-security";

function resolveSessionId(request: NextRequest) {
  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (isValidServerSessionId(cookieValue)) {
    return { sessionId: cookieValue, shouldSetCookie: false };
  }

  return { sessionId: createServerSessionId(), shouldSetCookie: true };
}

export async function GET(request: NextRequest) {
  const { sessionId, shouldSetCookie } = resolveSessionId(request);
  const response = NextResponse.json({
    publicSessionId: toPublicSignalId(sessionId),
  });

  if (shouldSetCookie) {
    response.cookies.set(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions);
  }

  return response;
}

export async function POST() {
  const nextSessionId = createServerSessionId();
  const response = NextResponse.json({
    publicSessionId: toPublicSignalId(nextSessionId),
  });

  response.cookies.set(SESSION_COOKIE_NAME, nextSessionId, sessionCookieOptions);

  return response;
}
