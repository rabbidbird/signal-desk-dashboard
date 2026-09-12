# Paper sessions V2

The session workspace displays one complete simulated account independently of legacy account, position, proposal and watchlist rows. Prior bot history is preserved at `/history/legacy`; session snapshots remain separately selectable. New sessions are created paused, with research paused and execution unarmed. No route in this release arms execution.

The authenticated bot endpoint `/api/bot/paper-session` accepts `register` and `snapshot` actions. Registration supplies a complete first snapshot plus `expected_control_version` and `expected_session_id` (null only for the first install). Registration is an atomic D1 batch fenced by the current paused control version and session pointer. A failed fence rolls back all rows. Success increments the control version, resets the session pointer and keeps the kill switch unchanged. Old runtime commands are forced paused and return no approvals after installation. Legacy proposal and approval routes are fenced off.

Snapshots use protocol version 2 and integer cents, with explicit session, run, sequence and UTC capture time. Account totals and position totals must reconcile. All financial sections, coverage and health are required. New deliveries must be within two minutes, with at most five seconds of future skew. The current pointer advances only for a higher sequence and strictly newer capture time in the current session. Exact retries are idempotent, including after a later snapshot; conflicting material is rejected. A retry belonging to a superseded session returns 409 and never reactivates that session. Initial registration retries are likewise accepted only while that session is current.

`GET /api/paper-session` requires browser authentication and returns the current complete snapshot and authenticated controls from one database statement. A `session` query selects historical projections. Bot GET uses both existing bot bearer authentication and private Sites access. Client-visible health does not confer execution authority.

The workspace shows recorded values with their capture time even when updates stop; it does not label old values as today's performance. An unarmed session has no Resume action, and the server rejects attempts to resume it. Legacy history controls are disabled. Pausing execution and research are separate persisted fields; activation of either remains outside this migration.

Validation covers atomic rollback, initial balances, prior history preservation, exact duplicate replay, conflicting/out-of-order/equal-time/cross-session uploads, unarmed resume rejection, and rendering of the actual session panels. Full unattended market sessions remain a separate observation gate after the user explicitly requests activation.

The September 11 dependency review upgraded Next and its ESLint configuration
to 16.3.4, the matched React/React DOM/RSC packages to 19.2.8, and Vite to
8.0.16, with compatible transitive repairs recorded in the lockfile. The
production-only npm audit is clean. The full build dependency audit still
reports advisories in the pinned Vinext/image parser and Cloudflare/Drizzle
toolchains. Resolving those requires a separately validated tooling migration;
do not run npm audit fix with force or treat the production-only audit as proof
that every bundled Worker dependency is unaffected. The experiment remains
unarmed while this and the bot's unattended-operation gates are reviewed.
# September 12 unattended runner controls

The authenticated current-session page now offers **Start paper trading** after
a fresh paused worker snapshot. A single atomic D1 transaction checks the exact
session and control version, cleared kill switch, no reserved cash, and fresh
position marks before arming and unpausing research/execution. A stale or raced
request returns 409. The bot bearer route cannot perform activation.

Starting the session does not start or schedule the desktop worker. The owner
must separately enable the reviewed scheduler. Pause and Stop also pause the
research flag, so the dashboard describes the runner's actual behavior. Snapshot
delivery retains the 120-second admission bound; the display allows the planned
five-minute cadence plus one minute of completion grace. Activation retains its
stricter 120-second freshness requirement.

The updated dependency set uses Vinext 1.0.0-beta.9, plugin-rsc 0.5.34,
Cloudflare Vite plugin 1.54.8 and Wrangler 4.131.1. Production dependencies have
no audit findings; four moderate development-only findings remain in the
Drizzle Kit/esbuild chain. Do not run an exposed development server or apply an
unreviewed forced downgrade. The current build, route and storage tests verify
the updated toolchain; the site remains owner-private.
