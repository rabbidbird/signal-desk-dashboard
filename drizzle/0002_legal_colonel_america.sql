CREATE TABLE `paper_session_pointer` (
	`id` integer PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`snapshot_sequence` integer NOT NULL,
	`execution_armed` integer DEFAULT false NOT NULL,
	`research_paused` integer DEFAULT true NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_id`,`snapshot_sequence`) REFERENCES `paper_session_snapshots`(`session_id`,`sequence`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `paper_session_snapshots` (
	`session_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`run_id` text NOT NULL,
	`material_hash` text NOT NULL,
	`captured_at` text NOT NULL,
	`envelope_json` text NOT NULL,
	PRIMARY KEY(`session_id`, `sequence`),
	FOREIGN KEY (`session_id`) REFERENCES `paper_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_paper_snapshot_session_run` ON `paper_session_snapshots` (`session_id`,`run_id`);--> statement-breakpoint
CREATE TABLE `paper_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`initial_cash_cents` integer NOT NULL,
	`created_at` text NOT NULL
);
