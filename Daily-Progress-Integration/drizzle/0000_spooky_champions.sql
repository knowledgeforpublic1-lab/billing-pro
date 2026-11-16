CREATE TABLE `contractors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`project` text NOT NULL,
	`feeder` text NOT NULL,
	`engineer` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `issues` (
	`id` text PRIMARY KEY NOT NULL,
	`contractor_id` text NOT NULL,
	`date` text NOT NULL,
	`item_id` text NOT NULL,
	`quantity` text NOT NULL,
	`reference` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`contractor_id` text NOT NULL,
	`date` text NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`contractor_id`, `date`)
);
