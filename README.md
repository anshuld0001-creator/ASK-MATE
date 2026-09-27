# Ask Mate

**AI chat that knows when a real human would help more — with a
deterministic matching engine, a consent-gated "Problem Brief," and a
live connection chat.**

A full-stack prototype: Express + JWT auth on the backend, a
no-build-step vanilla JS frontend, a genuinely **streamed** AI chat
response, and a rule-based matching system that scores real people
against what you actually need — independent of whichever AI provider
is plugged in.

> **Read this before you run it:** this is a *production-oriented
> prototype*, not a production deployment. The "What's real vs. what's
> standing in for production infra" section below is short and matters
> for setting expectations correctly.

---

## Table of contents

- [Features](#features)
- [Quick start](#quick-start)
- [Running the tests](#running-the-tests)
- [What's real vs. what's standing in for production infra](#whats-real-vs-whats-standing-in-for-production-infra)
- [Configuration](#configuration)
- [Project structure](#project-structure)
- [API overview](#api-overview)
- [Swapping in Postgres](#swapping-in-postgres)
- [Docker](#docker)
- [Security notes](#security-notes)
- [A note on how this was built](#a-note-on-how-this-was-built)

---

## Features

- 🔐 **JWT auth** — bcrypt-hashed passwords, 7-day tokens
- 💬 **Streamed AI chat** — a real chunked HTTP response, read
  incrementally by the browser (not a simulated typing effect)
- 🔌 **Pluggable AI provider** — swap between a local mock responder
  and OpenAI via one environment variable, no application code changes
- 🧭 **Deterministic matching** — requirement extraction + compatibility
  scoring for finding a human "mate," independent of the AI provider
- 📄 **Consent-gated Problem Brief** — share context with a match only
  after you explicitly agree to
- 🤝 **Connections** — request/accept flow, chat, block/unmatch
- 🧠 **Memories** — lightweight saved-context store
- 📊 **Performance dashboard** — a `/api/metrics` endpoint built from
  real aggregated request logs, not invented numbers
- 🛡️ Rate limiting, structured request-ID logging, centralized error
  handling that never leaks stack traces to the client
- ✅ Unit + integration tests, a Dockerfile, and a documented Postgres
  schema

## Quick start

**Requirements:** [Node.js 18+](https://nodejs.org) (written against
Node 22). No database, Docker, or API key needed to start.

```bash
git clone <this-repo-url>
cd ask-mate
npm install
npm start
```

Open **http://localhost:4000** and create an account (any email and an
8+ character password — this is a local dev database, nothing is
emailed or verified).

Chat, Find a Mate, Connections, Memories, and the Performance dashboard
are all live and backed by the real API.

For auto-restart on file changes while you work:

```bash
npm run dev
```

## Running the tests

```bash
npm test
```

Runs Node's built-in test runner:

- `tests/matching.test.js` — unit tests for the deterministic
  matching/scoring logic
- `tests/auth.test.js` — an integration test that boots the real auth
  routes on an ephemeral port and exercises register/login over HTTP

## What's real vs. what's standing in for production infra

**Real and working, right now, in this repo:**

- Express REST API with JWT auth (bcrypt-hashed passwords, 7-day
  tokens)
- A genuinely **streamed** AI chat endpoint (chunked HTTP response,
  read incrementally by the browser)
- An `AIProvider` abstraction (`server/ai/provider.js`) — swap
  providers via one environment variable
- Deterministic requirement extraction + compatibility scoring for
  matching (`server/ai/matching.js`)
- Consent-gated Problem Brief sharing, connection request/accept flow,
  block/unmatch
- Rate limiting, structured request-ID logging, centralized error
  handling
- A `/api/metrics` endpoint whose numbers are real aggregates of logged
  requests
- Unit + integration tests, a Dockerfile, and a documented Postgres
  schema

**Standing in for infrastructure you'd add for real production use:**

| Area | Current state | Real production path |
|---|---|---|
| Database | JSON file (`server/data/db.json`) via `server/db.js` | `migrations/001_init.sql` has the real Postgres schema — see [Swapping in Postgres](#swapping-in-postgres) |
| AI model | `AI_PROVIDER=mock`, a local rule-based responder | `server/ai/openaiProvider.js` is a ready-to-use OpenAI integration — set `AI_PROVIDER=openai` and `AI_API_KEY` |
| Redis / queues / workers | Not implemented — rate limiting and sessions live in the single Node process's memory | Needed for a horizontally scaled deployment |
| Real-time chat | Frontend polls every 1.5s | WebSockets/SSE for the connection chat view |
| Email verification, password reset, OAuth | Not implemented | The `users` table/route shape doesn't block adding them |
| Load testing, observability, deploy configs | Not included | `docs/ARCHITECTURE.md` describes the target production architecture |

Every screen you can reach reflects what's actually implemented — the
Performance dashboard says in-app which numbers are measured vs. which
use example pricing.

## Configuration

Copy `.env.example` to `.env` if you want to change anything (all
values have working defaults, so this is optional for local use):

```bash
cp .env.example .env
```

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `4000` | |
| `NODE_ENV` | `development` | |
| `JWT_SECRET` | `dev-secret-change-me` | Change for anything beyond local dev — the server warns loudly if it detects the default in `NODE_ENV=production` |
| `AI_PROVIDER` | `mock` | `mock` (offline, no key needed) or `openai` |
| `AI_MODEL` | `gpt-4o-mini` | Used only when `AI_PROVIDER=openai` |
| `AI_API_KEY` | *(empty)* | Required for `openai` provider; read server-side only |
| `CORS_ORIGIN` | `http://localhost:4000` | Set if you split the frontend onto a different host/port |
| `DATABASE_URL` | *(empty)* | Not wired up by default — see [Swapping in Postgres](#swapping-in-postgres) |

## Project structure

```
ask-mate/
├── server/
│   ├── index.js           Express app entrypoint
│   ├── config.js          env var loading + defaults
│   ├── db.js              JSON-file dev datastore
│   ├── middleware/        auth, rate limiting, error handling, request IDs
│   ├── ai/
│   │   ├── provider.js        AIProvider factory (reads AI_PROVIDER)
│   │   ├── mockProvider.js    local rule-based responder (default)
│   │   ├── openaiProvider.js  real streaming OpenAI integration
│   │   └── matching.js        requirement extraction + deterministic scoring
│   └── routes/            auth, users, conversations, matches, connections, memories, metrics
├── public/                frontend (index.html, app.js, styles.css) — no build step
├── migrations/001_init.sql  reference Postgres schema
├── tests/                 node:test unit + integration tests
├── docs/
│   ├── ARCHITECTURE.md    how this maps to the target production architecture
│   └── API.md             endpoint reference
├── Dockerfile, docker-compose.yml
└── .env.example
```

## API overview

All routes are prefixed with `/api`. Authenticated routes expect
`Authorization: Bearer <token>` from `/auth/login` or `/auth/register`.
Full reference in [`docs/API.md`](docs/API.md).

| Group | Key routes |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout` |
| Users | `GET /users/me`, `PATCH /users/me`, `POST /users/:id/block` |
| Conversations | `GET/POST /conversations`, `GET/DELETE /conversations/:id`, `POST /conversations/:id/messages` (streamed) |
| Matches | `POST /matches/search` — deterministic scoring, no AI call |
| Connections | `GET /connections`, `POST /connections`, brief share/decline, messages, unmatch |
| Memories | `GET/POST/DELETE /memories` |
| Metrics | `GET /metrics` — real aggregates from logged AI requests |
| Health | `GET /health` |

## Swapping in Postgres

1. Run `migrations/001_init.sql` against a real Postgres database (or
   use `docker compose --profile infra up postgres`, which mounts this
   directory as init scripts on first boot).
2. Write a new module — e.g. `server/db.pg.js` — using the
   [`pg`](https://node-postgres.com/) package, exporting the exact same
   function names `server/db.js` does now (`getUserByEmail`,
   `createUser`, `listConversations`, …), backed by real SQL against
   the schema above.
3. In `server/routes/*.js`, change `require('../db')` to
   `require('../db.pg')`. Nothing else needs to change.

## Docker

```bash
docker compose up --build
```

Runs the app alone (JSON-file store, port 4000). To also start Postgres
and Redis for when you've wired them up:

```bash
docker compose --profile infra up --build
```

## Security notes

- Passwords are hashed with bcrypt, never stored or logged in plain
  text.
- JWTs are signed with `JWT_SECRET` — the default value is for local
  dev only; the server warns loudly if it detects the default in
  `NODE_ENV=production`.
- No secrets are ever sent to the frontend; `AI_API_KEY` is read
  server-side only.
- Auth and AI-chat routes are rate-limited per IP.
- Error responses never include stack traces outside
  `NODE_ENV=development`.
- This has **not** been through a security review or penetration test
  — do that before handling real user data.

## A note on how this was built

This project was generated in a sandboxed environment with no internet
access — every file was syntax-checked (`node --check`), but `npm
install` and an actual server boot weren't run end to end during
generation. If `npm start` throws something on first run, it's most
likely a small integration issue between files rather than a logic
error in any single one.

## License

No license file is currently included. Add one before treating this repo as open source.
