CREATE TABLE `watchlist_status` (
	`id` integer PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`list_label` text NOT NULL,
	`item_count` integer NOT NULL,
	`bot_managed_count` integer NOT NULL,
	`synced_at` text NOT NULL,
	`message` text NOT NULL,
	`updated_at` text NOT NULL
);
