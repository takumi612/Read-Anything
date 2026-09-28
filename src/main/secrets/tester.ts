import type { ResolveModelParams } from "@main/ai/model-factory";
import type { TestResult } from "@shared/providers";

/** Kiểm tra kết nối dùng cùng tham số tạo model rồi gửi một yêu cầu tối thiểu. */
export type ProviderTestParams = ResolveModelParams;

/** Giao diện kiểm tra provider; bản thật gọi generateText, kiểm thử truyền fake. */
export interface ProviderTester {
  test(params: ProviderTestParams): Promise<TestResult>;
}
