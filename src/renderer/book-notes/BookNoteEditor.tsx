import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CornerDownLeft } from "lucide-react";
import { Kbd, KbdGroup, ModKey } from "@renderer/components/ui/kbd";
import { MarkdownEditor } from "@renderer/components/MarkdownEditor";
import { Button } from "@renderer/components/ui/button";

export type BookNoteEditorState =
  | { mode: "create" }
  | { mode: "edit"; noteId: string; initialContent: string };

/**
 * Editor ghi chú chiếm toàn vùng BookNotesPanel thay danh sách, đứng cạnh bảng AI.
 * Người dùng vẫn xem và sao chép hội thoại khi viết ghi chú.
 * Editor dùng CodeMirror ở chế độ nguồn Markdown có tô cú pháp.
 * Bên gọi gắn lại mỗi lần vào chế độ sửa, nên defaultValue cung cấp nội dung ban đầu.
 */
export function BookNoteEditor({
  state,
  onSave,
  onClose,
}: {
  state: BookNoteEditorState;
  /** Callback lưu chỉ nhận content không rỗng sau trim; bên gọi lấy noteId từ state khi sửa. */
  onSave: (content: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const initial = state.mode === "edit" ? state.initialContent : "";
  // State phản chiếu nội dung chỉ phục vụ nút Lưu; phím tắt ⌘+Enter lấy toàn văn trực tiếp từ editor.
  const [text, setText] = useState(initial);

  const submit = (value: string) => {
    const content = value.trim();
    if (!content) return;
    onSave(content);
    onClose();
  };

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <h3 className="shrink-0 px-1 text-sm font-semibold">
        {state.mode === "edit"
          ? t("bookNotes.editTitle", "Sửa ghi chú")
          : t("bookNotes.addTitle", "Ghi chú mới")}
      </h3>
      <MarkdownEditor
        autoFocus
        defaultValue={initial}
        onChange={setText}
        onSubmit={submit}
        onCancel={onClose}
        placeholder={t("bookNotes.placeholder", "Viết suy nghĩ của bạn về cuốn sách…")}
        className="flex-1"
      />
      <p className="shrink-0 px-1 text-xs text-muted-foreground">
        {t("bookNotes.markdownHint", "Hỗ trợ Markdown, nội dung sẽ được hiển thị sau khi lưu")}
      </p>
      <div className="flex shrink-0 justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t("common.cancel", "Hủy")}
        </Button>
        <Button size="sm" onClick={() => submit(text)} disabled={text.trim() === ""}>
          {t("common.save", "Lưu")}
          <KbdGroup>
            <ModKey className="border-transparent bg-primary-foreground/20 text-primary-foreground" />
            <Kbd className="border-transparent bg-primary-foreground/20 text-primary-foreground">
              <CornerDownLeft className="size-3" />
            </Kbd>
          </KbdGroup>
        </Button>
      </div>
    </div>
  );
}
