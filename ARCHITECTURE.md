# Architecture

## Today (this codebase)

```
Browser (public/)
   │  fetch, streaming reads
   ▼
Express API (server/)
   │
   ├── middleware/  auth (JWT), rateLimit (in-memory), errorHandler, requestId
   ├── routes/      auth, users, conversations, matches, connections, memories, metrics
   ├── ai/          provider.js (factory) → mockProvider.js | openaiProvider.js
   │                matching.js (deterministic requirement extraction + scoring)
   └── db.js        JSON file at server/data/db.json
```

Single Node process, single JSON file, no external services. This is
intentional: it's the fastest path to something you can actually run and
demo, and every interface (`AIProvider`, the db.js function set) is shaped
so each dev-mode piece has an obvious production replacement.

## Where this differs from the target production architecture

```
Load Balancer
   │
Multiple API instances (this server, horizontally scaled)
   │
PostgreSQL  ←  migrations/001_init.sql is the real schema
   │
Redis        (sessions/rate limiting shared across instances, caching)
   │
Queue + Workers  (conversation summarization, embeddings, notifications,
                   moderation, cleanup — none of this exists yet here)
   │
Inference provider (openaiProvider.js is the first concrete example;
                     add siblings for Together/Fireworks/etc. behind the
                     same two-function interface)
```

Concretely, moving from this repo to that architecture means:

1. **Swap `server/db.js` for a Postgres-backed module** with the same
   exported function names (`getUserByEmail`, `createConversation`, …),
   using `migrations/001_init.sql` as the schema. Nothing in `routes/`
   needs to change if the function signatures match.
2. **Move rate limiting and sessions into Redis** so limits are enforced
   across multiple running instances, not just one process's memory.
3. **Add a queue + worker process** for anything that doesn't need to
   block the user's response (conversation summarization, embeddings for
   RAG, notification delivery).
4. **Add real load testing** (k6 or similar) against the deployed stack
   before making any claim about concurrent capacity — the 100,000 number
   in this repo is a registered-user architecture target, not a tested
   concurrency figure.
5. **Add OpenTelemetry/Prometheus/Sentry** in place of the current
   structured `console.log` lines in `utils/logger.js`.

## AI safety and prompt security

The mock provider can't be prompt-injected (it doesn't call an LLM), but
`openaiProvider.js` sends only a fixed system prompt plus the user's own
conversation history — never raw retrieved documents or other users' data
— and nothing about internal configuration is ever included in a prompt.
A production build should add: input length/abuse limits (partially done
via the 4000-char cap and rate limiter), output filtering for the safety
categories listed in the original spec (self-harm, violence, illegal
activity, harassment, CSAM, privacy violations, prompt injection,
system-prompt extraction), and human-review escalation paths.
