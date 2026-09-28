CREATE TABLE `reading_page_visits` (
	`id` text PRIMARY KEY,
	`book_id` text,
	`page_number` integer NOT NULL,
	`day` text NOT NULL,
	CONSTRAINT `fk_reading_page_visits_book_id_books_id_fk` FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON DELETE SET NULL,
	CONSTRAINT "reading_page_visits_page_positive" CHECK("page_number" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reading_page_visits_book_day_page_unique` ON `reading_page_visits` (`book_id`,`day`,`page_number`) WHERE "reading_page_visits"."book_id" is not null;--> statement-breakpoint
CREATE INDEX `reading_page_visits_day_idx` ON `reading_page_visits` (`day`);--> statement-breakpoint
CREATE INDEX `reading_page_visits_book_id_idx` ON `reading_page_visits` (`book_id`);