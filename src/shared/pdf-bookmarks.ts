import { z } from "zod";

export interface PdfBookmarkDto {
  id: string;
  bookId: string;
  title: string;
  page: number;
  scrollRatio: number;
  createdAt: number;
  updatedAt: number;
}

export const createPdfBookmarkInput = z.object({
  bookId: z.string().min(1),
  title: z.string().trim().min(1).max(500),
  page: z.number().int().positive(),
  scrollRatio: z.number().min(0).max(1),
});

export const renamePdfBookmarkInput = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(500),
});

export const deletePdfBookmarkInput = z.object({ id: z.string().min(1) });
