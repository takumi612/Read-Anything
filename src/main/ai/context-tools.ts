// Ghép công cụ theo ngữ cảnh: reader có công cụ sách hiện tại và thư viện;
// màn thư viện chỉ có công cụ thư viện/lịch sử đọc. Công cụ bộ nhớ và tìm kiếm
// được thêm riêng trong stream-assistant theo điều kiện bật tương ứng.
import type { DB } from "@main/db/client";
import { createReadingTools, type LoadBytes } from "@main/ai/tools";
import { createLibraryTools } from "@main/ai/library-tools";
import { createReadingSessionTools } from "@main/ai/reading-session-tools";

export interface ContextToolsDeps {
  db: DB;
  /** null là màn thư viện; giá trị khác null là ID sách đang đọc. */
  bookId: string | null;
  loadBytes: LoadBytes;
  /** Provider có hỗ trợ kết quả ảnh của readPage không. */
  imageToolResults?: boolean;
}

export function createContextTools(deps: ContextToolsDeps) {
  const { db, bookId, loadBytes, imageToolResults } = deps;
  const library = createLibraryTools({ db });
  const readingSessions = createReadingSessionTools({ db, scopedBookId: bookId });
  if (bookId == null) return { ...library, ...readingSessions };
  return {
    ...createReadingTools({ db, bookId, loadBytes, imageToolResults }),
    ...library,
    ...readingSessions,
  };
}
