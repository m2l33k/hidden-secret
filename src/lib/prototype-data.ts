export const CATEGORIES = [
  {
    slug: "ideas",
    label: "Ideas",
    tone: "Raw concepts and what-ifs.",
  },
  {
    slug: "confusions",
    label: "Confusions",
    tone: "Questions you cannot ask elsewhere.",
  },
  {
    slug: "unpopular-opinions",
    label: "Unpopular Opinions",
    tone: "Thoughts that may challenge the room.",
  },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const REACTION_TYPES = [
  {
    key: "agree",
    label: "I agree",
  },
  {
    key: "feel_this_too",
    label: "I feel this too",
  },
  {
    key: "brilliant_idea",
    label: "Brilliant idea",
  },
] as const;

export type ReactionType = (typeof REACTION_TYPES)[number]["key"];

export type PrototypePost = {
  id: string;
  category: CategorySlug;
  content: string;
  createdAt: string;
  baseReports: number;
  baseReactions: Record<ReactionType, number>;
};

export const MOCK_POSTS: PrototypePost[] = [
  {
    id: "post-1",
    category: "ideas",
    content:
      "What if schools taught emotional regulation with the same seriousness as math?",
    createdAt: "2026-03-22T08:12:00.000Z",
    baseReports: 0,
    baseReactions: {
      agree: 24,
      feel_this_too: 11,
      brilliant_idea: 9,
    },
  },
  {
    id: "post-2",
    category: "ideas",
    content:
      "Public libraries could host anonymous monthly 'life reset' circles where nobody gives advice, they only listen.",
    createdAt: "2026-03-22T06:45:00.000Z",
    baseReports: 1,
    baseReactions: {
      agree: 15,
      feel_this_too: 20,
      brilliant_idea: 14,
    },
  },
  {
    id: "post-3",
    category: "confusions",
    content:
      "I still do not understand why being exhausted all the time is considered normal adulthood.",
    createdAt: "2026-03-22T05:10:00.000Z",
    baseReports: 0,
    baseReactions: {
      agree: 8,
      feel_this_too: 38,
      brilliant_idea: 2,
    },
  },
  {
    id: "post-4",
    category: "confusions",
    content:
      "Why do we celebrate productivity but rarely celebrate rest that prevents burnout?",
    createdAt: "2026-03-21T20:34:00.000Z",
    baseReports: 0,
    baseReactions: {
      agree: 13,
      feel_this_too: 27,
      brilliant_idea: 6,
    },
  },
  {
    id: "post-5",
    category: "unpopular-opinions",
    content:
      "Most meetings are emotional comfort rituals and should have been a shared document instead.",
    createdAt: "2026-03-21T16:22:00.000Z",
    baseReports: 1,
    baseReactions: {
      agree: 29,
      feel_this_too: 18,
      brilliant_idea: 12,
    },
  },
  {
    id: "post-6",
    category: "unpopular-opinions",
    content:
      "Constant self-optimization content has become a polite form of self-dislike.",
    createdAt: "2026-03-21T11:08:00.000Z",
    baseReports: 2,
    baseReactions: {
      agree: 17,
      feel_this_too: 16,
      brilliant_idea: 10,
    },
  },
];

