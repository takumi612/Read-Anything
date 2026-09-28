import path from "node:path";

import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@marginalia/virtual-docs": path.resolve(__dirname, "../virtual-docs/src/index.ts"),
    },
    // virtual-docs được thêm bằng alias tới mã nguồn; import "react" của nó sẽ phân giải ngược lên node_modules ở thư mục gốc.
    // ui-prototype có bản node_modules riêng; hai bản React làm hooks lỗi và có thể khiến màn hình trắng.
    // dedupe buộc toàn trang chỉ dùng một bản react/react-dom.
    dedupe: ["react", "react-dom"],
  },
  plugins: [
    devtools(),
    tailwindcss(),
    // Bản mẫu chỉ có giao diện frontend, không cần SSR: dùng chế độ SPA để nội dung được render ở client và tránh lệch hydration.
    tanstackStart({ spa: { enabled: true } }),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});

export default config;
