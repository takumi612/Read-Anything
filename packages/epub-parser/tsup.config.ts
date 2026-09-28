import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  // Cố ý không clean: khi `pnpm dev` đang chạy, lệnh `pnpm test` hoặc `pnpm typecheck` ở terminal khác
  // cũng chạy `build:packages` trước. Clean sẽ làm dist biến mất khoảng 40 ms; nếu Vite dev server đồng thời
  // dựng lại bundle main (cả hai thường được kích hoạt khi lưu tệp trong src/main), nó có thể báo
  // `Rolldown failed to resolve import "@marginalia/epub-parser"` và làm gián đoạn hot reload.
  // Ghi đè là thao tác nguyên tử nên không clean vẫn luôn giữ được đầu ra hoàn chỉnh. Entry chỉ có src/index.ts,
  // tên tệp đầu ra cố định và không để lại tệp cũ; nếu cần dọn, xóa dist trực tiếp.
  clean: false,
  // Nhúng toàn bộ dependency lúc chạy để dist tự chứa, không có import bên ngoài; nhờ vậy có thể bỏ danh sách
  // vite optimizeDeps.include ở renderer.
  noExternal: ["node-html-parser", "fflate", "fast-xml-parser"],
  esbuildOptions(options) {
    // Trỏ fflate sang bản browser. Điều kiện export "node" của fflate (tsup mặc định dùng platform=node)
    // có `import { createRequire } from "module"` ở cấp cao nhất cùng `require("worker_threads")`. Nếu nhúng
    // vào dist dùng chung cho main (Node) và renderer, renderer sẽ lỗi ngay khi chạy: Vite dev phục vụ dist
    // trực tiếp mà không phân giải lại điều kiện, trình duyệt không dùng được createRequire và toàn màn hình trắng.
    // Bản browser không có mã cấp cao nhất chỉ dành cho Node; các API đồng bộ (unzipSync/strFromU8/strToU8/zipSync)
    // có cùng hành vi và dùng được cả trong Node. dist-browser-safe.test.ts bảo vệ điều kiện này.
    //
    // ⚠️ Giới hạn có chủ đích: dist này chỉ được dùng API đồng bộ của fflate. API bất đồng bộ trong bản browser
    // phụ thuộc Worker + blob URL; main process của Electron chạy Node, không có Worker toàn cục nên sẽ lỗi.
    // EPUB hiện được phân tích ở main process; hướng tăng tốc phù hợp là chuyển toàn bộ phân tích đồng bộ sang
    // worker_thread để không chặn main, khi đó cũng không cần fflate async.
    // Nếu sau này thật sự cần API bất đồng bộ, hãy tạo hai bản build theo môi trường (điều kiện export node/browser).
    options.alias = { ...options.alias, fflate: "fflate/browser" };
  },
});
