import type { ReadingReportProgressStep, ReadingReportState } from "@shared/reading-sessions";

export interface ReportViewModel {
  content: string | null;
  busy: boolean;
  canGenerate: boolean;
  canEdit: boolean;
  canCancel: boolean;
  error: "generation-failed" | "regeneration-failed" | null;
  /** Dòng thời gian công cụ của lần tạo này; rỗng ngoài trạng thái đang tạo hoặc lỗi. */
  progress: readonly ReadingReportProgressStep[];
  /** Thời điểm bắt đầu theo epoch ms; chỉ khác null khi đang tạo để renderer tự đếm thời gian. */
  startedAt: number | null;
}

export function reportViewModel(state: ReadingReportState): ReportViewModel {
  switch (state.status) {
    case "empty":
      return {
        content: null,
        busy: false,
        canGenerate: true,
        canEdit: true,
        canCancel: false,
        error: null,
        progress: [],
        startedAt: null,
      };
    case "generating":
      return {
        content: null,
        busy: true,
        canGenerate: false,
        canEdit: false,
        canCancel: true,
        error: null,
        progress: state.progress,
        startedAt: state.startedAt,
      };
    case "generation-failed":
      return {
        content: null,
        busy: false,
        canGenerate: true,
        canEdit: true,
        canCancel: false,
        error: "generation-failed",
        progress: state.progress,
        startedAt: null,
      };
    case "ready":
      return {
        content: state.content,
        busy: false,
        canGenerate: true,
        canEdit: true,
        canCancel: false,
        error: null,
        progress: [],
        startedAt: null,
      };
    case "regenerating":
      return {
        content: state.content,
        busy: true,
        canGenerate: false,
        canEdit: false,
        canCancel: true,
        error: null,
        progress: state.progress,
        startedAt: state.startedAt,
      };
    case "regeneration-failed":
      return {
        content: state.content,
        busy: false,
        canGenerate: true,
        canEdit: true,
        canCancel: false,
        error: "regeneration-failed",
        progress: state.progress,
        startedAt: null,
      };
    default:
      return assertNever(state);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected report state: ${JSON.stringify(value)}`);
}
