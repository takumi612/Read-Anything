import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { qk } from "@renderer/query/keys";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { Button } from "@renderer/components/ui/button";
import { Checkbox } from "@renderer/components/ui/checkbox";
import { Input } from "@renderer/components/ui/input";
import { Textarea } from "@renderer/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@renderer/components/ui/alert-dialog";

export function MemorySettings() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const memoryEnabled = usePrefsStore((s) => s.memoryEnabled);
  const setMemoryEnabled = usePrefsStore((s) => s.setMemoryEnabled);
  const memoryAutoConsolidate = usePrefsStore((s) => s.memoryAutoConsolidate);
  const setMemoryAutoConsolidate = usePrefsStore((s) => s.setMemoryAutoConsolidate);

  const memories = useQuery({
    queryKey: qk.memories,
    queryFn: () => window.api.memories.list(),
    // Công cụ AI ghi bộ nhớ trong main process, không đi qua mutation của renderer.
    // Với staleTime vô hạn, bảng có thể giữ danh sách cũ sau khi chat đã tạo bộ nhớ mới.
    // staleTime:0 buộc tải lại mỗi lần mở bảng, như truy vấn hội thoại.
    staleTime: 0,
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBody, setEditBody] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; title: string; description: string; body: string }) =>
      window.api.memories.update(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.memories });
      setEditingId(null);
    },
    onError: () => {
      toast.error(t("settings.memory.updateFailed", "Không thể lưu ghi nhớ. Hãy thử lại."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => window.api.memories.delete({ id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.memories });
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error(t("settings.memory.deleteFailed", "Không thể xóa ghi nhớ. Hãy thử lại."));
    },
  });

  const startEdit = (mem: { id: string; title: string; description: string; body: string }) => {
    setEditingId(mem.id);
    setEditTitle(mem.title);
    setEditDescription(mem.description);
    setEditBody(mem.body);
    setExpandedId(mem.id);
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      title: editTitle.trim(),
      description: editDescription.trim(),
      body: editBody.trim(),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setExpandedId(null);
  };

  return (
    <>
      <section className="space-y-4">
        <h2 className="font-serif text-lg">{t("settings.memory", "Bộ nhớ")}</h2>

        {/* Công tắc chính. */}
        <div className="flex items-start justify-between gap-3">
          <label htmlFor="memory-enabled" className="min-w-0 cursor-pointer">
            <span className="block text-sm font-medium">
              {t("settings.memory.enabled", "Bật bộ nhớ AI")}
            </span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
              {t(
                "settings.memory.enabledDesc",
                "AI tự ghi nhớ thông tin quan trọng như tùy chọn, thói quen đọc và ngữ cảnh cá nhân để dùng trong các cuộc trò chuyện sau. Khi tắt, ứng dụng không ghi thêm nhưng vẫn giữ các mục đã có.",
              )}
            </span>
          </label>
          <Checkbox
            id="memory-enabled"
            checked={memoryEnabled}
            onCheckedChange={setMemoryEnabled}
            className="mt-0.5"
          />
        </div>

        {/* Công tắc tự sắp xếp ở nền, phụ thuộc công tắc chính. */}
        <div className="flex items-start justify-between gap-3">
          <label htmlFor="memory-auto-consolidate" className="min-w-0 cursor-pointer">
            <span className="block text-sm font-medium">
              {t("settings.memory.autoConsolidate", "Tự động sắp xếp bộ nhớ trong nền")}
            </span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
              {t(
                "settings.memory.autoConsolidateDesc",
                "Sau vài lượt trò chuyện, Lia sẽ bổ sung điều còn thiếu và sắp xếp lại các ghi nhớ trong nền. Tính năng này gọi model thêm và mặc định tắt.",
              )}
            </span>
          </label>
          <Checkbox
            id="memory-auto-consolidate"
            checked={memoryAutoConsolidate}
            onCheckedChange={setMemoryAutoConsolidate}
            disabled={!memoryEnabled}
            className="mt-0.5"
          />
        </div>

        {/* Danh sách bộ nhớ. */}
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{t("settings.memory.list", "Ghi nhớ đã lưu")}</h3>

          {memories.isError && (
            <p className="text-sm text-destructive">
              {t("settings.memory.loadFailed", "Không thể tải ghi nhớ")}
            </p>
          )}

          {memories.data?.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t(
                "settings.memory.empty",
                "Chưa có ghi nhớ. AI sẽ tự lưu thông tin hữu ích trong lúc trò chuyện. Bạn chỉ cần sử dụng ứng dụng như bình thường.",
              )}
            </p>
          )}

          {memories.data?.map((mem) => (
            <div key={mem.id} className="rounded-lg border border-border">
              {editingId === mem.id ? (
                /* Chế độ chỉnh sửa. */
                <div className="space-y-2 p-3">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder={t("settings.memory.titlePlaceholder", "Tiêu đề")}
                  />
                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder={t("settings.memory.descPlaceholder", "Mô tả ngắn")}
                  />
                  <Textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    placeholder={t("settings.memory.bodyPlaceholder", "Nội dung ghi nhớ")}
                    className="min-h-24"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={cancelEdit}>
                      {t("settings.memory.cancel", "Hủy")}
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveEdit}
                      disabled={
                        updateMutation.isPending ||
                        !editTitle.trim() ||
                        !editDescription.trim() ||
                        !editBody.trim()
                      }
                    >
                      {t("settings.memory.save", "Lưu")}
                    </Button>
                  </div>
                </div>
              ) : (
                /* Chế độ hiển thị. */
                <div>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-start"
                      onClick={() => setExpandedId(expandedId === mem.id ? null : mem.id)}
                    >
                      {expandedId === mem.id ? (
                        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate text-sm font-medium">{mem.title}</span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => startEdit(mem)}
                        aria-label={t("settings.memory.edit", "Sửa")}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(mem.id)}
                        aria-label={t("settings.memory.delete", "Xóa")}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {expandedId === mem.id && (
                    <div className="border-t border-border px-3 pb-3 pt-2 space-y-1.5">
                      {mem.description && (
                        <p className="text-[11px] text-muted-foreground">{mem.description}</p>
                      )}
                      <p className="whitespace-pre-wrap text-sm">{mem.body}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t("settings.memory.updatedAt", "Cập nhật {{when}}", {
                          when: new Date(mem.updatedAt).toLocaleString(),
                        })}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Xác nhận xóa. */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>{t("settings.memory.deleteTitle", "Xóa ghi nhớ?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("settings.memory.deleteDesc", "Bạn không thể hoàn tác thao tác này. Ghi nhớ sẽ bị xóa vĩnh viễn.")}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("settings.memory.cancel", "Hủy")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget);
              }}
            >
              {t("settings.memory.delete", "Xóa")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
