import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { BookSummaryDto, UpdateBookInput } from "@shared/library";
import { Button } from "@renderer/components/ui/button";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { qk } from "@renderer/query/keys";
import { useNavigationStore } from "@renderer/store/navigation-store";
import { useChatStore } from "@renderer/store/chat-store";
import { usePdfTabsStore } from "@renderer/store/pdf-tabs-store";
import { fileNameOf, pickBookFiles } from "./book-drop";
import { useEpubDrop } from "./use-epub-drop";
import { DropOverlay } from "./DropOverlay";
import { BookCover } from "./BookCover";
import { RecentlyReadShelf } from "./RecentlyReadShelf";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { SortableBook } from "./SortableBook";
import { OnboardingCard } from "./OnboardingCard";

interface ImportItem {
  filePath: string;
  name: string;
}

export function LibraryView() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const openBook = useNavigationStore((s) => s.openBook);
  const books = useQuery({
    queryKey: qk.library,
    queryFn: () => window.api.library.list(),
  });

  // Nút nhập và kéo thả dùng chung một mutation theo lô: nhập từng sách theo thứ tự, gom kết quả và lỗi.
  const importBooks = useMutation({
    mutationFn: async (items: ImportItem[]) => {
      const ok: BookSummaryDto[] = [];
      const failed: { name: string; error: string }[] = [];
      for (const it of items) {
        try {
          ok.push(await window.api.library.import({ filePath: it.filePath }));
        } catch (e) {
          failed.push({ name: it.name, error: (e as Error).message });
        }
      }
      return { ok, failed };
    },
    onSuccess: (r) => {
      if (r.ok.length > 0) void qc.invalidateQueries({ queryKey: qk.library });
    },
  });

  // Xóa sách qua IPC library:delete; main process xóa dữ liệu liên quan và bản sao tệp, rồi làm mới thư viện và hiện toast.
  const deleteBook = useMutation({
    mutationFn: (b: BookSummaryDto) => window.api.library.delete({ bookId: b.id }),
    onSuccess: (_r, b) => {
      usePdfTabsStore.getState().close(b.id);
      void qc.invalidateQueries({ queryKey: qk.library });
      // Khóa shelf ["recently-read"] không chứa bookId nên điều kiện xóa cache bên dưới không chạm tới nó.
      // Nếu sách vừa xóa còn trên shelf, phải làm mới ngay; staleTime:0 chỉ có tác dụng khi gắn lại.
      void qc.invalidateQueries({ queryKey: qk.recentlyRead });
      // Xóa toàn bộ cache theo sách: book, chapters, toc, bytes, progress, annotations, conversations.
      // Dùng remove vì sách không còn để refetch. Nếu nhập lại cùng tệp thì id theo hash vẫn như cũ;
      // cache cũ với staleTime vô hạn có thể khiến giao diện hiển thị dữ liệu đã xóa.
      qc.removeQueries({ predicate: (q) => q.queryKey.includes(b.id) });
      toast.success(t("library.deleted", "Đã xóa “{{title}}”", { title: b.title ?? b.id }));
    },
    onError: (e, b) => {
      // Hiển thị nguyên lỗi từ main process và giữ toast cho tới khi người dùng đóng.
      toast.error(
        t("library.deleteFailed", "Không thể xóa {{title}}: {{error}}", {
          title: b.title ?? b.id,
          error: (e as Error).message,
        }),
        { closeButton: true, duration: Infinity },
      );
    },
  });
  const clearPdfData = useMutation({
    mutationFn: (b: BookSummaryDto) => window.api.library.clearPdfData({ bookId: b.id }),
    onSuccess: (conversationIds, b) => {
      qc.removeQueries({ predicate: (query) => query.queryKey.includes(b.id) });
      for (const id of conversationIds) qc.removeQueries({ queryKey: qk.messages(id) });
      useNavigationStore.getState().clearPdfBookState(b.id);
      useChatStore.getState().clearBookConversation(b.id);
      void qc.invalidateQueries({ queryKey: qk.recentlyRead });
      void qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success(t("library.clearPdfData.success", { title: b.title ?? b.id }));
    },
    onError: (error, b) => {
      toast.error(
        t("library.clearPdfData.error", {
          title: b.title ?? b.id,
          error: error instanceof Error ? error.message : String(error),
        }),
        { closeButton: true, duration: Infinity },
      );
    },
  });

  // Sửa tên hoặc tác giả: thẻ sách cập nhật ngay khi thành công; thất bại hiển thị lỗi từ main process.
  // Làm mới cả qk.book(bookId) vì breadcrumb của trình đọc dùng khóa này với staleTime vô hạn.
  const updateBook = useMutation({
    mutationFn: (input: UpdateBookInput) => window.api.library.update(input),
    onSuccess: (_r, input) => {
      void qc.invalidateQueries({ queryKey: qk.library });
      void qc.invalidateQueries({ queryKey: qk.book(input.bookId) });
    },
    onError: (e, input) => {
      toast.error(
        t("library.updateFailed", "Không thể lưu {{title}}: {{error}}", {
          title: input.title,
          error: (e as Error).message,
        }),
        { closeButton: true, duration: Infinity },
      );
    },
  });

  // Kéo sắp xếp kích hoạt sau 8px để phân biệt với nhấn mở sách. Cập nhật cache trước rồi lưu thứ tự;
  // nếu thất bại, làm mới thứ tự từ nguồn và hiển thị lỗi thật.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) => window.api.library.reorder({ orderedIds }),
    onError: (e) => {
      void qc.invalidateQueries({ queryKey: qk.library });
      toast.error(
        t("library.reorderFailed", "Không thể lưu thứ tự: {{error}}", {
          error: (e as Error).message,
        }),
        { closeButton: true, duration: Infinity },
      );
    },
  });

  const onDragStart = (e: DragStartEvent) => setDraggingId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const list = books.data;
    if (!list) return;
    const from = list.findIndex((b) => b.id === active.id);
    const to = list.findIndex((b) => b.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(list, from, to);
    qc.setQueryData(qk.library, next); // Cập nhật UI trước khi lưu.
    reorder.mutate(next.map((b) => b.id));
  };

  const draggingBook = draggingId ? books.data?.find((b) => b.id === draggingId) : undefined;

  // Toast báo ngay sách mới, sách đã có, tệp không hỗ trợ hoặc lỗi thật từ main process.
  const runImport = async (items: ImportItem[], ignored: string[]) => {
    if (items.length === 0 && ignored.length === 0) return;
    const existing = new Set(books.data?.map((b) => b.id) ?? []);
    const r = items.length > 0 ? await importBooks.mutateAsync(items) : { ok: [], failed: [] };
    const added = r.ok.filter((b) => !existing.has(b.id)).length;
    const duplicate = r.ok.length - added;

    if (added > 0) toast.success(t("library.imported", "Đã nhập {{count}} cuốn sách", { count: added }));
    if (duplicate > 0) {
      toast.info(t("library.duplicate", "Đã có {{count}} cuốn sách trong thư viện", { count: duplicate }));
    }
    if (ignored.length > 0) {
      // Dấu phân cách danh sách phụ thuộc ngôn ngữ giao diện, không ghi cố định.
      const names = new Intl.ListFormat(i18n.language, {
        style: "narrow",
        type: "unit",
      }).format(ignored);
      toast.warning(
        t("library.ignored", "Đã bỏ qua {{count}} tệp không hỗ trợ: {{names}}", {
          count: ignored.length,
          names,
        }),
      );
    }
    for (const f of r.failed) {
      toast.error(
        t("library.importFailed", "Không thể nhập {{name}}: {{error}}", {
          name: f.name,
          error: f.error,
        }),
        { closeButton: true, duration: Infinity },
      );
    }
  };

  // Khi thả tệp, lọc định dạng hỗ trợ, lấy đường dẫn rồi nhập theo lô; báo tệp bị bỏ qua qua toast.
  const onFiles = (files: File[]) => {
    const { books, ignored } = pickBookFiles(files);
    const items = books.map((f) => ({
      filePath: window.api.library.pathForFile(f),
      name: f.name,
    }));
    void runImport(
      items,
      ignored.map((f) => f.name),
    );
  };

  // Nút nhập dùng hộp thoại hệ điều hành lấy một đường dẫn rồi gửi qua cùng kênh nhập theo lô.
  const onPick = async () => {
    const filePath = await window.api.library.pickBook();
    if (!filePath) return;
    void runImport([{ filePath, name: fileNameOf(filePath) }], []);
  };

  const { isDragging, isOverZone, rootHandlers, zoneHandlers } = useEpubDrop(onFiles);

  return (
    <div {...rootHandlers} className="flex h-full flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center justify-between px-6">
        <span className="text-sm text-muted-foreground">
          {t("library.count", "{{count}} cuốn sách", { count: books.data?.length ?? 0 })}
        </span>
        <Button onClick={() => void onPick()} disabled={importBooks.isPending}>
          <FolderOpen />
          {importBooks.isPending
            ? t("library.importPending", "Đang nhập…")
            : t("library.import", "Nhập sách")}
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <main className="p-6">
          <OnboardingCard />
          <RecentlyReadShelf onOpen={openBook} />
          {books.isPending && (
            <p className="text-sm text-muted-foreground">{t("library.loading", "Đang tải thư viện…")}</p>
          )}
          {books.isError && (
            <p className="text-sm text-destructive">{t("library.loadError", "Không thể tải thư viện")}</p>
          )}
          {books.data?.length === 0 && (
            <div className="mt-20 text-center text-muted-foreground">
              <BookOpen className="mx-auto mb-3 size-10 opacity-40" />
              <p className="text-sm">
                {t("library.empty", "Thư viện đang trống. Nhấn Nhập sách hoặc kéo tệp .epub hay .pdf vào cửa sổ để bắt đầu.")}
              </p>
            </div>
          )}
          <DndContext
            sensors={sensors}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setDraggingId(null)}
          >
            <SortableContext
              items={books.data?.map((b) => b.id) ?? []}
              strategy={rectSortingStrategy}
            >
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-5">
                {books.data?.map((b) => (
                  <SortableBook
                    key={b.id}
                    book={b}
                    onOpen={() => openBook(b.id)}
                    onDelete={() => deleteBook.mutate(b)}
                    onClearData={() => clearPdfData.mutate(b)}
                    onUpdate={(patch) => updateBook.mutate({ bookId: b.id, ...patch })}
                  />
                ))}
              </ul>
            </SortableContext>
            <DragOverlay>
              {draggingBook ? (
                <BookCover
                  book={draggingBook}
                  onOpen={() => {}}
                  onDelete={() => {}}
                  onClearData={() => {}}
                  onUpdate={() => {}}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </main>
      </ScrollArea>

      {isDragging && <DropOverlay active={isOverZone} zoneHandlers={zoneHandlers} />}
    </div>
  );
}
