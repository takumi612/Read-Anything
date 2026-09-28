import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BookSummaryDto } from "@shared/library";
import { useDragGuard } from "@renderer/lib/use-drag-guard";
import { BookCover } from "./BookCover";

/**
 * Thẻ sách có thể sắp xếp bằng useSortable bọc BookCover; listener gắn trên li.
 * PointerSensor cần di chuyển 8px mới kích hoạt nên nhấn thường vẫn mở sách.
 * Chỉ nút chuột chính kéo được, menu chuột phải không bị ảnh hưởng.
 * transform và transition được tính lúc chạy nên dùng inline style.
 *
 * useDragGuard bọc listener vì dialog sửa/xóa của BookCover nằm trong React Portal.
 * Sự kiện từ dialog nổi bọt về li trong cây React dù DOM nằm chỗ khác; kiểm tra DOM
 * ngăn thao tác trong dialog kéo nhầm sách mà vẫn giữ sự kiện của lớp nổi.
 */
export function SortableBook({
  book,
  onOpen,
  onDelete,
  onClearData,
  onUpdate,
}: {
  book: BookSummaryDto;
  onOpen: () => void;
  onDelete: () => void;
  onClearData: () => void;
  onUpdate: (patch: { title: string; author: string | null }) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: book.id,
  });
  const guard = useDragGuard(setNodeRef, listeners);
  return (
    <li
      ref={guard.setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-40" : undefined}
      {...attributes}
      {...guard.listeners}
    >
      <BookCover
        book={book}
        onOpen={onOpen}
        onDelete={onDelete}
        onClearData={onClearData}
        onUpdate={onUpdate}
      />
    </li>
  );
}
