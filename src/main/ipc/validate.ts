import type { z } from "zod";

/** Kiểm tra đầu vào IPC; sai thì ném lỗi có tên channel và chi tiết dễ đọc. */
export function validateInput<T>(channel: string, schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
      .join("; ");
    throw new Error(`IPC ${channel} invalid input: ${detail}`);
  }
  return parsed.data;
}
