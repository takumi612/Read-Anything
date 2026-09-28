import { z } from "zod";

/** ID bộ nhớ phía AI: tên ngắn tiếng Anh dạng kebab-case. */
export const memorySlug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "kebab-case slug expected");

/** Dữ liệu bộ nhớ cho bảng quản lý. */
export interface MemoryDto {
  id: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

/** Đầu vào memories:update; bảng quản lý dùng ID và không cho sửa slug. */
export const updateMemoryInput = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
});
export type UpdateMemoryInput = z.infer<typeof updateMemoryInput>;

/** Đầu vào memories:delete. */
export const deleteMemoryInput = z.object({ id: z.string().min(1) });
export type DeleteMemoryInput = z.infer<typeof deleteMemoryInput>;
