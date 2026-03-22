import {
  CATEGORIES,
  CategorySlug,
  MOCK_POSTS,
  PrototypePost,
} from "@/lib/prototype-data";
import { LOCALES, SupportedLocale } from "@/lib/i18n";
import { toPublicSignalId } from "@/lib/server/session-security";

export type EchoIntent = "perspective" | "question" | "experience";

export type ServerEcho = {
  id: string;
  text: string;
  intent: EchoIntent;
  createdAt: string;
  authorType: "author" | "echo";
  alias?: string;
};

type StoredPost = PrototypePost & {
  allowEchoes: boolean;
  authorSessionId: string;
};

type ModerationStore = {
  postsById: Map<string, StoredPost>;
  postOrder: string[];
  echoesByPost: Map<string, ServerEcho[]>;
  reportCountsByPost: Map<string, number>;
  reportersByPost: Map<string, Set<string>>;
  publishHitsBySession: Map<string, number[]>;
  echoHitsBySession: Map<string, number[]>;
  postCounter: number;
  echoCounter: number;
};

const REPORT_THRESHOLD = 3;
const SCAN_DELAY_MS = 1500;
const PUBLISH_RATE_WINDOW_MS = 60_000;
const ECHO_RATE_WINDOW_MS = 60_000;
const MAX_PUBLISHES_PER_WINDOW = 4;
const MAX_ECHOES_PER_WINDOW = 8;
const MIN_PUBLISH_INTERVAL_MS = 2500;
const MIN_ECHO_INTERVAL_MS = 1000;

const categorySet = new Set<CategorySlug>(CATEGORIES.map((entry) => entry.slug));
const localeSet = new Set<SupportedLocale>(LOCALES);
const echoIntentSet = new Set<EchoIntent>([
  "perspective",
  "question",
  "experience",
]);
const echoNamePool = [
  "Nova",
  "Atlas",
  "Drift",
  "Solace",
  "Orbit",
  "Harbor",
  "Lumen",
  "Mosaic",
  "Aurora",
  "Sierra",
];

function hashSeed(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickEchoAlias(seed: string) {
  const aliasIndex = hashSeed(seed) % echoNamePool.length;
  return `Echo ${echoNamePool[aliasIndex]}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeCountryCode(input: string) {
  const normalized = input.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : "US";
}

function enforceRateLimit(options: {
  hitsBySession: Map<string, number[]>;
  sessionId: string;
  windowMs: number;
  maxHitsInWindow: number;
  minIntervalMs: number;
  actionName: string;
}) {
  const now = Date.now();
  const currentHits = options.hitsBySession.get(options.sessionId) || [];
  const recentHits = currentHits.filter((timestamp) => now - timestamp <= options.windowMs);
  const latest = recentHits[recentHits.length - 1];

  if (latest && now - latest < options.minIntervalMs) {
    throw new ModerationError(
      `Slow down. ${options.actionName} actions are rate-limited.`,
      429,
    );
  }

  if (recentHits.length >= options.maxHitsInWindow) {
    throw new ModerationError(
      `Rate limit reached for ${options.actionName}. Try again shortly.`,
      429,
    );
  }

  recentHits.push(now);
  options.hitsBySession.set(options.sessionId, recentHits);
}

function createInitialStore(): ModerationStore {
  const postsById = new Map<string, StoredPost>();
  const postOrder: string[] = [];
  const reportCountsByPost = new Map<string, number>();
  const reportersByPost = new Map<string, Set<string>>();

  MOCK_POSTS.forEach((post, index) => {
    const storedPost: StoredPost = {
      ...post,
      allowEchoes: index % 4 !== 0,
      authorSessionId: `seed-author-${index + 1}`,
    };

    postsById.set(storedPost.id, storedPost);
    postOrder.push(storedPost.id);
    reportCountsByPost.set(storedPost.id, storedPost.baseReports);
    reportersByPost.set(storedPost.id, new Set());
  });

  const echoesByPost = new Map<string, ServerEcho[]>();
  echoesByPost.set("post-1", [
    {
      id: "echo-seed-1",
      text: "I have seen this work in small workshops. It changes the tone instantly.",
      intent: "experience",
      createdAt: "2026-03-22T07:35:00.000Z",
      authorType: "echo",
      alias: "Echo Atlas",
    },
  ]);
  echoesByPost.set("post-2", [
    {
      id: "echo-seed-2",
      text: "Could this be hosted weekly in schools too?",
      intent: "question",
      createdAt: "2026-03-22T06:20:00.000Z",
      authorType: "echo",
      alias: "Echo Nova",
    },
    {
      id: "echo-seed-3",
      text: "Yes, but only if facilitators are trained to hold silence safely.",
      intent: "perspective",
      createdAt: "2026-03-22T06:10:00.000Z",
      authorType: "author",
    },
  ]);
  echoesByPost.set("post-5", [
    {
      id: "echo-seed-4",
      text: "Hard truth. Shared docs plus async votes would solve half of this.",
      intent: "perspective",
      createdAt: "2026-03-21T15:55:00.000Z",
      authorType: "echo",
      alias: "Echo Lumen",
    },
  ]);

  return {
    postsById,
    postOrder,
    echoesByPost,
    reportCountsByPost,
    reportersByPost,
    publishHitsBySession: new Map<string, number[]>(),
    echoHitsBySession: new Map<string, number[]>(),
    postCounter: 0,
    echoCounter: 0,
  };
}

declare global {
  var __quietSignalModerationStore: ModerationStore | undefined;
}

const store =
  globalThis.__quietSignalModerationStore || createInitialStore();

if (process.env.NODE_ENV !== "production") {
  globalThis.__quietSignalModerationStore = store;
}

export class ModerationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ModerationError";
    this.status = status;
  }
}

export async function publishSignal(
  sessionId: string,
  payload: {
    category: string;
    content: string;
    languageCode: string;
    countryCode: string;
    allowEchoes: boolean;
  },
) {
  const content = payload.content.trim();
  if (!content || content.length > 1200) {
    throw new ModerationError("Post content must be between 1 and 1200 characters.");
  }

  if (!categorySet.has(payload.category as CategorySlug)) {
    throw new ModerationError("Unsupported category.");
  }

  if (!localeSet.has(payload.languageCode as SupportedLocale)) {
    throw new ModerationError("Unsupported language.");
  }

  enforceRateLimit({
    hitsBySession: store.publishHitsBySession,
    sessionId,
    windowMs: PUBLISH_RATE_WINDOW_MS,
    maxHitsInWindow: MAX_PUBLISHES_PER_WINDOW,
    minIntervalMs: MIN_PUBLISH_INTERVAL_MS,
    actionName: "publish",
  });

  await sleep(SCAN_DELAY_MS);

  store.postCounter += 1;
  const newPost: StoredPost = {
    id: `srv-${Date.now()}-${store.postCounter}`,
    category: payload.category as CategorySlug,
    content,
    createdAt: new Date().toISOString(),
    language_code: payload.languageCode as SupportedLocale,
    country_code: sanitizeCountryCode(payload.countryCode),
    baseReports: 0,
    baseReactions: {
      agree: 0,
      feel_this_too: 0,
      brilliant_idea: 0,
    },
    allowEchoes: Boolean(payload.allowEchoes),
    authorSessionId: sessionId,
  };

  store.postsById.set(newPost.id, newPost);
  store.postOrder.unshift(newPost.id);
  store.echoesByPost.set(newPost.id, []);
  store.reportCountsByPost.set(newPost.id, 0);
  store.reportersByPost.set(newPost.id, new Set());

  return {
    post: toPrototypePost(newPost),
    reportCount: 0,
    allowEchoes: newPost.allowEchoes,
    authorTag: toPublicSignalId(sessionId),
  };
}

export async function sendEcho(
  sessionId: string,
  payload: {
    postId: string;
    text: string;
    intent: string;
  },
) {
  const post = store.postsById.get(payload.postId);
  if (!post) {
    throw new ModerationError("This signal no longer exists.", 404);
  }

  const reportCount = store.reportCountsByPost.get(post.id) ?? post.baseReports;
  if (reportCount >= REPORT_THRESHOLD) {
    throw new ModerationError("This signal is no longer accepting replies.", 409);
  }

  if (!post.allowEchoes) {
    throw new ModerationError("Echoes are disabled for this signal.", 403);
  }

  const text = payload.text.trim();
  if (!text || text.length > 600) {
    throw new ModerationError("Echo text must be between 1 and 600 characters.");
  }

  if (!echoIntentSet.has(payload.intent as EchoIntent)) {
    throw new ModerationError("Invalid Echo intent.");
  }

  enforceRateLimit({
    hitsBySession: store.echoHitsBySession,
    sessionId,
    windowMs: ECHO_RATE_WINDOW_MS,
    maxHitsInWindow: MAX_ECHOES_PER_WINDOW,
    minIntervalMs: MIN_ECHO_INTERVAL_MS,
    actionName: "echo",
  });

  await sleep(SCAN_DELAY_MS);

  const isAuthorReply = post.authorSessionId === sessionId;
  store.echoCounter += 1;

  const echo: ServerEcho = {
    id: `echo-srv-${Date.now()}-${store.echoCounter}`,
    text,
    intent: payload.intent as EchoIntent,
    createdAt: new Date().toISOString(),
    authorType: isAuthorReply ? "author" : "echo",
    alias: isAuthorReply ? undefined : pickEchoAlias(`${post.id}:${sessionId}`),
  };

  const currentEchoes = store.echoesByPost.get(post.id) || [];
  currentEchoes.push(echo);
  store.echoesByPost.set(post.id, currentEchoes);

  return { echo };
}

export function reportSignal(sessionId: string, postId: string) {
  const post = store.postsById.get(postId);
  if (!post) {
    throw new ModerationError("This signal no longer exists.", 404);
  }

  const reporters = store.reportersByPost.get(postId) || new Set<string>();
  const currentCount = store.reportCountsByPost.get(postId) ?? post.baseReports;

  if (reporters.has(sessionId)) {
    return {
      alreadyReported: true,
      reportCount: currentCount,
      hidden: currentCount >= REPORT_THRESHOLD,
    };
  }

  reporters.add(sessionId);
  store.reportersByPost.set(postId, reporters);
  const nextCount = currentCount + 1;
  store.reportCountsByPost.set(postId, nextCount);

  return {
    alreadyReported: false,
    reportCount: nextCount,
    hidden: nextCount >= REPORT_THRESHOLD,
  };
}

function toPrototypePost(post: StoredPost): PrototypePost {
  return {
    id: post.id,
    category: post.category,
    content: post.content,
    createdAt: post.createdAt,
    language_code: post.language_code,
    country_code: post.country_code,
    baseReports: post.baseReports,
    baseReactions: post.baseReactions,
  };
}
