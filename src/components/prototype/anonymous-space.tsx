"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Check,
  Flag,
  Globe,
  HelpCircle,
  Inbox,
  Languages,
  Lightbulb,
  Lock,
  MessageCircleHeart,
  MessageSquare,
  Search,
  SendHorizontal,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  CATEGORIES,
  CategorySlug,
  MOCK_POSTS,
  PrototypePost,
  REACTION_TYPES,
  ReactionType,
} from "@/lib/prototype-data";
import { LOCALE_LABELS, SupportedLocale, isRtlLocale } from "@/lib/i18n";

type Props = {
  initialCategory: CategorySlug;
  activeLocale: SupportedLocale;
  countryCode: string;
};

type Toast = {
  id: number;
  message: string;
};

type FeedScope = "global" | "local";
type SortMode = "latest" | "trending" | "relatable";
type EchoIntent = "perspective" | "question" | "experience";

type EchoEntry = {
  id: string;
  text: string;
  intent: EchoIntent;
  createdAt: string;
  authorType: "author" | "echo";
  alias?: string;
};

const SESSION_KEY = "anonymous-space.session-id";
const REACTIONS_KEY = "anonymous-space.reactions";
const REPORTS_KEY = "anonymous-space.reports";
const FEED_SCOPE_KEY = "anonymous-space.feed-scope";
const QUIET_OATH_KEY = "hasAgreedToRules";

const quietOathRules = [
  "Speak with empathy, not dominance.",
  "Protect anonymity. Never ask for identity clues.",
  "Report harm. Do not amplify it.",
] as const;

const categoryIcon: Record<CategorySlug, typeof Lightbulb> = {
  ideas: Lightbulb,
  confusions: HelpCircle,
  "unpopular-opinions": Zap,
};

const reactionIcon: Record<ReactionType, typeof Check> = {
  agree: Check,
  feel_this_too: MessageCircleHeart,
  brilliant_idea: Sparkles,
};

const categoryClass: Record<CategorySlug, string> = {
  ideas: "bg-[var(--color-chip-amber)] text-[var(--color-chip-amber-text)]",
  confusions: "bg-[var(--color-chip-blue)] text-[var(--color-chip-blue-text)]",
  "unpopular-opinions":
    "bg-[var(--color-chip-magenta)] text-[var(--color-chip-magenta-text)]",
};

const cardHoverClass: Record<CategorySlug, string> = {
  ideas:
    "hover:border-[color:color-mix(in_srgb,var(--color-chip-amber-text)_34%,var(--color-line-soft))]",
  confusions:
    "hover:border-[color:color-mix(in_srgb,var(--color-chip-blue-text)_34%,var(--color-line-soft))]",
  "unpopular-opinions":
    "hover:border-[color:color-mix(in_srgb,var(--color-chip-magenta-text)_34%,var(--color-line-soft))]",
};

const sortOptions: { key: SortMode; label: string }[] = [
  { key: "latest", label: "Latest" },
  { key: "trending", label: "Trending" },
  { key: "relatable", label: "Most Relatable" },
];

const echoIntentOptions: { key: EchoIntent; label: string }[] = [
  { key: "perspective", label: "Perspective" },
  { key: "question", label: "Question" },
  { key: "experience", label: "Experience" },
];

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

const auraClasses = [
  "border-l-2 border-l-orange-500/45",
  "border-l-2 border-l-cyan-500/40",
  "border-l-2 border-l-emerald-500/40",
  "border-l-2 border-l-amber-500/40",
  "border-l-2 border-l-violet-500/40",
  "border-l-2 border-l-sky-500/38",
] as const;

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `anon-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

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

export default function AnonymousSpace({
  initialCategory,
  activeLocale,
  countryCode,
}: Props) {
  const router = useRouter();
  const localeDir = isRtlLocale(activeLocale) ? "rtl" : "ltr";
  const resolvedCountry = countryCode.toUpperCase();

  const [posts, setPosts] = useState<PrototypePost[]>(MOCK_POSTS);
  const [draft, setDraft] = useState("");
  const [composerCategory, setComposerCategory] =
    useState<CategorySlug>(initialCategory);
  const [sessionId, setSessionId] = useState("");
  const [isComposeFocused, setIsComposeFocused] = useState(false);
  const [allowEchoesOnPost, setAllowEchoesOnPost] = useState(true);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [showQuietOath, setShowQuietOath] = useState(false);
  const [isQuietOathExiting, setIsQuietOathExiting] = useState(false);
  const [oathChecks, setOathChecks] = useState<[boolean, boolean, boolean]>([
    false,
    false,
    false,
  ]);
  const [feedScope, setFeedScope] = useState<FeedScope>("global");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [echoesEnabledByPost, setEchoesEnabledByPost] = useState<
    Record<string, boolean>
  >(() =>
    Object.fromEntries(MOCK_POSTS.map((post, idx) => [post.id, idx % 4 !== 0])),
  );
  const [postAuthorSessionByPost, setPostAuthorSessionByPost] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      MOCK_POSTS.map((post, idx) => [post.id, `seed-author-${idx + 1}`]),
    ),
  );
  const [echoesByPost, setEchoesByPost] = useState<Record<string, EchoEntry[]>>(
    () => ({
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
    }),
  );
  const [expandedEchoesByPost, setExpandedEchoesByPost] = useState<
    Record<string, true>
  >({});
  const [echoDraftByPost, setEchoDraftByPost] = useState<Record<string, string>>(
    {},
  );
  const [echoIntentByPost, setEchoIntentByPost] = useState<
    Record<string, EchoIntent | undefined>
  >({});
  const [echoAliasByParticipant, setEchoAliasByParticipant] = useState<
    Record<string, string>
  >({});
  const [reactionsByPost, setReactionsByPost] = useState<
    Record<string, ReactionType>
  >({});
  const [reportsByPost, setReportsByPost] = useState<Record<string, true>>({});
  const [dismissedPosts, setDismissedPosts] = useState<Record<string, true>>({});
  const [collapsingPosts, setCollapsingPosts] = useState<Record<string, true>>(
    {},
  );
  const [expandedPosts, setExpandedPosts] = useState<Record<string, true>>({});
  const [reactionPopKey, setReactionPopKey] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toastCounterRef = useRef(0);
  const postCounterRef = useRef(0);
  const echoCounterRef = useRef(0);

  useEffect(() => {
    setComposerCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    const existingSessionId = localStorage.getItem(SESSION_KEY);
    const resolvedSessionId = existingSessionId ?? createSessionId();

    if (!existingSessionId) {
      localStorage.setItem(SESSION_KEY, resolvedSessionId);
    }

    const storedScope = localStorage.getItem(FEED_SCOPE_KEY);
    if (storedScope === "global" || storedScope === "local") {
      setFeedScope(storedScope);
    }

    if (!localStorage.getItem(QUIET_OATH_KEY)) {
      setShowQuietOath(true);
    }

    setSessionId(resolvedSessionId);
    setReactionsByPost(
      safeJsonParse<Record<string, ReactionType>>(
        localStorage.getItem(REACTIONS_KEY),
        {},
      ),
    );
    setReportsByPost(
      safeJsonParse<Record<string, true>>(localStorage.getItem(REPORTS_KEY), {}),
    );
  }, []);

  useEffect(() => {
    if (!showQuietOath && !isPrivacyModalOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isPrivacyModalOpen, showQuietOath]);

  useEffect(() => {
    localStorage.setItem(REACTIONS_KEY, JSON.stringify(reactionsByPost));
  }, [reactionsByPost]);

  useEffect(() => {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reportsByPost));
  }, [reportsByPost]);

  useEffect(() => {
    localStorage.setItem(FEED_SCOPE_KEY, feedScope);
  }, [feedScope]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }

    el.style.height = "0px";
    const nextHeight = Math.min(Math.max(el.scrollHeight, 112), 420);
    el.style.height = `${nextHeight}px`;
  }, [draft]);

  const triggerHaptic = (duration = 14) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(duration);
    }
  };

  const pushToast = (message: string) => {
    toastCounterRef.current += 1;
    const id = toastCounterRef.current;
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2400);
  };

  const getReportCount = (post: PrototypePost) =>
    post.baseReports + (reportsByPost[post.id] ? 1 : 0);

  const getReactionCount = (post: PrototypePost, reaction: ReactionType) =>
    post.baseReactions[reaction] + (reactionsByPost[post.id] === reaction ? 1 : 0);

  const getTotalEmpathy = (post: PrototypePost) =>
    getReactionCount(post, "agree") +
    getReactionCount(post, "feel_this_too") +
    getReactionCount(post, "brilliant_idea");

  const getVelocity = (post: PrototypePost) => {
    const total = getTotalEmpathy(post);
    if (total >= 52) {
      return 12;
    }
    if (total >= 36) {
      return 7;
    }
    return 0;
  };

  const isVisibleBySafety = (post: PrototypePost) => {
    if (dismissedPosts[post.id]) {
      return false;
    }
    return getReportCount(post) < 3;
  };

  const filterByScope = (items: PrototypePost[]) => {
    if (feedScope === "local") {
      return items.filter((post) => post.country_code === resolvedCountry);
    }
    return items;
  };

  const getAuraClass = (post: PrototypePost, index: number) => {
    const auraIndex = (hashSeed(post.id) + index) % auraClasses.length;
    return auraClasses[auraIndex];
  };

  const formatPostTimestamp = (createdAt: string) => {
    const parsedDate = new Date(createdAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return "just now";
    }

    const formatted = formatDistanceToNow(parsedDate, { addSuffix: true });
    return formatted.startsWith("in ") ? "just now" : formatted;
  };

  const categoryScoped = posts.filter(
    (post) => post.category === initialCategory && isVisibleBySafety(post),
  );

  const regionScoped = filterByScope(categoryScoped);
  const localeScoped = regionScoped.filter(
    (post) => post.language_code === activeLocale,
  );
  const sourcePosts = localeScoped.length > 0 ? localeScoped : regionScoped;

  const visiblePosts = [...sourcePosts].sort((a, b) => {
    if (sortMode === "latest") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }

    if (sortMode === "relatable") {
      return (
        getReactionCount(b, "feel_this_too") - getReactionCount(a, "feel_this_too")
      );
    }

    const scoreA = getTotalEmpathy(a) + getVelocity(a) * 2;
    const scoreB = getTotalEmpathy(b) + getVelocity(b) * 2;
    return scoreB - scoreA;
  });

  const hiddenByReports = filterByScope(posts).filter(
    (post) => post.category === initialCategory && getReportCount(post) >= 3,
  ).length;

  const getCategoryCount = (category: CategorySlug) => {
    const categoryScoped = filterByScope(
      posts.filter((post) => post.category === category && isVisibleBySafety(post)),
    );

    const localeScoped = categoryScoped.filter(
      (post) => post.language_code === activeLocale,
    );

    return (localeScoped.length > 0 ? localeScoped : categoryScoped).length;
  };

  const handlePublish = (event: FormEvent) => {
    event.preventDefault();
    const trimmedDraft = draft.trim();

    if (!trimmedDraft) {
      return;
    }

    postCounterRef.current += 1;
    const newPost: PrototypePost = {
      id: `local-${sessionId || "anon"}-${postCounterRef.current}`,
      category: composerCategory,
      content: trimmedDraft,
      createdAt: new Date().toISOString(),
      language_code: activeLocale,
      country_code: resolvedCountry,
      baseReports: 0,
      baseReactions: {
        agree: 0,
        feel_this_too: 0,
        brilliant_idea: 0,
      },
    };

    setEchoesEnabledByPost((previous) => ({
      ...previous,
      [newPost.id]: allowEchoesOnPost,
    }));
    setPostAuthorSessionByPost((previous) => ({
      ...previous,
      [newPost.id]: sessionId || "anon",
    }));

    setPosts((previous) => [newPost, ...previous]);
    setDraft("");
    setIsComposeFocused(false);
    triggerHaptic(18);
    pushToast("Post published into the void.");
  };

  const reactToPost = (postId: string, reaction: ReactionType) => {
    if (reactionsByPost[postId]) {
      return;
    }

    setReactionsByPost((previous) => ({ ...previous, [postId]: reaction }));
    setReactionPopKey(`${postId}-${reaction}`);
    window.setTimeout(() => setReactionPopKey(null), 260);
    triggerHaptic(12);
    pushToast("Vote recorded.");
  };

  const reportPost = (postId: string) => {
    if (reportsByPost[postId]) {
      return;
    }

    setReportsByPost((previous) => ({ ...previous, [postId]: true }));
    triggerHaptic(8);
    pushToast("Report submitted.");
  };

  const dismissPost = (postId: string) => {
    if (dismissedPosts[postId] || collapsingPosts[postId]) {
      return;
    }

    setCollapsingPosts((previous) => ({ ...previous, [postId]: true }));
    window.setTimeout(() => {
      setDismissedPosts((previous) => ({ ...previous, [postId]: true }));
      setCollapsingPosts((previous) => {
        const copy = { ...previous };
        delete copy[postId];
        return copy;
      });
    }, 260);

    pushToast("Post hidden from your feed.");
  };

  const toggleReadMore = (postId: string) => {
    setExpandedPosts((previous) => {
      if (previous[postId]) {
        const copy = { ...previous };
        delete copy[postId];
        return copy;
      }

      return { ...previous, [postId]: true };
    });
  };

  const toggleEchoThread = (postId: string) => {
    setExpandedEchoesByPost((previous) => {
      if (previous[postId]) {
        const next = { ...previous };
        delete next[postId];
        return next;
      }

      return { ...previous, [postId]: true };
    });
  };

  const updateEchoDraft = (postId: string, value: string) => {
    setEchoDraftByPost((previous) => ({ ...previous, [postId]: value }));
  };

  const updateEchoIntent = (postId: string, intent: EchoIntent) => {
    setEchoIntentByPost((previous) => ({ ...previous, [postId]: intent }));
  };

  const submitEcho = (postId: string) => {
    const draftText = (echoDraftByPost[postId] || "").trim();
    const intent = echoIntentByPost[postId];

    if (!draftText || !intent) {
      return;
    }

    const postAuthorSession = postAuthorSessionByPost[postId];
    const isAuthorReply = Boolean(sessionId) && sessionId === postAuthorSession;

    let alias: string | undefined;
    if (!isAuthorReply) {
      const participantKey = `${postId}:${sessionId || "anon"}`;
      alias = echoAliasByParticipant[participantKey];
      if (!alias) {
        alias = pickEchoAlias(participantKey);
        setEchoAliasByParticipant((previous) => ({
          ...previous,
          [participantKey]: alias!,
        }));
      }
    }

    echoCounterRef.current += 1;
    const echo: EchoEntry = {
      id: `echo-local-${echoCounterRef.current}`,
      text: draftText,
      intent,
      createdAt: new Date().toISOString(),
      authorType: isAuthorReply ? "author" : "echo",
      alias,
    };

    setEchoesByPost((previous) => ({
      ...previous,
      [postId]: [...(previous[postId] || []), echo],
    }));
    setExpandedEchoesByPost((previous) => ({ ...previous, [postId]: true }));
    setEchoDraftByPost((previous) => ({ ...previous, [postId]: "" }));
    setEchoIntentByPost((previous) => ({ ...previous, [postId]: undefined }));
    triggerHaptic(10);
    pushToast("Echo sent.");
  };

  const changeLocale = (nextLocale: SupportedLocale) => {
    router.push(`/${nextLocale}/${initialCategory}`);
  };

  const toggleOathRule = (index: number) => {
    setOathChecks((previous) => {
      const next = [...previous] as [boolean, boolean, boolean];
      next[index] = !next[index];
      return next;
    });
  };

  const allOathRulesChecked = oathChecks.every(Boolean);

  const enterQuietSignal = () => {
    localStorage.setItem(QUIET_OATH_KEY, "true");
    setIsQuietOathExiting(true);
    window.setTimeout(() => {
      setShowQuietOath(false);
      setIsQuietOathExiting(false);
    }, 280);
  };

  const destroyIdentity = () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.setItem(SESSION_KEY, createSessionId());
    window.location.reload();
  };

  return (
    <div
      dir={localeDir}
      className="min-h-screen bg-[var(--color-bg-0)] text-[var(--color-text-primary)]"
    >
      <header className="sticky top-0 z-50 border-b border-[var(--color-line-soft)] bg-[var(--color-bg-top)]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-12 w-full max-w-[1400px] items-center gap-2 px-2.5 md:h-14 md:gap-3 md:px-4">
          <Link
            href={`/${activeLocale}/ideas`}
            className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 transition hover:bg-[var(--color-bg-hover)]"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-brand)] text-[var(--color-brand-text)]">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="hidden text-sm font-semibold md:inline">QuietSignal</span>
          </Link>

          <label className="relative hidden min-w-0 flex-1 items-center md:flex">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--color-text-muted)]" />
            <input
              type="text"
              readOnly
              value="Search disabled in anonymous prototype"
              aria-label="Search disabled"
              className="h-9 w-full truncate rounded-full border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] pl-9 pr-3 text-[12px] text-[var(--color-text-muted)] outline-none"
            />
          </label>

          <div className="ml-auto flex items-center gap-2">
            <div className="inline-flex h-9 items-center rounded-full border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] p-1 text-[11px]">
              <button
                type="button"
                onClick={() => setFeedScope("global")}
                className={`h-7 rounded-full px-2.5 transition ${
                  feedScope === "global"
                    ? "bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-soft)]"
                }`}
              >
                Global
              </button>
              <button
                type="button"
                onClick={() => setFeedScope("local")}
                className={`h-7 rounded-full px-2.5 transition ${
                  feedScope === "local"
                    ? "bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-soft)]"
                }`}
              >
                Local
              </button>
            </div>

            <label className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] px-2.5 text-[12px] text-[var(--color-text-soft)]">
              <Globe className="h-3.5 w-3.5" />
              <select
                value={activeLocale}
                onChange={(event) =>
                  changeLocale(event.target.value as SupportedLocale)
                }
                aria-label="Language"
                className="bg-transparent text-[12px] outline-none"
              >
                {Object.entries(LOCALE_LABELS).map(([locale, label]) => (
                  <option key={locale} value={locale} className="bg-black">
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => setIsPrivacyModalOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] px-2.5 text-[12px] text-[var(--color-text-soft)] transition hover:border-[var(--color-line-strong)] hover:text-[var(--color-text-primary)]"
              aria-label="Privacy Settings"
            >
              <Lock className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Privacy</span>
            </button>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-2 px-2.5 pb-2 text-[11px] text-[var(--color-text-muted)] md:px-4">
          <span className="rounded-full border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] px-2 py-0.5">
            {feedScope === "global"
              ? `Global feed - ${activeLocale.toUpperCase()}`
              : `Local feed - ${resolvedCountry}`}
          </span>
          <span className="rounded-full border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] px-2 py-0.5">
            Anonymous mode
          </span>
        </div>
      </header>

      {isComposeFocused && !showQuietOath && (
        <div className="pointer-events-none fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
      )}

      <div className="sticky top-12 z-40 border-b border-[var(--color-line-soft)] bg-[var(--color-bg-top)]/96 px-2 py-1.5 backdrop-blur-sm lg:hidden">
        <nav
          className="hide-scrollbar flex gap-1.5 overflow-x-auto"
          aria-label="Mobile categories"
        >
          {CATEGORIES.map((category) => {
            const Icon = categoryIcon[category.slug];
            const isActive = category.slug === initialCategory;

            return (
              <Link
                key={category.slug}
                href={`/${activeLocale}/${category.slug}`}
                className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] transition ${
                  isActive
                    ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
                    : "border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] text-[var(--color-text-soft)]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{category.label}</span>
                <span className="rounded-full bg-[var(--color-bg-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                  {getCategoryCount(category.slug)}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="hide-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {sortOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSortMode(option.key)}
              className={`inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-[11px] transition ${
                sortMode === option.key
                  ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
                  : "border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] text-[var(--color-text-muted)]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <main className="relative mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-3 px-2 py-3 md:gap-4 md:px-4 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_320px]">
        <aside className="hidden lg:block">
          <div className="sticky top-[88px] space-y-3">
            <section className="rounded-xl border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] p-2.5">
              <p className="mb-1.5 px-1 text-[11px] tracking-[0.12em] text-[var(--color-text-muted)] uppercase">
                Spaces
              </p>
              <nav className="space-y-1">
                {CATEGORIES.map((category) => {
                  const Icon = categoryIcon[category.slug];
                  const isActive = category.slug === initialCategory;

                  return (
                    <Link
                      key={category.slug}
                      href={`/${activeLocale}/${category.slug}`}
                      className={`flex h-10 items-center gap-2 rounded-lg px-2.5 text-[13px] transition ${
                        isActive
                          ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                          : "text-[var(--color-text-soft)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="min-w-0 flex-1 truncate">{category.label}</span>
                      <span className="rounded-full border border-[var(--color-line-soft)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                        {getCategoryCount(category.slug)}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </section>

            <section className="rounded-xl border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] p-2.5">
              <p className="mb-1.5 px-1 text-[11px] tracking-[0.12em] text-[var(--color-text-muted)] uppercase">
                Sort
              </p>
              <div className="hide-scrollbar flex gap-1.5 overflow-x-auto">
                {sortOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSortMode(option.key)}
                    className={`inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-[11px] transition ${
                      sortMode === option.key
                        ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
                        : "border-[var(--color-line-soft)] bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </aside>

        <section className="space-y-2.5">
          <form
            onSubmit={handlePublish}
            className={`relative z-50 rounded-xl border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] p-2.5 transition-all md:p-3 ${
              isComposeFocused
                ? "shadow-[0_0_0_1px_rgba(255,69,0,0.35),0_24px_64px_rgba(0,0,0,0.55)]"
                : ""
            }`}
          >
            <div className="hide-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              {CATEGORIES.map((category) => {
                const Icon = categoryIcon[category.slug];
                const isSelected = composerCategory === category.slug;

                return (
                  <button
                    key={category.slug}
                    type="button"
                    onClick={() => setComposerCategory(category.slug)}
                    className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] transition ${
                      isSelected
                        ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
                        : "border-[var(--color-line-soft)] bg-[var(--color-bg-elevated)] text-[var(--color-text-soft)] hover:border-[var(--color-line-strong)]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {category.label}
                  </button>
                );
              })}
            </div>

            <label htmlFor="post-text" className="sr-only">
              Anonymous post text
            </label>
            <textarea
              ref={textareaRef}
              id="post-text"
              value={draft}
              onFocus={() => setIsComposeFocused(true)}
              onBlur={() => setIsComposeFocused(false)}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={1200}
              placeholder="Share something honest..."
              className="mt-2 min-h-24 max-h-[420px] w-full resize-none overflow-y-auto rounded-lg border border-[var(--color-line-soft)] bg-[var(--color-bg-elevated)] px-3 py-2.5 text-[14px] leading-relaxed text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-line-strong)]"
            />

            <div className="mt-2 flex items-center justify-between rounded-lg border border-[var(--color-line-soft)] bg-[var(--color-bg-elevated)] px-3 py-2">
              <p className="text-[12px] text-[var(--color-text-soft)]">
                Allow Echoes (Replies)
              </p>
              <button
                type="button"
                onClick={() => setAllowEchoesOnPost((previous) => !previous)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  allowEchoesOnPost
                    ? "bg-[var(--color-brand)]"
                    : "bg-[var(--color-bg-hover)]"
                }`}
                aria-pressed={allowEchoesOnPost}
                aria-label="Allow Echoes (Replies)"
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                    allowEchoesOnPost ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {draft.trim().length}/1200
              </p>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
                  <Lock className="h-3.5 w-3.5" />
                  100% Anonymous. No tracking.
                </span>
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--color-brand)] px-3.5 text-[12px] font-semibold text-[var(--color-brand-text)] transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <SendHorizontal className="h-3.5 w-3.5" />
                  Publish
                </button>
              </div>
            </div>
          </form>

          <div className="relative">
            <div
              className={`space-y-2 transition-all ${
                isComposeFocused ? "scale-[0.995] opacity-80" : ""
              }`}
            >
              {hiddenByReports > 0 && (
                <div className="rounded-lg border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] px-3 py-2 text-[12px] text-[var(--color-text-soft)]">
                  {hiddenByReports} post{hiddenByReports > 1 ? "s are" : " is"} hidden
                  after crossing the 3-report threshold.
                </div>
              )}

              {visiblePosts.length === 0 ? (
                <div className="rounded-xl border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] px-4 py-8 text-center">
                  <Inbox className="mx-auto h-8 w-8 text-[var(--color-text-muted)]" />
                  <p className="mt-3 text-[14px] font-medium text-[var(--color-text-primary)]">
                    It&apos;s quiet in here.
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                    Be the first to break the silence.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {visiblePosts.map((post, index) => {
                    const alreadyReacted = reactionsByPost[post.id];
                    const reportCount = getReportCount(post);
                    const hasReported = Boolean(reportsByPost[post.id]);
                    const CategoryIcon = categoryIcon[post.category];
                    const isExpanded = Boolean(expandedPosts[post.id]);
                    const isLongPost = post.content.length > 290;
                    const velocity = getVelocity(post);
                    const isCollapsing = Boolean(collapsingPosts[post.id]);
                    const echoesAllowed = echoesEnabledByPost[post.id] ?? true;
                    const postEchoes = echoesByPost[post.id] || [];
                    const echoCount = postEchoes.length;
                    const echoesExpanded = Boolean(expandedEchoesByPost[post.id]);
                    const currentEchoDraft = echoDraftByPost[post.id] || "";
                    const selectedEchoIntent = echoIntentByPost[post.id];
                    const canSendEcho =
                      currentEchoDraft.trim().length > 0 &&
                      Boolean(selectedEchoIntent);

                    return (
                      <div
                        key={post.id}
                        className={`overflow-hidden transition-all duration-300 ${
                          isCollapsing ? "max-h-0 opacity-0" : "max-h-[800px] opacity-100"
                        }`}
                      >
                        <article
                          className={`feed-enter rounded-xl border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] p-2.5 transition-colors md:p-3 ${cardHoverClass[post.category]} ${getAuraClass(post, index)}`}
                          style={{ animationDelay: `${index * 24}ms` }}
                        >
                          <header className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--color-text-muted)]">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${categoryClass[post.category]}`}
                              >
                                <CategoryIcon className="h-3.5 w-3.5" />
                                {
                                  CATEGORIES.find((category) => category.slug === post.category)
                                    ?.label
                                }
                              </span>
                              <span>.</span>
                              <time dateTime={post.createdAt}>
                                {formatPostTimestamp(post.createdAt)}
                              </time>
                              <span>.</span>
                              <span>{post.country_code}</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => dismissPost(post.id)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-line-soft)] bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] transition hover:border-[var(--color-line-strong)] hover:text-[var(--color-text-primary)] active:scale-95"
                              aria-label="Hide post"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </header>

                          <div
                            className={`relative overflow-hidden transition-[max-height] duration-300 ${
                              isLongPost && !isExpanded ? "max-h-40" : "max-h-[1200px]"
                            }`}
                          >
                            <p className="whitespace-pre-wrap text-[16px] leading-[1.5] text-[var(--color-text-primary)] md:text-[17px]">
                              {post.content}
                            </p>
                            {isLongPost && !isExpanded && (
                              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[var(--color-bg-surface)] to-transparent" />
                            )}
                          </div>

                          {isLongPost && (
                            <button
                              type="button"
                              onClick={() => toggleReadMore(post.id)}
                              className="mt-1 text-[12px] text-[var(--color-text-muted)] transition hover:text-[var(--color-text-primary)]"
                            >
                              {isExpanded ? "Show less" : "Read more..."}
                            </button>
                          )}

                          <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-[var(--color-text-muted)]">
                            <span className="inline-flex items-center gap-1">
                              <TrendingUp className="h-3.5 w-3.5" />
                              {getTotalEmpathy(post)} empathy signals
                            </span>
                            {velocity > 0 && (
                              <span className="inline-flex items-center gap-1 text-orange-300">
                                <span className="h-2 w-2 animate-pulse rounded-full bg-orange-400" />
                                +{velocity} recently
                              </span>
                            )}
                          </div>

                          <div className="mt-2.5 grid gap-1.5 sm:flex sm:flex-wrap sm:items-center">
                            {REACTION_TYPES.map((reaction) => {
                              const Icon = reactionIcon[reaction.key];
                              const chosen = alreadyReacted === reaction.key;
                              const popKey = `${post.id}-${reaction.key}`;

                              return (
                                <button
                                  key={reaction.key}
                                  type="button"
                                  onClick={() => reactToPost(post.id, reaction.key)}
                                  disabled={Boolean(alreadyReacted)}
                                  className={`inline-flex h-10 w-full items-center justify-between gap-2 rounded-full border px-3 text-[12px] transition-transform sm:w-auto sm:justify-start active:scale-95 ${
                                    chosen
                                      ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)] shadow-[0_0_0_1px_rgba(255,69,0,0.35),0_0_18px_rgba(255,69,0,0.2)]"
                                      : "border-[var(--color-line-soft)] bg-[var(--color-bg-elevated)] text-[var(--color-text-soft)] hover:border-[var(--color-line-strong)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed"
                                  } ${reactionPopKey === popKey ? "reaction-pop" : ""}`}
                                >
                                  <span className="inline-flex items-center gap-1.5">
                                    <Icon className="h-3.5 w-3.5" />
                                    {reaction.label}
                                  </span>
                                  <span className="rounded-full bg-[var(--color-bg-surface)] px-1.5 py-0.5 text-[10px]">
                                    {getReactionCount(post, reaction.key)}
                                  </span>
                                </button>
                              );
                            })}

                            {echoesAllowed ? (
                              <button
                                type="button"
                                onClick={() => toggleEchoThread(post.id)}
                                className="inline-flex h-10 w-full items-center justify-between gap-2 rounded-full border border-[var(--color-line-soft)] bg-[var(--color-bg-elevated)] px-3 text-[12px] text-[var(--color-text-soft)] transition hover:border-[var(--color-line-strong)] hover:text-[var(--color-text-primary)] sm:w-auto sm:justify-start"
                              >
                                <span className="inline-flex items-center gap-1.5">
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  {echoCount} Echoes
                                </span>
                              </button>
                            ) : (
                              <span className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-[var(--color-line-soft)] bg-[var(--color-bg-elevated)] px-3 text-[12px] text-[var(--color-text-muted)] sm:w-auto">
                                <Lock className="h-3.5 w-3.5" />
                                Echoes disabled
                              </span>
                            )}
                          </div>

                          {echoesAllowed && echoesExpanded && (
                            <div className="mt-3 rounded-xl border border-[var(--color-line-soft)] bg-[var(--color-bg-elevated)] p-3">
                              <div className="space-y-2">
                                {postEchoes.length === 0 ? (
                                  <p className="text-[12px] text-[var(--color-text-muted)]">
                                    No Echoes yet. Start the first quiet reply.
                                  </p>
                                ) : (
                                  postEchoes.map((echo) => (
                                    <div
                                      key={echo.id}
                                      className="ml-3 border-l border-[var(--color-line-soft)] pl-3"
                                    >
                                      <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                                        {echo.authorType === "author" ? (
                                          <span className="rounded-full border border-emerald-400/40 bg-emerald-400/12 px-2 py-0.5 text-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.25)]">
                                            Author
                                          </span>
                                        ) : (
                                          <span>{echo.alias || "Echo"}</span>
                                        )}
                                        <span>.</span>
                                        <span className="text-[10px] uppercase tracking-[0.08em]">
                                          {
                                            echoIntentOptions.find(
                                              (option) => option.key === echo.intent,
                                            )?.label
                                          }
                                        </span>
                                        <span>.</span>
                                        <time dateTime={echo.createdAt}>
                                          {formatPostTimestamp(echo.createdAt)}
                                        </time>
                                      </div>
                                      <p className="pb-2 text-[13px] text-[var(--color-text-soft)]">
                                        {echo.text}
                                      </p>
                                    </div>
                                  ))
                                )}
                              </div>

                              <div className="mt-3 border-t border-[var(--color-line-soft)] pt-3">
                                <div className="mb-2 flex flex-wrap gap-1.5">
                                  {echoIntentOptions.map((option) => (
                                    <button
                                      key={`${post.id}-${option.key}`}
                                      type="button"
                                      onClick={() => updateEchoIntent(post.id, option.key)}
                                      className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                                        selectedEchoIntent === option.key
                                          ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
                                          : "border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] text-[var(--color-text-muted)]"
                                      }`}
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                </div>

                                <div className="flex items-center gap-2">
                                  <input
                                    value={currentEchoDraft}
                                    onChange={(event) =>
                                      updateEchoDraft(post.id, event.target.value)
                                    }
                                    placeholder="Write an Echo..."
                                    className="h-10 min-w-0 flex-1 rounded-full border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] px-3 text-[12px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-line-strong)]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => submitEcho(post.id)}
                                    disabled={!canSendEcho}
                                    className="inline-flex h-10 items-center rounded-full bg-[var(--color-brand)] px-3 text-[12px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    Send
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => reportPost(post.id)}
                                disabled={hasReported || reportCount >= 3}
                                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--color-line-soft)] bg-[var(--color-bg-elevated)] px-3 text-[12px] text-[var(--color-text-muted)] transition hover:border-[var(--color-line-strong)] hover:text-[var(--color-text-soft)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Flag className="h-3.5 w-3.5" />
                                {hasReported ? "Reported" : "Report"}
                              </button>

                              {post.language_code !== activeLocale && (
                                <button
                                  type="button"
                                  className="inline-flex h-10 items-center gap-1 rounded-full border border-[var(--color-line-soft)] bg-[var(--color-bg-elevated)] px-3 text-[12px] text-[var(--color-text-muted)] transition hover:border-[var(--color-line-strong)] hover:text-[var(--color-text-soft)]"
                                >
                                  <Languages className="h-3.5 w-3.5" />
                                  Translate
                                </button>
                              )}
                            </div>

                            <p className="text-[11px] text-[var(--color-text-muted)]">
                              {reportCount}/3 reports
                            </p>
                          </div>
                        </article>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="hidden xl:block">
          <div className="sticky top-[88px] space-y-3">
            <section className="rounded-xl border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] p-3">
              <p className="text-[14px] font-semibold">About this space</p>
              <ul className="mt-2 space-y-1.5 text-[12px] text-[var(--color-text-soft)]">
                <li>No accounts, names, or profile layers.</li>
                <li>Optional Echoes allow for quiet, constructive conversations.</li>
                <li>Empathy-only responses keep signals constructive.</li>
                <li>Three reports hide a post automatically.</li>
                <li>Region uses country header only, never raw IP storage.</li>
              </ul>
            </section>
          </div>
        </aside>
      </main>

      {isPrivacyModalOpen && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 px-3 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close privacy settings"
            onClick={() => setIsPrivacyModalOpen(false)}
            className="absolute inset-0"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--color-line-strong)] bg-[var(--color-bg-surface)] p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Privacy Settings
              </p>
              <button
                type="button"
                onClick={() => setIsPrivacyModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-line-soft)] bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] transition hover:text-[var(--color-text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-[12px] text-[var(--color-text-soft)]">Session UUID</p>
            <p className="mt-1 break-all rounded-lg border border-[var(--color-line-soft)] bg-[var(--color-bg-elevated)] px-3 py-2 text-[11px] text-[var(--color-text-muted)]">
              {sessionId || "loading..."}
            </p>

            <button
              type="button"
              onClick={destroyIdentity}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-full border border-red-500/45 bg-red-500/10 px-4 text-[12px] font-medium text-red-200 transition hover:bg-red-500/20"
            >
              Destroy Identity
            </button>
          </div>
        </div>
      )}

      {showQuietOath && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black px-4 transition-opacity duration-300 ${
            isQuietOathExiting ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="w-full max-w-xl rounded-2xl border border-[var(--color-line-soft)] bg-[#050505] p-5">
            <p className="text-xs tracking-[0.14em] text-[var(--color-text-muted)] uppercase">
              Quiet Oath
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">
              Enter only if you can protect the room.
            </h1>

            <div className="mt-5 space-y-3">
              {quietOathRules.map((rule, index) => (
                <button
                  key={rule}
                  type="button"
                  onClick={() => toggleOathRule(index)}
                  className="flex w-full items-start gap-3 rounded-xl border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] p-3 text-left transition hover:border-[var(--color-line-strong)]"
                >
                  <span
                    className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded border text-[10px] ${
                      oathChecks[index]
                        ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white"
                        : "border-[var(--color-line-strong)] bg-transparent text-transparent"
                    }`}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="text-sm text-[var(--color-text-soft)]">{rule}</span>
                </button>
              ))}
            </div>

            {allOathRulesChecked && (
              <button
                type="button"
                onClick={enterQuietSignal}
                className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Enter QuietSignal
              </button>
            )}
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[60] mx-auto flex w-full max-w-md flex-col items-center gap-2 px-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="toast-enter w-full rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-bg-surface)]/95 px-3 py-2 text-center text-[12px] text-[var(--color-text-primary)] shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
