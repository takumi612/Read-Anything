CREATE TABLE `pdf_bookmarks` (
	`id` text PRIMARY KEY,
	`book_id` text NOT NULL,
	`title` text NOT NULL,
	`page` integer NOT NULL,
	`scroll_ratio` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_pdf_bookmarks_book_id_books_id_fk` FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `pdf_bookmarks_book_idx` ON `pdf_bookmarks` (`book_id`);