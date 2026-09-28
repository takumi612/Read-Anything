import { z } from "zod";
import type { TocNode } from "@marginalia/epub-parser";

export type { TocNode };

/** ID chip ngữ cảnh dùng chung cho trạng thái hiện tại và snapshot đã lưu. */
export const chipIdSchema = z.enum(["selection", "paragraph", "chapter-summary", "book-summary"]);

/** Vai trò tin nhắn dùng chung giữa main và renderer. */
export type MessageRole = "system" | "user" | "assistant";

/** Trạng thái cuối của lượt AI; chỉ tin trợ lý có thể khác complete, đã ghi thì không sửa. */
export type MessageStatus = "complete" | "error" | "aborted";

/** Schema dùng khi đọc cột JSON từ DB. */
export const tocNodeSchema: z.ZodType<TocNode> = z.lazy(() =>
  z.object({
    label: z.string(),
    href: z.string(),
    anchor: z.string().optional(),
    children: z.array(tocNodeSchema).optional(),
  }),
);

/** Metadata ứng dụng đính kèm tin nhắn trong UIMessage.metadata. */
export const messageMetadataSchema = z.object({
  contextChips: z
    .array(
      z.object({
        id: chipIdSchema,
        content: z.string(),
        tokenCount: z.number().int().nonnegative(),
      }),
    )
    .optional(),
  model: z.string().optional(),
  usage: z
    .object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
    })
    .optional(),
  // Lý do lỗi lấy nguyên tên/thông điệp từ provider, không tự suy đoán.
  error: z
    .object({
      name: z.string(),
      message: z.string(),
    })
    .optional(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;
