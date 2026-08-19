ALTER TABLE `demoVisitors` ADD `visitorBindingHash` varchar(64) NULL;--> statement-breakpoint
UPDATE `demoVisitors` SET `visitorBindingHash` = SHA2(CONCAT('legacy-demo-visitor:', `id`), 256) WHERE `visitorBindingHash` IS NULL;--> statement-breakpoint
ALTER TABLE `demoVisitors` MODIFY `visitorBindingHash` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `demoVisitors` ADD CONSTRAINT `demoVisitors_visitorBindingHash_unique` UNIQUE(`visitorBindingHash`);
