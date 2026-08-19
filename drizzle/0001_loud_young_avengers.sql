CREATE TABLE `analysisJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studyId` int NOT NULL,
	`createdBy` int NOT NULL,
	`modelName` varchar(160) NOT NULL,
	`modelVersion` varchar(100) NOT NULL,
	`status` enum('queued','processing','completed','failed','needs_review') NOT NULL DEFAULT 'queued',
	`isDemo` int NOT NULL DEFAULT 1,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`startedAt` timestamp,
	`completedAt` timestamp,
	`errorMessage` text,
	CONSTRAINT `analysisJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analysisResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`analysisJobId` int NOT NULL,
	`segmentationStoragePath` varchar(512),
	`resultMetadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analysisResults_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(120) NOT NULL,
	`resourceType` varchar(80) NOT NULL,
	`resourceId` varchar(80),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clinicianAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`fullName` varchar(160) NOT NULL,
	`professionalRole` varchar(160) NOT NULL,
	`institution` varchar(200) NOT NULL,
	`resetTokenHash` varchar(128),
	`resetTokenExpiresAt` timestamp,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clinicianAccounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `clinicianAccounts_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `patients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`createdBy` int NOT NULL,
	`patientReference` varchar(80) NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `patients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `studies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`createdBy` int NOT NULL,
	`studyDate` timestamp NOT NULL,
	`description` text,
	`status` enum('queued','processing','completed','failed','needs_review') NOT NULL DEFAULT 'queued',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `studyFiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studyId` int NOT NULL,
	`modality` enum('t1','t1ce','t2','flair') NOT NULL,
	`originalFilename` varchar(255) NOT NULL,
	`storagePath` varchar(512) NOT NULL,
	`fileSize` int NOT NULL,
	`mimeType` varchar(150) NOT NULL,
	`uploadStatus` enum('uploaded','failed') NOT NULL DEFAULT 'uploaded',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `studyFiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `studyFiles_storagePath_unique` UNIQUE(`storagePath`)
);
--> statement-breakpoint
ALTER TABLE `analysisJobs` ADD CONSTRAINT `analysisJobs_studyId_studies_id_fk` FOREIGN KEY (`studyId`) REFERENCES `studies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `analysisJobs` ADD CONSTRAINT `analysisJobs_createdBy_clinicianAccounts_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `clinicianAccounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `analysisResults` ADD CONSTRAINT `analysisResults_analysisJobId_analysisJobs_id_fk` FOREIGN KEY (`analysisJobId`) REFERENCES `analysisJobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_userId_clinicianAccounts_id_fk` FOREIGN KEY (`userId`) REFERENCES `clinicianAccounts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patients` ADD CONSTRAINT `patients_createdBy_clinicianAccounts_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `clinicianAccounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studies` ADD CONSTRAINT `studies_patientId_patients_id_fk` FOREIGN KEY (`patientId`) REFERENCES `patients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studies` ADD CONSTRAINT `studies_createdBy_clinicianAccounts_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `clinicianAccounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studyFiles` ADD CONSTRAINT `studyFiles_studyId_studies_id_fk` FOREIGN KEY (`studyId`) REFERENCES `studies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `analysisJobs_owner_status_idx` ON `analysisJobs` (`createdBy`,`status`);--> statement-breakpoint
CREATE INDEX `auditLogs_user_createdAt_idx` ON `auditLogs` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `patients_owner_reference_idx` ON `patients` (`createdBy`,`patientReference`);--> statement-breakpoint
CREATE INDEX `studies_owner_date_idx` ON `studies` (`createdBy`,`studyDate`);--> statement-breakpoint
CREATE INDEX `studies_patient_idx` ON `studies` (`patientId`);--> statement-breakpoint
CREATE INDEX `studyFiles_study_idx` ON `studyFiles` (`studyId`);