import { NextRequest, NextResponse } from "next/server";
import {
  ModerationError,
  publishSignal,
  reportSignal,
  sendEcho,
} from "@/lib/server/moderation-store";
import {
  createServerSessionId,
  isValidServerSessionId,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/server/session-security";

type ModerationRequestBody =
  | {
      action: "publish";
      payload: {
        category: string;
        content: string;
        languageCode: string;
        countryCode: string;
        allowEchoes: boolean;
      };
    }
  | {
      action: "echo";
      payload: {
        postId: string;
        text: string;
        intent: string;
      };
    }
  | {
      action: "report";
      payload: {
        postId: string;
      };
    };

function resolveSessionId(request: NextRequest) {
  const rawSession = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (isValidServerSessionId(rawSession)) {
    return { sessionId: rawSession, shouldSetCookie: false };
  }

  return { sessionId: createServerSessionId(), shouldSetCookie: true };
}

export async function POST(request: NextRequest) {
  const { sessionId, shouldSetCookie } = resolveSessionId(request);

  let body: ModerationRequestBody;
  try {
    body = (await request.json()) as ModerationRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  try {
    let response: NextResponse;

    if (body.action === "publish") {
      const published = await publishSignal(sessionId, body.payload);
      response = NextResponse.json(published);
    } else if (body.action === "echo") {
      const echoed = await sendEcho(sessionId, body.payload);
      response = NextResponse.json(echoed);
    } else if (body.action === "report") {
      const reportOutcome = reportSignal(sessionId, body.payload.postId);
      response = NextResponse.json(reportOutcome);
    } else {
      response = NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    }

    if (shouldSetCookie) {
      response.cookies.set(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions);
    }

    return response;
  } catch (error) {
    if (error instanceof ModerationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Moderation request failed." },
      { status: 500 },
    );
  }
}
