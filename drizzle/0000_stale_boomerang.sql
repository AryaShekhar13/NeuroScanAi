CREATE TABLE `accessRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(320) NOT NULL,
	`company` varchar(160),
	`message` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `accessRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `workspaceFiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`url` varchar(768) NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`mimeType` varchar(150) NOT NULL,
	`sizeBytes` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workspaceFiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspaceFiles_fileKey_unique` UNIQUE(`fileKey`)
);
--> statement-breakpoint
ALTER TABLE `workspaceFiles` ADD CONSTRAINT `workspaceFiles_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `accessRequests_createdAt_idx` ON `accessRequests` (`createdAt`);--> statement-breakpoint
CREATE INDEX `workspaceFiles_owner_createdAt_idx` ON `workspaceFiles` (`ownerId`,`createdAt`);