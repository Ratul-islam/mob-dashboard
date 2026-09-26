CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`email` varchar(191) NOT NULL,
	`password` varchar(255) NOT NULL,
	`role` enum('root','user') NOT NULL DEFAULT 'user',
	`is_active` boolean NOT NULL DEFAULT true,
	`must_change_password` boolean NOT NULL DEFAULT false,
	`credentials_changed_at` datetime,
	`last_login_at` datetime,
	`created_by` int,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE `raw_imports` (
	`report_id` varchar(64) NOT NULL,
	`name` varchar(255),
	`type` varchar(32),
	`instance_name` varchar(255),
	`start` int,
	`end` int,
	`status` enum('importing','ready','failed') NOT NULL,
	`rows` int NOT NULL DEFAULT 0,
	`columns` text,
	`error` text,
	`imported_by` int,
	`imported_at` datetime,
	`started_at` datetime NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `raw_imports_report_id` PRIMARY KEY(`report_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE `raw_rows` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`report_id` varchar(64) NOT NULL,
	`timestamp` datetime,
	`source` varchar(512),
	`campaign` varchar(512),
	`result` varchar(32),
	`rule_sets` varchar(512),
	`invalid_traffic_type` varchar(32),
	`remote_address` varchar(64),
	`network` varchar(512),
	`connection` varchar(128),
	`city` varchar(255),
	`region` varchar(255),
	`country` varchar(255),
	`user_agent` text,
	`browser_name` varchar(255),
	`browser_version` varchar(128),
	`os_name` varchar(255),
	`os_version` varchar(128),
	`device_type` varchar(128),
	`device_manufacturer` varchar(255),
	`device_model` varchar(255),
	`mobile` boolean,
	`app_id` varchar(512),
	`device_id` varchar(512),
	`requesting_remote_address` varchar(64),
	`requesting_user_agent` text,
	`additional_data_01` text,
	`additional_data_02` text,
	`additional_data_03` text,
	`additional_data_04` text,
	`additional_data_05` text,
	`additional_data_06` text,
	`additional_data_07` text,
	`additional_data_08` text,
	`additional_data_09` text,
	`additional_data_10` text,
	CONSTRAINT `raw_rows_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`replaced_by_token_hash` varchar(64),
	`revoked_at` datetime,
	`expires_at` datetime NOT NULL,
	`created_by_ip` varchar(64),
	`revoked_by_ip` varchar(64),
	`created_at` datetime NOT NULL,
	CONSTRAINT `refresh_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `refresh_tokens_token_hash_unique` UNIQUE(`token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE `otps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`otp` varchar(12) NOT NULL,
	`type` enum('EMAIL_VERIFICATION','PASSWORD_RESET','TWO_FA') NOT NULL,
	`expires_at` datetime NOT NULL,
	CONSTRAINT `otps_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
ALTER TABLE `raw_imports` ADD CONSTRAINT `raw_imports_imported_by_users_id_fk` FOREIGN KEY (`imported_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `otps` ADD CONSTRAINT `otps_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `raw_rows_report_ts_idx` ON `raw_rows` (`report_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `raw_rows_report_result_idx` ON `raw_rows` (`report_id`,`result`);--> statement-breakpoint
CREATE INDEX `refresh_tokens_user_idx` ON `refresh_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `refresh_tokens_expires_idx` ON `refresh_tokens` (`expires_at`);--> statement-breakpoint
CREATE INDEX `otps_user_type_idx` ON `otps` (`user_id`,`type`);