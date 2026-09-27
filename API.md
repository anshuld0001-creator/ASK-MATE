# Ask Mate API

All routes are prefixed with `/api`. Authenticated routes expect
`Authorization: Bearer <token>` from `/auth/login` or `/auth/register`.

## Auth
- `POST /auth/register` `{email, password, name?}` → `{token, user}`
- `POST /auth/login` `{email, password}` → `{token, user}`
- `POST /auth/logout` → `{ok:true}` (stateless JWT — client discards the token)

## Users
- `GET /users/me` → current user profile
- `PATCH /users/me` `{name?, bio?, skills?, languages?}` → updated profile
- `POST /users/:id/block` → `{ok:true}`

## Conversations
- `GET /conversations` → list (id, title, updatedAt, messageCount)
- `POST /conversations` → create, returns the new conversation
- `GET /conversations/:id` → full conversation with messages
- `DELETE /conversations/:id` → `{ok:true}`
- `POST /conversations/:id/messages` `{text}` → **streams** the assistant's
  reply as plain text (chunked transfer), followed by a trailing
  `\u0000<json>` metadata block: `{requestId, needsHuman, inputTokens,
  outputTokens, latencyMs, ttftMs, messageId}`

## Matches
- `POST /matches/search` `{query}` → `{requirements, results}` — deterministic
  skill/availability scoring, no AI call

## Connections
- `GET /connections` / `GET /connections/:id`
- `POST /connections` `{mateId, brief}` → creates a pending connection
  (auto-accepts after ~2.5s in this demo, standing in for the matched
  person's own accept/decline)
- `POST /connections/:id/brief/share` / `/brief/decline`
- `POST /connections/:id/messages` `{text}` → appends your message; the
  demo mate auto-replies ~1.2s later
- `POST /connections/:id/unmatch`

## Memories
- `GET /memories`, `POST /memories` `{text}`, `DELETE /memories/:id`

## Metrics
- `GET /metrics` → aggregated, real numbers from your own logged AI
  requests (`requests`, `avgTtftMs`, `avgLatencyMs`, `inputTokens`,
  `outputTokens`, `errorRate`, `estCostPer1kConversations`)

## Health
- `GET /health` → `{status, provider, env}` (no auth)
