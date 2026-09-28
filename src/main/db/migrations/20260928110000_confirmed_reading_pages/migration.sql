CREATE TABLE `confirmed_reading_pages` (
	`book_id` text NOT NULL,
	`page_number` integer NOT NULL,
	`confirmed_at` integer NOT NULL,
	CONSTRAINT `fk_confirmed_reading_pages_book_id_books_id_fk` FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON DELETE CASCADE,
	CONSTRAINT "confirmed_reading_pages_page_positive" CHECK("page_number" >= 1),
	PRIMARY KEY(`book_id`, `page_number`)
);
--> statement-breakpoint
CREATE INDEX `confirmed_reading_pages_book_id_idx` ON `confirmed_reading_pages` (`book_id`);
--> statement-breakpoint
CREATE TABLE `confirmed_reading_progress` (
	`book_id` text PRIMARY KEY NOT NULL,
	`total_pages` integer NOT NULL,
	`percent` real NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_confirmed_reading_progress_book_id_books_id_fk` FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON DELETE CASCADE,
	CONSTRAINT "confirmed_reading_progress_total_pages_positive" CHECK("total_pages" >= 1),
	CONSTRAINT "confirmed_reading_progress_percent_check" CHECK("percent" >= 0 and "percent" <= 1)
);
