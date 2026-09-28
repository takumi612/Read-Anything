// Nơi xác định context của trợ lý AI theo spec 2026-06-16 §2/§5.
export type ChatContext = { kind: "book"; bookId: string } | { kind: "library" };

/** Khóa ổn định cho ô nhớ chat-store và khóa truy vấn TanStack Query. */
export function contextKey(ctx: ChatContext): string {
  return ctx.kind === "book" ? `book:${ctx.bookId}` : "library";
}

/** Suy ra context từ điều hướng: có sách trên tuyến đọc thì dùng book, còn lại dùng library. */
export function deriveChatContext(
  view: "library" | "stats" | "book",
  currentBookId: string | null,
): ChatContext {
  return view === "book" && currentBookId
    ? { kind: "book", bookId: currentBookId }
    : { kind: "library" };
}

/**
 * Lệnh tải lịch sử hội thoại dùng một lần, không phải state; nonce tăng để bảng tải lại.
 * Nhãn context giúp bên nhận biết lệnh có thuộc về mình hay không.
 */
export type OpenCommand = { conversationId: string; context: ChatContext; nonce: number };

/**
 * Hàm thuần kiểm tra bảng có panelKey trùng contextKey có nên nhận openCommand hay không.
 * Nếu trùng thì trả id hội thoại cần tải; nếu thiếu lệnh hoặc khác context thì trả null.
 * Nhờ đó lệnh của sách không lọt sang trợ lý nổi trong thư viện và ngược lại.
 *
 * Nhận chuỗi contextKey thay cho object context để effect phụ thuộc giá trị ổn định.
 * ReaderView tạo object { kind, bookId } mới mỗi lần render; tính đúng đắn của effect
 * không nên phụ thuộc khả năng ghi nhớ của React Compiler.
 */
export function resolveOpenCommandTarget(
  openCommand: OpenCommand | null,
  panelKey: string,
): string | null {
  if (!openCommand) return null;
  return contextKey(openCommand.context) === panelKey ? openCommand.conversationId : null;
}
