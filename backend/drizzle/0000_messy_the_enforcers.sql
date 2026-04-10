CREATE TABLE `spools` (
	`id` text PRIMARY KEY NOT NULL,
	`tag_id` text NOT NULL,
	`variant_id` text,
	`material` text,
	`product` text,
	`color_hex` text,
	`weight` real,
	`remain` integer,
	`source` text DEFAULT 'ams' NOT NULL,
	`first_seen` text DEFAULT (datetime('now')) NOT NULL,
	`last_seen` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spools_tag_id_unique` ON `spools` (`tag_id`);