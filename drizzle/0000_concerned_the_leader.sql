CREATE TABLE `account_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mode` text NOT NULL,
	`account_label` text NOT NULL,
	`equity_cents` integer NOT NULL,
	`buying_power_cents` integer NOT NULL,
	`open_exposure_cents` integer NOT NULL,
	`day_pnl_cents` integer NOT NULL,
	`win_rate_bps` integer NOT NULL,
	`open_positions_count` integer NOT NULL,
	`recorded_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_account_snapshots_mode_recorded` ON `account_snapshots` (`mode`,`recorded_at`);--> statement-breakpoint
CREATE TABLE `activity_events` (
	`id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`proposal_id` text,
	`event_type` text NOT NULL,
	`symbol` text,
	`message` text NOT NULL,
	`amount_cents` integer,
	`status` text NOT NULL,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_activity_events_occurred` ON `activity_events` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_activity_events_proposal` ON `activity_events` (`proposal_id`);--> statement-breakpoint
CREATE TABLE `decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`proposal_revision` integer NOT NULL,
	`material_hash` text NOT NULL,
	`decision` text NOT NULL,
	`reason` text,
	`actor_user_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`decided_at` text NOT NULL,
	FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `decisions_proposal_id_unique` ON `decisions` (`proposal_id`);--> statement-breakpoint
CREATE INDEX `idx_decisions_decided_at` ON `decisions` (`decided_at`);--> statement-breakpoint
CREATE TABLE `positions` (
	`id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`symbol` text NOT NULL,
	`strategy` text NOT NULL,
	`instrument_id` text NOT NULL,
	`option_type` text NOT NULL,
	`expiration` text NOT NULL,
	`strike_cents` integer NOT NULL,
	`quantity` integer NOT NULL,
	`entry_price_cents` integer NOT NULL,
	`mark_price_cents` integer NOT NULL,
	`pnl_cents` integer NOT NULL,
	`status` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_positions_mode_status` ON `positions` (`mode`,`status`);--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`material_hash` text NOT NULL,
	`mode` text NOT NULL,
	`account_label` text NOT NULL,
	`symbol` text NOT NULL,
	`strategy` text NOT NULL,
	`side` text NOT NULL,
	`instrument_id` text NOT NULL,
	`option_type` text NOT NULL,
	`expiration` text NOT NULL,
	`strike_cents` integer NOT NULL,
	`quantity` integer NOT NULL,
	`limit_price_cents` integer NOT NULL,
	`max_loss_cents` integer NOT NULL,
	`rationale` text NOT NULL,
	`exit_plan` text NOT NULL,
	`broker_review_id` text,
	`broker_alerts_json` text DEFAULT '[]' NOT NULL,
	`quote_timestamp` text NOT NULL,
	`expires_at` text NOT NULL,
	`source_run_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`broker_order_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_proposals_status_expires` ON `proposals` (`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_proposals_updated_at` ON `proposals` (`updated_at`);--> statement-breakpoint
CREATE TABLE `risk_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mode` text NOT NULL,
	`max_positions` integer NOT NULL,
	`max_exposure_cents` integer NOT NULL,
	`daily_loss_limit_cents` integer NOT NULL,
	`daily_loss_remaining_cents` integer NOT NULL,
	`stale_data` integer NOT NULL,
	`broker_connected` integer NOT NULL,
	`summary` text NOT NULL,
	`recorded_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_risk_snapshots_mode_recorded` ON `risk_snapshots` (`mode`,`recorded_at`);--> statement-breakpoint
CREATE TABLE `system_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`paused` integer DEFAULT true NOT NULL,
	`kill_switch_engaged` integer DEFAULT false NOT NULL,
	`reason` text DEFAULT 'Awaiting initial operator review' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `system_state`
  (`id`, `paused`, `kill_switch_engaged`, `reason`, `version`, `updated_by`, `updated_at`)
VALUES
  (1, true, false, 'Awaiting initial operator review', 1, 'migration', CURRENT_TIMESTAMP);
--> statement-breakpoint
PRAGMA optimize;
