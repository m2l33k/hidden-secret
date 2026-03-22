import { NextRequest, NextResponse } from "next/server";
import {
  ModerationError,
  publishSignal,
  reportSignal,
  sendEcho,
} from "@/lib/server/moderation-store";
import {
  isValidServerSessionId,
  SESSION_COOKIE_NAME,
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
    return rawSession;
  }

  return null;
}

export async function POST(request: NextRequest) {
  const sessionId = resolveSessionId(request);
  if (!sessionId) {
    return NextResponse.json(
      { error: "Unauthorized. Initialize session first." },
      { status: 401 },
    );
  }

  let body: ModerationRequestBody;
  try {
    body = (await request.json()) as ModerationRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  try {
    if (body.action === "publish") {
      const published = await publishSignal(sessionId, body.payload);
      return NextResponse.json(published);
    }

    if (body.action === "echo") {
      const echoed = await sendEcho(sessionId, body.payload);
      return NextResponse.json(echoed);
    }

    if (body.action === "report") {
      const reportOutcome = await reportSignal(sessionId, body.payload.postId);
      return NextResponse.json(reportOutcome);
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
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
