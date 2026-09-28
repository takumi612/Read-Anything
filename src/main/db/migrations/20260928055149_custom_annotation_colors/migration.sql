PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_annotations` (
	`id` text PRIMARY KEY,
	`book_id` text NOT NULL,
	`style` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`selected_text` text NOT NULL,
	`locator_range` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_annotations_book_id_books_id_fk` FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON DELETE CASCADE,
	CONSTRAINT "annotations_style_check" CHECK("style" in ('yellow','green','blue','pink','purple','underline') or (length("style") = 7 and substr("style", 1, 1) = '#' and substr("style", 2) not glob '*[^0-9a-fA-F]*'))
);
--> statement-breakpoint
INSERT INTO `__new_annotations`(`id`, `book_id`, `style`, `note`, `selected_text`, `locator_range`, `created_at`, `updated_at`) SELECT `id`, `book_id`, `style`, `note`, `selected_text`, `locator_range`, `created_at`, `updated_at` FROM `annotations`;--> statement-breakpoint
DROP TABLE `annotations`;--> statement-breakpoint
ALTER TABLE `__new_annotations` RENAME TO `annotations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `annotations_book_id_idx` ON `annotations` (`book_id`);