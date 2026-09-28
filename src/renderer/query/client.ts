import { QueryClient } from "@tanstack/react-query";

/**
 * Cấu hình cho IPC cục bộ: không làm mới khi focus, staleTime dài cho dữ liệu ổn định và không thử lại khi lỗi.
 * networkMode "always" giữ query/mutation với DB cục bộ hoạt động khi mất mạng;
 * chế độ "online" mặc định sẽ tạm dừng cả đọc và ghi. Yêu cầu mạng thật nằm ở main process
 * và lỗi được chuyển về từ đó.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: Number.POSITIVE_INFINITY,
      retry: false,
      networkMode: "always",
    },
    mutations: {
      networkMode: "always",
    },
  },
});
