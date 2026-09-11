import { foreignKey, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const proposals = sqliteTable(
  "proposals",
  {
    id: text("id").primaryKey(),
    revision: integer("revision").notNull().default(1),
    materialHash: text("material_hash").notNull(),
    mode: text("mode", { enum: ["paper", "live"] }).notNull(),
    accountLabel: text("account_label").notNull(),
    symbol: text("symbol").notNull(),
    strategy: text("strategy").notNull(),
    side: text("side", { enum: ["buy", "sell"] }).notNull(),
    instrumentId: text("instrument_id").notNull(),
    optionType: text("option_type", { enum: ["call", "put"] }).notNull(),
    expiration: text("expiration").notNull(),
    strikeCents: integer("strike_cents").notNull(),
    quantity: integer("quantity").notNull(),
    limitPriceCents: integer("limit_price_cents").notNull(),
    maxLossCents: integer("max_loss_cents").notNull(),
    rationale: text("rationale").notNull(),
    exitPlan: text("exit_plan").notNull(),
    brokerReviewId: text("broker_review_id"),
    brokerAlertsJson: text("broker_alerts_json").notNull().default("[]"),
    quoteTimestamp: text("quote_timestamp").notNull(),
    expiresAt: text("expires_at").notNull(),
    sourceRunId: text("source_run_id").notNull(),
    status: text("status", {
      enum: [
        "pending",
        "approved",
        "denied",
        "submitted",
        "partially_filled",
        "filled",
        "cancelled",
        "rejected",
      ],
    })
      .notNull()
      .default("pending"),
    brokerOrderId: text("broker_order_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_proposals_status_expires").on(table.status, table.expiresAt),
    index("idx_proposals_updated_at").on(table.updatedAt),
  ],
);

export const decisions = sqliteTable(
  "decisions",
  {
    id: text("id").primaryKey(),
    proposalId: text("proposal_id")
      .notNull()
      .unique()
      .references(() => proposals.id),
    proposalRevision: integer("proposal_revision").notNull(),
    materialHash: text("material_hash").notNull(),
    decision: text("decision", { enum: ["approved", "denied"] }).notNull(),
    reason: text("reason"),
    actorUserId: text("actor_user_id").notNull(),
    actorEmail: text("actor_email").notNull(),
    decidedAt: text("decided_at").notNull(),
  },
  (table) => [index("idx_decisions_decided_at").on(table.decidedAt)],
);

export const accountSnapshots = sqliteTable(
  "account_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mode: text("mode", { enum: ["paper", "live"] }).notNull(),
    accountLabel: text("account_label").notNull(),
    equityCents: integer("equity_cents").notNull(),
    buyingPowerCents: integer("buying_power_cents").notNull(),
    openExposureCents: integer("open_exposure_cents").notNull(),
    dayPnlCents: integer("day_pnl_cents").notNull(),
    winRateBps: integer("win_rate_bps").notNull(),
    openPositionsCount: integer("open_positions_count").notNull(),
    recordedAt: text("recorded_at").notNull(),
  },
  (table) => [index("idx_account_snapshots_mode_recorded").on(table.mode, table.recordedAt)],
);

export const riskSnapshots = sqliteTable(
  "risk_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mode: text("mode", { enum: ["paper", "live"] }).notNull(),
    maxPositions: integer("max_positions").notNull(),
    maxExposureCents: integer("max_exposure_cents").notNull(),
    dailyLossLimitCents: integer("daily_loss_limit_cents").notNull(),
    dailyLossRemainingCents: integer("daily_loss_remaining_cents").notNull(),
    staleData: integer("stale_data", { mode: "boolean" }).notNull(),
    brokerConnected: integer("broker_connected", { mode: "boolean" }).notNull(),
    summary: text("summary").notNull(),
    recordedAt: text("recorded_at").notNull(),
  },
  (table) => [index("idx_risk_snapshots_mode_recorded").on(table.mode, table.recordedAt)],
);

export const watchlistStatus = sqliteTable("watchlist_status", {
  id: integer("id").primaryKey(),
  status: text("status", { enum: ["connected", "degraded", "offline"] }).notNull(),
  listLabel: text("list_label").notNull(),
  itemCount: integer("item_count").notNull(),
  botManagedCount: integer("bot_managed_count").notNull(),
  syncedAt: text("synced_at").notNull(),
  message: text("message").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const positions = sqliteTable(
  "positions",
  {
    id: text("id").primaryKey(),
    mode: text("mode", { enum: ["paper", "live"] }).notNull(),
    symbol: text("symbol").notNull(),
    strategy: text("strategy").notNull(),
    instrumentId: text("instrument_id").notNull(),
    optionType: text("option_type", { enum: ["call", "put"] }).notNull(),
    expiration: text("expiration").notNull(),
    strikeCents: integer("strike_cents").notNull(),
    quantity: integer("quantity").notNull(),
    entryPriceCents: integer("entry_price_cents").notNull(),
    markPriceCents: integer("mark_price_cents").notNull(),
    pnlCents: integer("pnl_cents").notNull(),
    status: text("status", { enum: ["open", "closed"] }).notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_positions_mode_status").on(table.mode, table.status)],
);

export const activityEvents = sqliteTable(
  "activity_events",
  {
    id: text("id").primaryKey(),
    mode: text("mode", { enum: ["paper", "live"] }).notNull(),
    proposalId: text("proposal_id").references(() => proposals.id),
    eventType: text("event_type").notNull(),
    symbol: text("symbol"),
    message: text("message").notNull(),
    amountCents: integer("amount_cents"),
    status: text("status").notNull(),
    occurredAt: text("occurred_at").notNull(),
  },
  (table) => [
    index("idx_activity_events_occurred").on(table.occurredAt),
    index("idx_activity_events_proposal").on(table.proposalId),
  ],
);

export const systemState = sqliteTable("system_state", {
  id: integer("id").primaryKey(),
  paused: integer("paused", { mode: "boolean" }).notNull().default(true),
  killSwitchEngaged: integer("kill_switch_engaged", { mode: "boolean" })
    .notNull()
    .default(false),
  reason: text("reason").notNull().default("Awaiting initial operator review"),
  version: integer("version").notNull().default(1),
  updatedBy: text("updated_by").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// V2 keeps complete immutable projections separate from legacy financial rows.
export const paperSessions = sqliteTable("paper_sessions", {
  id: text("id").primaryKey(),
  initialCashCents: integer("initial_cash_cents").notNull(),
  createdAt: text("created_at").notNull(),
});

export const paperSessionSnapshots = sqliteTable("paper_session_snapshots", {
  sessionId: text("session_id").notNull().references(() => paperSessions.id),
  sequence: integer("sequence").notNull(),
  runId: text("run_id").notNull(),
  materialHash: text("material_hash").notNull(),
  capturedAt: text("captured_at").notNull(),
  envelopeJson: text("envelope_json").notNull(),
}, (table) => [
  primaryKey({ columns: [table.sessionId, table.sequence] }),
  uniqueIndex("idx_paper_snapshot_session_run").on(table.sessionId, table.runId),
]);

export const paperSessionPointer = sqliteTable("paper_session_pointer", {
  id: integer("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  snapshotSequence: integer("snapshot_sequence").notNull(),
  executionArmed: integer("execution_armed", { mode: "boolean" }).notNull().default(false),
  researchPaused: integer("research_paused", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull(),
}, (table) => [foreignKey({ columns: [table.sessionId, table.snapshotSequence], foreignColumns: [paperSessionSnapshots.sessionId, paperSessionSnapshots.sequence] })]);
