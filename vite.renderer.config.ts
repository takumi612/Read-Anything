import { defineConfig } from "vite";
import path from "node:path";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import babel from "@rolldown/plugin-babel";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    // Tài nguyên giải mã PDF.js; URL trong pdf-book.ts trỏ tới các thư mục này ở gốc output.
    // cmaps là bảng mã font CID; standard_fonts là 14 font chuẩn; wasm giải mã ảnh JBIG2/JPX.
    // Dev server cũng phục vụ qua cùng URL để hai môi trường nhất quán.
    // Cần stripBase vì build giữ cấu trúc thư mục src, còn middleware dev trải phẳng;
    // thiếu tùy chọn này sẽ tạo URL cmaps/node_modules/... và gây 404 ở bản đóng gói.
    viteStaticCopy({
      targets: [
        { src: "node_modules/pdfjs-dist/cmaps/*", dest: "cmaps", rename: { stripBase: true } },
        {
          src: "node_modules/pdfjs-dist/standard_fonts/*",
          dest: "standard_fonts",
          rename: { stripBase: true },
        },
        { src: "node_modules/pdfjs-dist/wasm/*", dest: "wasm", rename: { stripBase: true } },
      ],
    }),
  ],
  resolve: {
    // The React Compiler runtime reads React's active hook dispatcher. Keep the app and
    // react-dom on one resolved copy, especially when the workspace is reached through a symlink.
    dedupe: ["react", "react-dom"],
    alias: [
      { find: "@shared", replacement: path.resolve(__dirname, "src/shared") },
      { find: "@renderer", replacement: path.resolve(__dirname, "src/renderer") },
      // Alias trỏ thẳng vào source thay vì symlink trong node_modules.
      // Qua symlink, Vite xem đây là dependency, thêm `?v=<browserHash>` và cache immutable.
      // Hash chỉ đổi theo config/lockfile, không đổi khi sửa source của package; renderer
      // vì thế có thể dùng bản cũ và báo thiếu export vừa thêm.
      // Alias biến nó thành module source bình thường để HMR cập nhật đúng.
      {
        find: "@marginalia/virtual-docs",
        replacement: path.resolve(__dirname, "packages/virtual-docs/src/index.ts"),
      },
    ],
  },
  // Không tối ưu sẵn các package source của workspace qua symlink.
  // Vite cache .vite/deps theo lockfile/config, bỏ qua thời gian sửa source của symlink;
  // exclude để Vite phục vụ source trực tiếp và nhận thay đổi ngay.
  // epub-parser đã build thành ESM tự chứa tại dist/index.js nên không cần include CJS phụ thuộc.
  // Vẫn exclude để tránh cache cũ của symlink dist. Nếu dist vẫn bị cache, xóa
  // node_modules/.vite rồi khởi động lại; exclude không ngăn cache immutable của URL.
  // virtual-docs dùng alias vào source; pdf-parser chỉ dùng ở main process.
  optimizeDeps: {
    exclude: ["@marginalia/epub-parser"],
  },
});
