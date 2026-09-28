CREATE TABLE `vocabulary_entries` (
	`id` text PRIMARY KEY,
	`book_id` text NOT NULL,
	`term` text NOT NULL,
	`normalized_term` text NOT NULL,
	`meaning` text NOT NULL,
	`context` text NOT NULL,
	`source_page` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_vocabulary_entries_book_id_books_id_fk` FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `vocabulary_overrides` (
	`entry_id` text NOT NULL,
	`page` integer NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`meaning` text NOT NULL,
	CONSTRAINT `vocabulary_overrides_pk` PRIMARY KEY(`entry_id`, `page`, `start`, `end`),
	CONSTRAINT `fk_vocabulary_overrides_entry_id_vocabulary_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `vocabulary_entries`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vocabulary_book_term_unique` ON `vocabulary_entries` (`book_id`,`normalized_term`);--> statement-breakpoint
CREATE INDEX `vocabulary_book_idx` ON `vocabulary_entries` (`book_id`);