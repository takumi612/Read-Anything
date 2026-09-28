import type { AiProviderApiType, UpsertProviderInput } from "@shared/providers";
import { DEFAULT_BACKGROUND_CONCURRENCY, DEFAULT_STEP_LIMIT } from "@shared/preferences";

export interface ProviderFormState {
  id: string | undefined; // Có id là sửa, thiếu id là tạo mới.
  type: AiProviderApiType;
  label: string;
  baseUrl: string;
  apiKey: string; // Rỗng nghĩa là không đổi khóa khi sửa hoặc chưa có khóa khi tạo.
  models: string[];
}

/** Gộp hai danh sách, bỏ trùng và giữ thứ tự. */
export function mergeModels(existing: string[], add: string[]): string[] {
  const seen = new Set(existing);
  const out = [...existing];
  for (const m of add) {
    if (!seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
}

/** Tùy chọn model gồm danh sách của provider và model đã lưu nếu nó chưa có trong danh sách. */
export function providerModelOptions(providerModels: string[], current: string | null): string[] {
  if (current && !providerModels.includes(current)) return [...providerModels, current];
  return [...providerModels];
}

/** Giới hạn stepLimit từ ô số thành số nguyên [1,99], giá trị không hữu hạn về mặc định.
 *  Giá trị 0 không giới hạn do checkbox tạo trực tiếp và không qua hàm này. */
export function clampStepLimit(raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_STEP_LIMIT;
  return Math.min(99, Math.max(1, Math.trunc(raw)));
}

/** Giới hạn backgroundConcurrency từ ô số thành số nguyên [1,10], giá trị không hữu hạn về mặc định. */
export function clampBackgroundConcurrency(raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_BACKGROUND_CONCURRENCY;
  return Math.min(10, Math.max(1, Math.trunc(raw)));
}

/** Đổi form thành tham số upsert IPC: baseUrl/label rỗng thành null, apiKey rỗng thì bỏ qua, thiếu id là tạo mới. */
export function providerFormToUpsertInput(f: ProviderFormState): UpsertProviderInput {
  const out: UpsertProviderInput = {
    type: f.type,
    label: f.label.trim() ? f.label.trim() : null,
    baseUrl: f.baseUrl.trim() ? f.baseUrl.trim() : null,
    models: f.models,
  };
  if (f.id) out.id = f.id;
  if (f.apiKey.trim()) out.apiKey = f.apiKey.trim();
  return out;
}
