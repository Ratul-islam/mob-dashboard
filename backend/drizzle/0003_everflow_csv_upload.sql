CREATE TABLE `everflow_uploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`file_name` varchar(255),
	`rows` int NOT NULL DEFAULT 0,
	`conversions` int NOT NULL DEFAULT 0,
	`first_conversion_at` datetime,
	`last_conversion_at` datetime,
	`uploaded_by` int,
	`uploaded_at` datetime NOT NULL,
	CONSTRAINT `everflow_uploads_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
DROP INDEX `everflow_conversions_received_idx` ON `everflow_conversions`;--> statement-breakpoint
ALTER TABLE `everflow_transactions` ADD `status` varchar(32);--> statement-breakpoint
ALTER TABLE `everflow_uploads` ADD CONSTRAINT `everflow_uploads_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `raw_imports` DROP COLUMN `conversions_synced_at`;--> statement-breakpoint
ALTER TABLE `everflow_conversions` DROP COLUMN `source`;