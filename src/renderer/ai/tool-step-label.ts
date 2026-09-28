// src/renderer/ai/tool-step-label.ts
import { getToolName } from "ai";
import type { TFunction } from "i18next";
import type { ChapterRefDto } from "@shared/library";
import type { ToolPart } from "@renderer/ai/segments";

/**
 * Dạng kết quả lỗi mềm của công cụ: runTool trong main process đổi lỗi execute thành
 * kết quả { error } rồi gửi lại mô hình để tự sửa. Vì vậy output-error hiếm khi xuất hiện;
 * kiểm tra lỗi phải nhận cả kết quả dạng này.
 */
export function isErrorShape(output: unknown): boolean {
  return typeof output === "object" && output !== null && "error" in output;
}

export type ToolStepStatus = "loading" | "done" | "failed";

/** Ba trạng thái của bước: failed nhận lỗi cứng hoặc kết quả { error }; output khác là done. */
export function toolStepStatus(part: ToolPart): ToolStepStatus {
  if (part.state === "output-error") return "failed";
  if (part.state === "output-available") return isErrorShape(part.output) ? "failed" : "done";
  // Các state khác, kể cả approval/denied chưa dùng, đều được xem là đang chạy.
  return "loading";
}

/**
 * Ghép tham chiếu chương như resolveChapterRef: id chính xác, rồi href, rồi tiêu đề duy nhất
 * không phân biệt hoa thường. Input chứa tham chiếu gốc nên renderer tự tìm lại;
 * không thấy thì trả null để bên gọi dùng nhãn chung.
 */
function chapterTitle(chapters: ChapterRefDto[], ref: string): string | null {
  const byId = chapters.find((c) => c.id === ref);
  if (byId) return byId.title; // Title null vẫn để bên gọi dùng nhãn chung.
  const byHref = chapters.find((c) => c.href === ref);
  if (byHref) return byHref.title;
  const wanted = ref.trim().toLowerCase();
  const byTitle = chapters.filter((c) => (c.title ?? "").trim().toLowerCase() === wanted);
  return byTitle.length === 1 ? byTitle[0]!.title : null;
}

function inputChapterTitle(
  chapters: ChapterRefDto[],
  input: Record<string, unknown> | undefined,
): string | null {
  return typeof input?.chapterId === "string" ? chapterTitle(chapters, input.chapterId) : null;
}

/**
 * Nhãn dễ đọc cho bước công cụ, gồm số trang hoặc tên chương khi có.
 * Nếu input stream chưa đủ hoặc không tìm được chương, dùng nhãn chung và không ném lỗi.
 * Component truyền hàm t vào; module này không import @renderer/i18n để kiểm thử không cần UI.
 */
export function toolStepLabel(part: ToolPart, chapters: ChapterRefDto[], t: TFunction): string {
  const name = getToolName(part);
  const input = part.input as Record<string, unknown> | undefined;
  switch (name) {
    case "readPage": {
      const page = input?.page;
      return typeof page === "number"
        ? t("ai.toolStep.readPage", "Đọc trang {{page}}", { page })
        : t("ai.toolStep.readPageFallback", "Đọc trang");
    }
    case "readChapterText": {
      const title = inputChapterTitle(chapters, input);
      return title !== null
        ? t("ai.toolStep.readChapterText", "Đọc “{{title}}”", { title })
        : t("ai.toolStep.readChapterTextFallback", "Đọc nội dung chương");
    }
    case "getChapterSummary": {
      const title = inputChapterTitle(chapters, input);
      return title !== null
        ? t("ai.toolStep.getChapterSummary", "Đọc tóm tắt của “{{title}}”", { title })
        : t("ai.toolStep.getChapterSummaryFallback", "Đọc tóm tắt chương");
    }
    case "getToc":
      return t("ai.toolStep.getToc", "Đọc mục lục");
    case "web_search": {
      const query = input?.query;
      return typeof query === "string"
        ? t("ai.toolStep.webSearch", "Tìm trên web: {{query}}", { query })
        : t("ai.toolStep.webSearchFallback", "Tìm trên web");
    }
    default:
      return name;
  }
}
