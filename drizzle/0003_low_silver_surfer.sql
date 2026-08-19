CREATE TABLE `demoVisitors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`ipHash` varchar(64) NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `demoVisitors_id` PRIMARY KEY(`id`),
	CONSTRAINT `demoVisitors_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE INDEX `demoVisitors_ip_createdAt_idx` ON `demoVisitors` (`ipHash`,`createdAt`);