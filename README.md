# Signal Desk dashboard

Signal Desk is the private operator surface for the trading experiment. It uses
ChatGPT sign-in for browser access, Cloudflare D1 for durable state, and a
separate bearer token for the local bot. The dashboard starts paused after a
fresh migration.

## Local commands

```bash
npm install
npm run db:generate
npm run dev
npm run build
npm test
```

Set `BOT_API_TOKEN` from `.env.example` to a randomly generated value of at
least 32 characters. Store the same value in the local bot's operating-system
secret store. Do not put the real value in source code, a request URL, or Git.

## Bot API contract

Every bot request must include:

```text
Authorization: Bearer <BOT_API_TOKEN>
X-Signal-Desk-Bot: signal-desk-local
Content-Type: application/json  # POST only
```

- `POST /api/bot/proposals` ingests one exact, short-lived trade proposal. The
  server computes the material SHA-256 hash. Reusing the id with unchanged
  material is idempotent; changing a pending proposal increments its revision;
  a decided proposal is immutable. Live proposals accept only supported
  single-leg Level 2 strategies and require a broker review id.
- `POST /api/bot/telemetry` accepts bounded `account`, `risk`, `positions`,
  `activities`, and `executions` sections. Execution updates succeed only when
  they match an approved decision id, proposal revision, and material hash.
- `GET /api/bot/commands?since=<ISO-8601>` returns immutable approve/deny
  commands and the current pause/kill-switch state. The bot must fail closed
  whenever `paused` or `killSwitchEngaged` is true.

Browser reads use `GET /api/dashboard`. Browser decisions use
`POST /api/proposals/:id/decision`; emergency controls use `PATCH /api/control`.
Both browser write routes verify the ChatGPT-authenticated user on the server.
An approval is a one-time decision bound to the proposal id, current revision,
material hash, and expiration. A pause or kill-switch state blocks approval.

## Hosting requirements

The Site needs the logical D1 binding `DB`, the generated migration under
`drizzle/`, a private access policy, and a hosted `BOT_API_TOKEN` runtime
secret. The migration seeds a fail-closed paused state. Do not publish the Site
publicly because it is an authenticated trading-control surface.
