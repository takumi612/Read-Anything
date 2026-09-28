import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@shared", replacement: path.resolve(__dirname, "src/shared") },
      { find: "@main", replacement: path.resolve(__dirname, "src/main") },
    ],
  },
  build: {
    rollupOptions: {
      // Không gộp native addon vào bundle: bindings tìm tệp .node theo __dirname.
      // Nếu Vite gộp better-sqlite3 vào .vite/build/main.js, đường dẫn gốc bị mất
      // và xuất hiện lỗi "Could not locate the bindings file".
      // Để ngoài bundle giúp require("better-sqlite3") tìm đúng trong node_modules.
      // pdfjs-dist dùng ở main process và @napi-rs/canvas cũng cần để ngoài bundle;
      // lệnh require có điều kiện của pdfjs sẽ không hoạt động đúng sau khi bị gộp.
      external: ["better-sqlite3", /^pdfjs-dist/, "@napi-rs/canvas"],
    },
  },
});
