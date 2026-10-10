CREATE TABLE `everflow_transactions` (
	`transaction_id` varchar(64) NOT NULL,
	`conversions` int NOT NULL DEFAULT 0,
	`events` int NOT NULL DEFAULT 0,
	`event_names` varchar(512),
	`revenue` double NOT NULL DEFAULT 0,
	`offer` varchar(512),
	`click_at` datetime,
	`first_conversion_at` datetime,
	`last_conversion_at` datetime,
	`synced_at` datetime NOT NULL,
	CONSTRAINT `everflow_transactions_transaction_id` PRIMARY KEY(`transaction_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
ALTER TABLE `raw_imports` ADD `conversions_synced_at` datetime;