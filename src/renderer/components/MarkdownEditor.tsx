import { useEffect, useRef } from "react";
import { EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownKeymap, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { cn } from "@renderer/lib/utils";

/**
 * Kiểu tô cú pháp Markdown trong chế độ nguồn giống Obsidian: tiêu đề lớn theo cấp,
 * chữ đậm và nghiêng hiển thị thật, còn ký hiệu cùng trích dẫn dịu đi.
 * Màu dùng biến CSS shadcn của ứng dụng để theo chủ đề sáng tối.
 * Chế độ xem trực tiếp sau này sẽ thêm decoration để ẩn ký hiệu ở dòng không hoạt động.
 */
const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: "1.35em", fontWeight: "700" },
  { tag: tags.heading2, fontSize: "1.2em", fontWeight: "700" },
  { tag: tags.heading3, fontSize: "1.1em", fontWeight: "700" },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: "700" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  {
    tag: tags.monospace,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.9em",
    backgroundColor: "color-mix(in oklch, var(--muted) 70%, transparent)",
    borderRadius: "3px",
  },
  { tag: tags.quote, color: "var(--muted-foreground)", fontStyle: "italic" },
  { tag: [tags.link, tags.url], color: "var(--primary)", textDecoration: "underline" },
  // Làm dịu các ký hiệu Markdown và metadata để nội dung chính nổi bật.
  {
    tag: [tags.processingInstruction, tags.meta, tags.punctuation],
    color: "var(--muted-foreground)",
  },
]);

/** Kiểu nền của editor: nền trong suốt và kế thừa phông từ khung thay cho monospace mặc định của CodeMirror. */
const baseTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "0.875rem", backgroundColor: "transparent" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "1.65", overflow: "auto" },
  ".cm-content": { padding: "8px 0", caretColor: "var(--foreground)" },
  ".cm-line": { padding: "0 10px" },
  ".cm-cursor": { borderLeftColor: "var(--foreground)" },
  ".cm-placeholder": { color: "var(--muted-foreground)" },
});

interface MarkdownEditorProps {
  /** Văn bản ban đầu; editor tự giữ sau khi gắn và báo thay đổi qua onChange. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Cmd/Ctrl+Enter gửi toàn văn bản đọc trực tiếp từ editor, tránh state cập nhật chậm. */
  onSubmit?: (value: string) => void;
  /** Escape。 */
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Editor Markdown CodeMirror 6 với tô cú pháp trong chế độ nguồn.
 * Editor không điều khiển bằng state; callback ref chuyển tới closure mới nhất để EditorView
 * chỉ tạo một lần, giữ vị trí con trỏ và lịch sử hoàn tác qua các lần render.
 */
export function MarkdownEditor({
  defaultValue = "",
  onChange,
  onSubmit,
  onCancel,
  placeholder,
  autoFocus,
  className,
}: MarkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const callbacksRef = useRef({ onChange, onSubmit, onCancel });

  // Đồng bộ callback mới sau render vì React Compiler không cho ghi ref trong lúc render.
  useEffect(() => {
    callbacksRef.current = { onChange, onSubmit, onCancel };
  });

  // Chỉ tạo view khi gắn; thay defaultValue, autoFocus hoặc placeholder không tạo lại view.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = new EditorView({
      state: EditorState.create({
        doc: defaultValue,
        extensions: [
          Prec.high(
            keymap.of([
              {
                key: "Mod-Enter",
                run: (v) => {
                  callbacksRef.current.onSubmit?.(v.state.doc.toString());
                  return true;
                },
              },
              {
                key: "Escape",
                run: () => {
                  callbacksRef.current.onCancel?.();
                  return true;
                },
              },
            ]),
          ),
          history(),
          markdown({ base: markdownLanguage }),
          // markdownKeymap tự nối danh sách hoặc trích dẫn bằng Enter và xóa ký hiệu bằng Backspace.
          keymap.of([...markdownKeymap, ...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          syntaxHighlighting(markdownHighlight),
          ...(placeholder ? [cmPlaceholder(placeholder)] : []),
          baseTheme,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) callbacksRef.current.onChange?.(u.state.doc.toString());
          }),
        ],
      }),
      parent: host,
    });
    if (autoFocus) view.focus();
    return () => view.destroy();
    // Không đưa tham số khởi tạo vào dependency để thay đổi chúng không phá view đang chỉnh sửa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={hostRef}
      // Khung ngoài giống Textarea với viền, bo góc và vòng focus; phông kế thừa từ khung.
      className={cn(
        "min-h-0 overflow-hidden rounded-lg border border-input bg-transparent font-sans transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
        className,
      )}
    />
  );
}
