# Signal Desk repository instructions

## Repository boundary

- This directory is a standalone Git repository for the private Signal Desk
  dashboard. Commit and publish it separately from the parent trading-bot repo.
- Keep the site private and authenticated. Do not turn it into a public trading
  dashboard or expose bot-control routes without access checks.

## Safety invariants

- Start fresh migrations paused and fail closed on missing or stale state.
- Bind every approval to the exact proposal id, revision, material hash, and
  expiration. Preserve pause and kill-switch enforcement.
- Automatic approval may apply only to eligible unexpired paper proposals while
  pause and kill are clear. Never extend it to live proposals.
- Validate bot bearer authentication and browser user authentication on the
  server; do not move security decisions into client-side code.

## Environment and verification

- Use Node.js 22.13 or newer and install from `package-lock.json` with
  `npm ci` on a fresh machine.
- Run `npm test` and `npm run lint` after code changes. Run `npm run build` when
  changing routing, rendering, configuration, or deployment behavior.
- Keep generated migrations under `drizzle/` reviewable and committed when the
  schema changes.

## Secrets and collaboration

- Never commit `.env` files, bearer tokens, Cloudflare credentials, build
  output, Wrangler state, dependency directories, or local work artifacts.
- Use one branch or Git worktree per task or agent. Pull before starting, push a
  task branch, and merge only after tests and diff review pass.

## Bounded Grok advisory lane

- Grok is optional, explicitly invoked, and advisory only. Prefer the locally
  installed hardened trading Grokodex `grok_run` tool for bounded planning,
  research synthesis from approved context, complex coding candidates, second
  opinions, reviews, and rescue tasks. This coding/research lane must expose
  only `grok_setup` and `grok_run`; image generation and every other Grok tool
  are out of scope and require a separately reviewed plugin and work order.
- Use only the existing local `grok login`/grok.com subscription session. Never
  request, store, transmit, or fall back to `XAI_API_KEY`, `GROK_API_KEY`, or
  any other xAI API key. If subscription authentication or the bounded wrapper
  is unavailable, stop and report the gap.
- Invoke Grok only from the exact root of a dedicated, registered,
  non-canonical worktree assigned to one Grok advisory work order. Never invoke
  it from the trading loop, heartbeat, market-session checks, position
  monitoring, proposal generation, approval flow, a dashboard request or
  control handler, or any production command or process that can read or affect
  paper state. Do not add Grok or xAI as a runtime dependency, service, hook,
  fallback, or application code path.
- The hardened `grok_run` path must start a fresh restricted session and give
  Grok no filesystem, shell, Git, GitHub, network, memory, or sub-agent tools.
  It returns response text only and must report zero model tool calls. Codex
  alone inspects files, applies selected edits, validates behavior, stages,
  commits, pushes, opens pull requests, and prepares owner-decision packets.
- The Grok advisory lane and every Codex implementation or review lane must use
  completely separate issues, branches, registered worktrees, and pull
  requests. Codex provisions and controls the Grok lane's Git/GitHub records;
  Grok never accesses them. A Grok pull request may contain only a sanitized
  advisory/evidence record. Adopted advice starts again from the reviewed base
  in a separate Codex work order; do not reuse or cherry-pick the Grok lane.
- Before dispatch, use
  `.github/ISSUE_TEMPLATE/grok-advisory-work-order.md`. Minimize the prompt to
  approved non-secret context. Never include credentials, browser or login
  state, runtime state, database files, logs, proposals, position data, or
  pause, kill, approval, or other control-state tokens in prompts, Git, or issue
  content.
- Before dispatch, record the exact clean worktree, branch, base commit,
  owner-approved prompt hash, `grok_run`-only tool surface, frozen plugin and
  CLI versions/hashes, identified repository-owner reviewer, and that owner's
  explicit run authorization. Afterward, verify zero model tool calls and an
  exact one-report-file diff. Any mismatch stops the run and quarantines its
  output.
- For work touching the bot/dashboard contract, Codex must read and enforce
  both repositories' `AGENTS.md` files, while still creating separate work
  orders and Grok runs for each repository. Each advisory record must name the
  exact commit SHA reviewed by the identified repository owner and contain that
  owner's recorded disposition. AI output cannot populate, sign, or satisfy an
  owner authorization, review, approval, or disposition field. No AI-generated
  work may be accepted or merged without that owner record. Grok cannot
  approve, merge, promote, publish, or make owner decisions.
