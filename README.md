# QuietSignal

Anonymous, language-aware discussion prototype focused on honest expression with anti-abuse friction.

QuietSignal is a Next.js app where users post without accounts, react with empathy signals, and have optional two-way "Echo" conversations. Identity is intentionally anonymous and represented as ephemeral visual signals (generated auras), while moderation controls are enforced server-side.

## Table of Contents

- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Security Model](#security-model)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Routes](#routes)
- [Moderation API](#moderation-api)
- [Available Scripts](#available-scripts)
- [Troubleshooting](#troubleshooting)
- [Known Limitations](#known-limitations)
- [Deployment Notes](#deployment-notes)

## Key Features

- Anonymous posting in 3 categories:
  - `ideas`
  - `confusions`
  - `unpopular-opinions`
- Locale-aware feed routing (`en`, `fr`, `ar`) with middleware redirects.
- Feed scopes:
  - Global
  - Local (country-aware)
- Echo threads with intent tags:
  - `perspective`
  - `question`
  - `experience`
- Resonance drawer:
  - Notifications tab
  - My Signals tab
  - Vaporize action for user-created posts
- Visual identity orbs ("Generative Auras") instead of uploaded avatars.
- Quiet Oath onboarding gate before participation.
- Server-authoritative anti-abuse controls:
  - publish/echo rate limits
  - server-enforced report thresholds
  - server-validated anonymous sessions
  - server-enforced scan delay before publish/send

## Tech Stack

- Framework: Next.js 16 (App Router)
- Runtime: React 19 + TypeScript
- Styling: Tailwind CSS v4
- Icons: lucide-react
- Time formatting: date-fns
- Linting: ESLint + eslint-config-next

## Architecture

### High-level flow

1. Middleware resolves locale and country context.
2. Middleware ensures hardened cookies (locale, country, session).
3. UI loads at `/:locale/:category`.
4. Client requests public anonymous identity from `/api/moderation/session`.
5. Client actions (`publish`, `echo`, `report`) call `/api/moderation`.
6. Server moderation layer validates payloads, rate limits, and report rules.
7. Client updates UI from server responses.

### Data model approach

- Base feed data starts from `src/lib/prototype-data.ts`.
- Server moderation state is currently in-memory in `src/lib/server/moderation-store.ts`.
- In-memory store contains:
  - posts
  - echoes per post
  - report counts
  - reporter dedupe sets
  - rate-limit hit windows per session

## Security Model

### Server-authoritative moderation

The client is not trusted for moderation decisions.

- Publish and Echo actions are validated and delayed server-side.
- Report threshold (`3`) is enforced server-side.
- Session identity is validated server-side via `qs_sid` cookie.

### Cookie hardening

`locale`, `country_code`, and `qs_sid` use:

- `Secure`
- `HttpOnly`
- `SameSite=Strict`

### Security headers

Configured globally in `next.config.ts`:

- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy`
- `Cross-Origin-Resource-Policy`

### Header validation

Country inference uses guarded handling:

- trusts `x-vercel-ip-country` only when `x-vercel-id` exists
- normalizes and validates format
- falls back to `US` if missing/tampered

## Project Structure

```text
.
├── middleware.ts
├── next.config.ts
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── moderation/
│   │   │       ├── route.ts
│   │   │       └── session/route.ts
│   │   ├── [locale]/[category]/page.tsx
│   │   ├── [locale]/page.tsx
│   │   ├── ideas/page.tsx
│   │   ├── confusions/page.tsx
│   │   ├── unpopular-opinions/page.tsx
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/prototype/anonymous-space.tsx
│   └── lib/
│       ├── i18n.ts
│       ├── prototype-data.ts
│       └── server/
│           ├── moderation-store.ts
│           └── session-security.ts
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 20+ recommended
- npm 10+

### Install

```bash
npm install
```

### Run in development

```bash
npm run dev
```

Open:

- `http://localhost:3000` (auto-redirects to locale/category)
- example direct route: `http://localhost:3000/en/ideas`

### Lint

```bash
npm run lint
```

### Production build

```bash
npm run build
npm run start
```

## Environment Variables

No required env vars for local boot.

Optional:

| Variable | Description | Default |
| --- | --- | --- |
| `QUIETSIGNAL_SESSION_SALT` | Salt for hashing server session IDs into public visual signal IDs | `quietsignal-session-salt-v1` |

## Routes

### UI routes

- `/` -> redirects to `/{defaultLocale}/ideas`
- `/:locale` -> redirects to `/:locale/ideas`
- `/:locale/:category`
  - `locale`: `en`, `fr`, `ar`
  - `category`: `ideas`, `confusions`, `unpopular-opinions`
- Legacy category redirects:
  - `/ideas`
  - `/confusions`
  - `/unpopular-opinions`

### API routes

- `GET /api/moderation/session`
  - returns public anonymous session id
  - sets/refreshes hardened `qs_sid` when needed
- `POST /api/moderation/session`
  - rotates identity (new server session)
  - returns new public anonymous session id
- `POST /api/moderation`
  - multiplexed moderation actions:
    - `publish`
    - `echo`
    - `report`

## Moderation API

### `publish` action

Request:

```json
{
  "action": "publish",
  "payload": {
    "category": "ideas",
    "content": "What if...",
    "languageCode": "en",
    "countryCode": "US",
    "allowEchoes": true
  }
}
```

Server guarantees:

- validates category/language/content limits
- enforces publish rate limiting
- enforces server-side "scan delay" (1.5s)
- returns normalized post object + author tag

### `echo` action

Request:

```json
{
  "action": "echo",
  "payload": {
    "postId": "srv-...",
    "text": "I agree with this.",
    "intent": "perspective"
  }
}
```

Server guarantees:

- validates post existence + echo enabled state
- blocks replies on hidden/reported-out posts
- validates intent and text limits
- enforces echo rate limiting
- enforces server-side "scan delay" (1.5s)

### `report` action

Request:

```json
{
  "action": "report",
  "payload": {
    "postId": "srv-..."
  }
}
```

Server guarantees:

- dedupes reporter per session
- updates server report count
- returns whether signal is now hidden

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint |

## Troubleshooting

### Build fails fetching Google Fonts

If your network blocks outbound requests, `next build` may fail on `next/font` fetch from Google.

Symptoms:

- `Failed to fetch IBM Plex Sans from Google Fonts`

Options:

1. Run build in an environment with network access.
2. Replace `next/font/google` with local font hosting if offline builds are required.

### Secure cookies on local HTTP

Cookies are intentionally `Secure` + `HttpOnly` + `SameSite=Strict`.
On plain `http://localhost`, browsers may not persist `Secure` cookies depending on setup.
Use HTTPS locally if you need cookie behavior identical to production.

## Known Limitations

- Moderation store is in-memory (not persisted to DB).
  - Data resets when server process restarts.
  - Suitable for prototype/staging, not production scale.
- No authentication/accounts by design.
- No external datastore, queues, or distributed rate limiting yet.

## Deployment Notes

- Recommended: deploy behind HTTPS (required for secure cookie behavior).
- If deploying on Vercel, middleware country detection works with trusted edge headers.
- For non-Vercel environments, country defaults to `US` unless trusted country headers are added.

---

This repository is currently private and intended for prototype iteration.
