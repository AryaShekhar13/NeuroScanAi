CREATE TABLE `authRateLimits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scope` varchar(64) NOT NULL,
	`keyHash` varchar(64) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`windowStartedAt` timestamp NOT NULL DEFAULT (now()),
	`lockedUntil` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `authRateLimits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `clinicianAccounts` ADD `resetTokenUsedAt` timestamp;--> statement-breakpoint
ALTER TABLE `clinicianAccounts` ADD `sessionVersion` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `studyFiles` ADD `checksum` varchar(64);--> statement-breakpoint
ALTER TABLE `studyFiles` ADD `relativePath` varchar(512);--> statement-breakpoint
ALTER TABLE `studyFiles` ADD `uncompressedSize` int;--> statement-breakpoint
ALTER TABLE `studyFiles` ADD `metadata` json;--> statement-breakpoint
CREATE INDEX `authRateLimits_scope_key_idx` ON `authRateLimits` (`scope`,`keyHash`);