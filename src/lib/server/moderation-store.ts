import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
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

type PersistedStore = {
  version: 1;
  postsById: Record<string, StoredPost>;
  postOrder: string[];
  echoesByPost: Record<string, ServerEcho[]>;
  reportCountsByPost: Record<string, number>;
  reportersByPost: Record<string, string[]>;
  publishHitsBySession: Record<string, number[]>;
  echoHitsBySession: Record<string, number[]>;
  postCounter: number;
  echoCounter: number;
};

interface ModerationRepository {
  load(): Promise<PersistedStore>;
  save(store: PersistedStore): Promise<void>;
}

const REPORT_THRESHOLD = 3;
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

const STORE_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(STORE_DIR, "moderation-store.json");

let mutationQueue: Promise<void> = Promise.resolve();

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

function sanitizeCountryCode(input: string) {
  const normalized = input.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : "US";
}

function enforceRateLimit(options: {
  hitsBySession: Record<string, number[]>;
  sessionId: string;
  windowMs: number;
  maxHitsInWindow: number;
  minIntervalMs: number;
  actionName: string;
}) {
  const now = Date.now();
  const sessionHits = options.hitsBySession[options.sessionId] || [];
  const recentHits = sessionHits.filter(
    (timestamp) => now - timestamp <= options.windowMs,
  );
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
  options.hitsBySession[options.sessionId] = recentHits;
}

function createInitialStore(): PersistedStore {
  const postsById: Record<string, StoredPost> = {};
  const postOrder: string[] = [];
  const reportCountsByPost: Record<string, number> = {};
  const reportersByPost: Record<string, string[]> = {};

  MOCK_POSTS.forEach((post, index) => {
    const storedPost: StoredPost = {
      ...post,
      allowEchoes: index % 4 !== 0,
      authorSessionId: `seed-author-${index + 1}`,
    };

    postsById[storedPost.id] = storedPost;
    postOrder.push(storedPost.id);
    reportCountsByPost[storedPost.id] = storedPost.baseReports;
    reportersByPost[storedPost.id] = [];
  });

  const echoesByPost: Record<string, ServerEcho[]> = {
    "post-1": [
      {
        id: "echo-seed-1",
        text: "I have seen this work in small workshops. It changes the tone instantly.",
        intent: "experience",
        createdAt: "2026-03-22T07:35:00.000Z",
        authorType: "echo",
        alias: "Echo Atlas",
      },
    ],
    "post-2": [
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
    ],
    "post-5": [
      {
        id: "echo-seed-4",
        text: "Hard truth. Shared docs plus async votes would solve half of this.",
        intent: "perspective",
        createdAt: "2026-03-21T15:55:00.000Z",
        authorType: "echo",
        alias: "Echo Lumen",
      },
    ],
  };

  return {
    version: 1,
    postsById,
    postOrder,
    echoesByPost,
    reportCountsByPost,
    reportersByPost,
    publishHitsBySession: {},
    echoHitsBySession: {},
    postCounter: 0,
    echoCounter: 0,
  };
}

class FileModerationRepository implements ModerationRepository {
  private initialized = false;

  private async ensureInitialized() {
    if (this.initialized) {
      return;
    }

    await mkdir(STORE_DIR, { recursive: true });
    try {
      await readFile(STORE_FILE, "utf8");
    } catch {
      await this.save(createInitialStore());
    }

    this.initialized = true;
  }

  async load(): Promise<PersistedStore> {
    await this.ensureInitialized();
    const raw = await readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as PersistedStore;
    return normalizeStore(parsed);
  }

  async save(store: PersistedStore): Promise<void> {
    await mkdir(STORE_DIR, { recursive: true });
    const tempFile = `${STORE_FILE}.tmp`;
    await writeFile(tempFile, JSON.stringify(store, null, 2), "utf8");
    await rename(tempFile, STORE_FILE);
  }
}

function normalizeStore(store: PersistedStore): PersistedStore {
  return {
    version: 1,
    postsById: store.postsById || {},
    postOrder: store.postOrder || [],
    echoesByPost: store.echoesByPost || {},
    reportCountsByPost: store.reportCountsByPost || {},
    reportersByPost: store.reportersByPost || {},
    publishHitsBySession: store.publishHitsBySession || {},
    echoHitsBySession: store.echoHitsBySession || {},
    postCounter: typeof store.postCounter === "number" ? store.postCounter : 0,
    echoCounter: typeof store.echoCounter === "number" ? store.echoCounter : 0,
  };
}

const repository: ModerationRepository = new FileModerationRepository();

async function runMutation<T>(
  mutator: (store: PersistedStore) => Promise<T> | T,
): Promise<T> {
  const task = mutationQueue.then(async () => {
    const store = await repository.load();
    const result = await mutator(store);
    await repository.save(store);
    return result;
  });

  mutationQueue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
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
    throw new ModerationError(
      "Post content must be between 1 and 1200 characters.",
    );
  }

  if (!categorySet.has(payload.category as CategorySlug)) {
    throw new ModerationError("Unsupported category.");
  }

  if (!localeSet.has(payload.languageCode as SupportedLocale)) {
    throw new ModerationError("Unsupported language.");
  }

  return runMutation((store) => {
    enforceRateLimit({
      hitsBySession: store.publishHitsBySession,
      sessionId,
      windowMs: PUBLISH_RATE_WINDOW_MS,
      maxHitsInWindow: MAX_PUBLISHES_PER_WINDOW,
      minIntervalMs: MIN_PUBLISH_INTERVAL_MS,
      actionName: "publish",
    });

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

    store.postsById[newPost.id] = newPost;
    store.postOrder.unshift(newPost.id);
    store.echoesByPost[newPost.id] = [];
    store.reportCountsByPost[newPost.id] = 0;
    store.reportersByPost[newPost.id] = [];

    return {
      post: toPrototypePost(newPost),
      reportCount: 0,
      allowEchoes: newPost.allowEchoes,
      authorTag: toPublicSignalId(sessionId),
    };
  });
}

export async function sendEcho(
  sessionId: string,
  payload: {
    postId: string;
    text: string;
    intent: string;
  },
) {
  const text = payload.text.trim();
  if (!text || text.length > 600) {
    throw new ModerationError("Echo text must be between 1 and 600 characters.");
  }

  if (!echoIntentSet.has(payload.intent as EchoIntent)) {
    throw new ModerationError("Invalid Echo intent.");
  }

  return runMutation((store) => {
    const post = store.postsById[payload.postId];
    if (!post) {
      throw new ModerationError("This signal no longer exists.", 404);
    }

    const reportCount = store.reportCountsByPost[post.id] ?? post.baseReports;
    if (reportCount >= REPORT_THRESHOLD) {
      throw new ModerationError(
        "This signal is no longer accepting replies.",
        409,
      );
    }

    if (!post.allowEchoes) {
      throw new ModerationError("Echoes are disabled for this signal.", 403);
    }

    enforceRateLimit({
      hitsBySession: store.echoHitsBySession,
      sessionId,
      windowMs: ECHO_RATE_WINDOW_MS,
      maxHitsInWindow: MAX_ECHOES_PER_WINDOW,
      minIntervalMs: MIN_ECHO_INTERVAL_MS,
      actionName: "echo",
    });

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

    const currentEchoes = store.echoesByPost[post.id] || [];
    currentEchoes.push(echo);
    store.echoesByPost[post.id] = currentEchoes;

    return { echo };
  });
}

export function reportSignal(sessionId: string, postId: string) {
  return runMutation((store) => {
    const post = store.postsById[postId];
    if (!post) {
      throw new ModerationError("This signal no longer exists.", 404);
    }

    const reporters = store.reportersByPost[postId] || [];
    const currentCount = store.reportCountsByPost[postId] ?? post.baseReports;

    if (reporters.includes(sessionId)) {
      return {
        alreadyReported: true,
        reportCount: currentCount,
        hidden: currentCount >= REPORT_THRESHOLD,
      };
    }

    reporters.push(sessionId);
    store.reportersByPost[postId] = reporters;
    const nextCount = currentCount + 1;
    store.reportCountsByPost[postId] = nextCount;

    return {
      alreadyReported: false,
      reportCount: nextCount,
      hidden: nextCount >= REPORT_THRESHOLD,
    };
  });
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
