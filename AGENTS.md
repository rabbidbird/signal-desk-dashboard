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
