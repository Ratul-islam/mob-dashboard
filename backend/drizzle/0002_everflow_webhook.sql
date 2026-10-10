CREATE TABLE `everflow_conversions` (
	`conversion_id` varchar(64) NOT NULL,
	`transaction_id` varchar(64) NOT NULL,
	`status` varchar(32),
	`is_event` boolean NOT NULL DEFAULT false,
	`event` varchar(255),
	`revenue` double NOT NULL DEFAULT 0,
	`payout` double NOT NULL DEFAULT 0,
	`offer` varchar(512),
	`affiliate` varchar(255),
	`click_at` datetime,
	`converted_at` datetime,
	`source` enum('webhook','api') NOT NULL,
	`received_at` datetime NOT NULL,
	CONSTRAINT `everflow_conversions_conversion_id` PRIMARY KEY(`conversion_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
ALTER TABLE `everflow_transactions` ADD `payout` double DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `everflow_conversions_transaction_idx` ON `everflow_conversions` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `everflow_conversions_received_idx` ON `everflow_conversions` (`received_at`);