"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Check,
  Flag,
  HelpCircle,
  Lightbulb,
  MessageCircleHeart,
  Search,
  SendHorizontal,
  Sparkles,
  Zap,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import {
  CATEGORIES,
  CategorySlug,
  MOCK_POSTS,
  PrototypePost,
  REACTION_TYPES,
  ReactionType,
} from "@/lib/prototype-data";

type Props = {
  initialCategory: CategorySlug;
};

const SESSION_KEY = "anonymous-space.session-id";
const REACTIONS_KEY = "anonymous-space.reactions";
const REPORTS_KEY = "anonymous-space.reports";

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
  ideas: "bg-[var(--color-chip-blue)] text-[var(--color-chip-blue-text)]",
  confusions:
    "bg-[var(--color-chip-amber)] text-[var(--color-chip-amber-text)]",
  "unpopular-opinions":
    "bg-[var(--color-chip-magenta)] text-[var(--color-chip-magenta-text)]",
};

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

export default function AnonymousSpace({ initialCategory }: Props) {
  const [posts, setPosts] = useState<PrototypePost[]>(MOCK_POSTS);
  const [draft, setDraft] = useState("");
  const [composerCategory, setComposerCategory] =
    useState<CategorySlug>(initialCategory);
  const [sessionId, setSessionId] = useState("");
  const [reactionsByPost, setReactionsByPost] = useState<
    Record<string, ReactionType>
  >({});
  const [reportsByPost, setReportsByPost] = useState<Record<string, true>>({});

  useEffect(() => {
    setComposerCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    const existingSessionId = localStorage.getItem(SESSION_KEY);
    const resolvedSessionId = existingSessionId ?? createSessionId();

    if (!existingSessionId) {
      localStorage.setItem(SESSION_KEY, resolvedSessionId);
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
    localStorage.setItem(REACTIONS_KEY, JSON.stringify(reactionsByPost));
  }, [reactionsByPost]);

  useEffect(() => {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reportsByPost));
  }, [reportsByPost]);

  const getReportCount = (post: PrototypePost) =>
    post.baseReports + (reportsByPost[post.id] ? 1 : 0);

  const getReactionCount = (post: PrototypePost, reaction: ReactionType) =>
    post.baseReactions[reaction] + (reactionsByPost[post.id] === reaction ? 1 : 0);

  const visiblePosts = posts
    .filter((post) => post.category === initialCategory)
    .filter((post) => getReportCount(post) < 3)
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const hiddenByReports = posts.filter(
    (post) => post.category === initialCategory && getReportCount(post) >= 3,
  ).length;

  const countsByCategory = CATEGORIES.reduce<Record<CategorySlug, number>>(
    (acc, category) => {
      acc[category.slug] = posts.filter(
        (post) => post.category === category.slug && getReportCount(post) < 3,
      ).length;
      return acc;
    },
    {
      ideas: 0,
      confusions: 0,
      "unpopular-opinions": 0,
    },
  );

  const handlePublish = (event: FormEvent) => {
    event.preventDefault();
    const trimmedDraft = draft.trim();

    if (!trimmedDraft) {
      return;
    }

    const newPost: PrototypePost = {
      id: `local-${Date.now()}`,
      category: composerCategory,
      content: trimmedDraft,
      createdAt: new Date().toISOString(),
      baseReports: 0,
      baseReactions: {
        agree: 0,
        feel_this_too: 0,
        brilliant_idea: 0,
      },
    };

    setPosts((previous) => [newPost, ...previous]);
    setDraft("");
  };

  const reactToPost = (postId: string, reaction: ReactionType) => {
    if (reactionsByPost[postId]) {
      return;
    }

    setReactionsByPost((previous) => ({ ...previous, [postId]: reaction }));
  };

  const reportPost = (postId: string) => {
    if (reportsByPost[postId]) {
      return;
    }

    setReportsByPost((previous) => ({ ...previous, [postId]: true }));
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-0)] text-[var(--color-text-primary)]">
      <header className="sticky top-0 z-40 border-b border-[var(--color-line-soft)] bg-[var(--color-bg-top)]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-12 w-full max-w-[1400px] items-center gap-2 px-2.5 md:h-14 md:gap-3 md:px-4">
          <Link
            href="/ideas"
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

          <span className="ml-auto rounded-full border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] px-2.5 py-1 text-[11px] text-[var(--color-text-soft)]">
            Anonymous mode
          </span>
        </div>
      </header>

      <div className="sticky top-12 z-30 border-b border-[var(--color-line-soft)] bg-[var(--color-bg-top)]/96 px-2 py-1.5 backdrop-blur-sm lg:hidden">
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
                href={`/${category.slug}`}
                className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] transition ${
                  isActive
                    ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
                    : "border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] text-[var(--color-text-soft)]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{category.label}</span>
                <span className="rounded-full bg-[var(--color-bg-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                  {countsByCategory[category.slug]}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      <main className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-3 px-2 py-3 md:gap-4 md:px-4 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_320px]">
        <aside className="hidden lg:block">
          <div className="sticky top-[74px] space-y-3">
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
                      href={`/${category.slug}`}
                      className={`flex h-10 items-center gap-2 rounded-lg px-2.5 text-[13px] transition ${
                        isActive
                          ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                          : "text-[var(--color-text-soft)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="min-w-0 flex-1 truncate">{category.label}</span>
                      <span className="rounded-full border border-[var(--color-line-soft)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                        {countsByCategory[category.slug]}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </section>

            <section className="rounded-xl border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] p-2.5 text-[12px] text-[var(--color-text-soft)]">
              <p className="mb-1 font-semibold text-[var(--color-text-primary)]">
                Session ID
              </p>
              <p className="break-all text-[11px] text-[var(--color-text-muted)]">
                {sessionId || "loading..."}
              </p>
            </section>
          </div>
        </aside>

        <section className="space-y-2.5">
          <form
            onSubmit={handlePublish}
            className="rounded-xl border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] p-2.5 md:p-3"
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
              id="post-text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={1200}
              placeholder="Share something honest..."
              className="mt-2 min-h-24 w-full resize-y rounded-lg border border-[var(--color-line-soft)] bg-[var(--color-bg-elevated)] px-3 py-2.5 text-[14px] leading-relaxed text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-line-strong)]"
            />

            <div className="mt-2.5 flex items-center justify-between gap-2">
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {draft.trim().length}/1200
              </p>
              <button
                type="submit"
                disabled={!draft.trim()}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--color-brand)] px-3.5 text-[12px] font-semibold text-[var(--color-brand-text)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <SendHorizontal className="h-3.5 w-3.5" />
                Publish anonymously
              </button>
            </div>
          </form>

          {hiddenByReports > 0 && (
            <div className="rounded-lg border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] px-3 py-2 text-[12px] text-[var(--color-text-soft)]">
              {hiddenByReports} post{hiddenByReports > 1 ? "s are" : " is"} hidden
              after crossing the 3-report threshold.
            </div>
          )}

          <div className="space-y-2">
            {visiblePosts.map((post, index) => {
              const alreadyReacted = reactionsByPost[post.id];
              const reportCount = getReportCount(post);
              const hasReported = Boolean(reportsByPost[post.id]);
              const CategoryIcon = categoryIcon[post.category];

              return (
                <article
                  key={post.id}
                  className="feed-enter rounded-xl border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] p-2.5 md:p-3"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <header className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${categoryClass[post.category]}`}
                    >
                      <CategoryIcon className="h-3.5 w-3.5" />
                      {
                        CATEGORIES.find((category) => category.slug === post.category)
                          ?.label
                      }
                    </span>
                    <span>•</span>
                    <time dateTime={post.createdAt}>
                      {formatDistanceToNow(new Date(post.createdAt), {
                        addSuffix: true,
                      })}
                    </time>
                  </header>

                  <p className="whitespace-pre-wrap text-[16px] leading-[1.5] text-[var(--color-text-primary)] md:text-[17px]">
                    {post.content}
                  </p>

                  <div className="mt-2.5 grid gap-1.5 sm:flex sm:flex-wrap sm:items-center">
                    {REACTION_TYPES.map((reaction) => {
                      const Icon = reactionIcon[reaction.key];
                      const chosen = alreadyReacted === reaction.key;

                      return (
                        <button
                          key={reaction.key}
                          type="button"
                          onClick={() => reactToPost(post.id, reaction.key)}
                          disabled={Boolean(alreadyReacted)}
                          className={`inline-flex h-10 w-full items-center justify-between gap-2 rounded-full border px-3 text-[12px] transition sm:w-auto sm:justify-start ${
                            chosen
                              ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
                              : "border-[var(--color-line-soft)] bg-[var(--color-bg-elevated)] text-[var(--color-text-soft)] hover:border-[var(--color-line-strong)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed"
                          }`}
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
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => reportPost(post.id)}
                      disabled={hasReported || reportCount >= 3}
                      className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--color-line-soft)] bg-[var(--color-bg-elevated)] px-3 text-[12px] text-[var(--color-text-muted)] transition hover:border-[var(--color-line-strong)] hover:text-[var(--color-text-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Flag className="h-3.5 w-3.5" />
                      {hasReported ? "Reported" : "Report"}
                    </button>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      {reportCount}/3 reports
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="hidden xl:block">
          <div className="sticky top-[74px] space-y-3">
            <section className="rounded-xl border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] p-3">
              <p className="text-[14px] font-semibold">About this space</p>
              <ul className="mt-2 space-y-1.5 text-[12px] text-[var(--color-text-soft)]">
                <li>No accounts, names, or profile layers.</li>
                <li>Text comments are disabled to reduce hostility.</li>
                <li>Empathy-only responses keep signals constructive.</li>
                <li>Three reports hide a post automatically.</li>
              </ul>
            </section>

            <section className="rounded-xl border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] p-3 text-[12px] text-[var(--color-text-soft)]">
              <p className="font-semibold text-[var(--color-text-primary)]">
                Prototype status
              </p>
              <p className="mt-1.5">
                Design polish pass: denser feed rhythm, cleaner type scale, and
                mobile-first tap ergonomics.
              </p>
            </section>
          </div>
        </aside>
      </main>
    </div>
  );
}

