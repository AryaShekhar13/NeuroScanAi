CREATE TABLE `systemConfigurations` (
	`id` int NOT NULL,
	`inferenceApiBaseUrl` varchar(512),
	`lastApiCheckAt` timestamp,
	`lastApiCheckStatus` enum('unknown','online','offline') NOT NULL DEFAULT 'unknown',
	`lastApiCheckMessage` varchar(240),
	`modelName` varchar(160),
	`modelVersion` varchar(100),
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `systemConfigurations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `clinicianAccounts` ADD `role` enum('clinician','admin') DEFAULT 'clinician' NOT NULL;--> statement-breakpoint
ALTER TABLE `systemConfigurations` ADD CONSTRAINT `systemConfigurations_updatedBy_clinicianAccounts_id_fk` FOREIGN KEY (`updatedBy`) REFERENCES `clinicianAccounts`(`id`) ON DELETE set null ON UPDATE no action;