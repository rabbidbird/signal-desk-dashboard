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
- `POST /api/bot/telemetry` accepts bounded `account`, `risk`, `watchlist`,
  `positions`, `activities`, and `executions` sections. The optional watchlist
  object records `status`, `listLabel`, `itemCount`, `botManagedCount`,
  `syncedAt`, and `message` for paper-only Robinhood Options Watchlist
  monitoring. Missing watchlist telemetry displays as Awaiting sync. Execution
  updates succeed only when they match an approved decision id, proposal
  revision, and material hash.
- `GET /api/bot/commands?since=<ISO-8601>` returns immutable approve/deny
  commands and the current pause/kill-switch state. The bot must fail closed
  whenever `paused` or `killSwitchEngaged` is true.

Browser reads use `GET /api/dashboard`. Browser decisions use
`POST /api/proposals/:id/decision`; emergency controls use `PATCH /api/control`.
Both browser write routes verify the ChatGPT-authenticated user on the server.
An approval is a one-time decision bound to the proposal id, current revision,
material hash, and expiration. A pause or kill-switch state blocks approval.

## Financial data freshness

Refreshing the page does not make an old bot snapshot current. Account and risk
snapshots expire after 20 minutes (the 15-minute reporting cadence plus five
minutes to finish). Missing, invalid, or future timestamps fail closed. The
browser continues aging retained data when a refresh fails.

Current account totals require fresh account and risk snapshots, non-stale
prices, matching report timestamps, and agreement between the account position
count and the complete position snapshot. Filtering the visible positions does
not change this check. A flat account reports that position prices are not
required; an unconfirmed broker connection is never labeled offline as a fact.
Until those checks pass, current equity, buying power, P&L, exposure, and position
counts are hidden. Risk data cannot claim fresh prices or a current connection
from an expired snapshot. The equity chart remains historical and displays the
full date and freshness of its last snapshot. Pause and emergency controls remain
available independently of financial telemetry; these display checks do not
change the bot's deterministic trading controls or approval rules.

## Hosting requirements

The Site needs the logical D1 binding `DB`, the generated migration under
`drizzle/`, a private access policy, and a hosted `BOT_API_TOKEN` runtime
secret. The migration seeds a fail-closed paused state. Do not publish the Site
publicly because it is an authenticated trading-control surface.
