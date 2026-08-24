CREATE TABLE `analysisJobEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`analysisJobId` int NOT NULL,
	`stage` varchar(80) NOT NULL,
	`message` varchar(240) NOT NULL,
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analysisJobEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `analysisJobs` MODIFY COLUMN `status` enum('queued','validating','uploading','processing','generating_report','saving','completed','failed','retryable','needs_review') NOT NULL DEFAULT 'queued';--> statement-breakpoint
ALTER TABLE `analysisJobs` ADD `jobKey` varchar(40);--> statement-breakpoint
ALTER TABLE `analysisJobs` ADD `attemptCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `analysisJobs` ADD `remoteJobId` varchar(160);--> statement-breakpoint
ALTER TABLE `analysisJobs` ADD `workerLeaseUntil` timestamp;--> statement-breakpoint
ALTER TABLE `analysisJobs` ADD `progressMessage` varchar(240);--> statement-breakpoint
ALTER TABLE `analysisJobs` ADD `failureCode` varchar(80);--> statement-breakpoint
ALTER TABLE `analysisJobs` ADD `failureStage` varchar(80);--> statement-breakpoint
ALTER TABLE `analysisJobs` ADD `resultCheckpointPath` varchar(512);--> statement-breakpoint
ALTER TABLE `analysisResults` ADD `reportStoragePath` varchar(512);--> statement-breakpoint
ALTER TABLE `analysisJobs` ADD CONSTRAINT `analysisJobs_jobKey_unique` UNIQUE(`jobKey`);--> statement-breakpoint
ALTER TABLE `analysisJobEvents` ADD CONSTRAINT `analysisJobEvents_analysisJobId_analysisJobs_id_fk` FOREIGN KEY (`analysisJobId`) REFERENCES `analysisJobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `analysisJobEvents_job_createdAt_idx` ON `analysisJobEvents` (`analysisJobId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `analysisJobs_worker_idx` ON `analysisJobs` (`status`,`workerLeaseUntil`);