ALTER TABLE `analysisJobs` ADD `temporaryArtifactRef` varchar(512);--> statement-breakpoint
ALTER TABLE `analysisJobs` ADD `cleanupStatus` enum('not_required','pending','completed','failed','unsupported') DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE `analysisJobs` ADD `cleanupMessage` varchar(240);--> statement-breakpoint
ALTER TABLE `analysisJobs` ADD `cleanupAttemptedAt` timestamp;