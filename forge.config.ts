import type { ForgeConfig } from "@electron-forge/shared-types";
import type { OsxSignOptions } from "@electron/packager";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

// better-sqlite3 là module native nên vite.main.config để ngoài bundle.
// Các dependency khác được Vite gộp vào .vite; khi chạy vẫn cần package better-sqlite3 thật.
// pdfjs-dist ở main và @napi-rs/canvas cũng để ngoài bundle nên phải kèm khi đóng gói.
// Binary theo nền tảng của @napi-rs là package ngang cấp với canvas;
// quy tắc ignore phải cho phép riêng package canvas-<platform>-<arch>.
const KEEP_NODE_MODULES = [
  "better-sqlite3",
  "bindings",
  "file-uri-to-path",
  "pdfjs-dist",
  "@napi-rs/canvas",
];

// Ký lại kiểu ad-hoc trên macOS sau khi packager sửa Info.plist và tạo asar.
// Chữ ký gốc của Electron sẽ không còn hợp lệ; ký lại giúp Gatekeeper báo
// chưa xác minh nhà phát triển thay vì báo ứng dụng hỏng. Bản phân phối chính thức
// vẫn cần Developer ID và công chứng. continueOnError có lúc thiếu trong kiểu
// của packager dù runtime hỗ trợ, nên dùng kiểu giao nhau thay vì any.
const osxSign: OsxSignOptions & { continueOnError?: boolean } = {
  identity: "-", // Danh tính ký ad-hoc của codesign.
  identityValidation: false, // Không tìm "-" trong keychain.
  preAutoEntitlements: false, // Ad-hoc không có TeamID để bước này đọc.
  // Hardened runtime mặc định yêu cầu thư viện cùng Team ID với ứng dụng.
  // Chữ ký ad-hoc không có Team ID nên có thể làm Electron Framework bị từ chối khi chạy.
  optionsForFile: () => ({ hardenedRuntime: false }),
  continueOnError: false, // Báo lỗi ký thay vì lặng lẽ tạo bản build hỏng.
};

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    // Không ghi đuôi: Packager tự chọn .icns trên macOS hoặc .ico trên Windows.
    icon: "./assets/icons/icon",
    // Migration SQL và từ điển offline không đi qua Vite; từ điển có thông tin nguồn và giấy phép.
    // Bản phát hành đọc chúng từ resources; sao chép DB từ điển vào userData rồi mở chỉ đọc.
    extraResource: ["./src/main/db/migrations", "./assets/dictionary"],
    osxSign,
    // Forge Vite plugin mặc định bỏ mọi thứ ngoài .vite, gồm cả native module để ngoài bundle.
    // Hàm ignore này giữ .vite và các package native cần lúc chạy, bỏ source của dependency đã bundle.
    // Nhờ vậy asar không chứa hàng trăm package không cần thiết.
    // plugin-auto-unpack-natives chuyển tệp .node ra khỏi asar để có thể dlopen.
    ignore: (file: string): boolean => {
      if (!file) return false;
      if (file.startsWith("/.vite")) return false;
      if (file === "/node_modules") return false;
      // Giữ package canvas-<platform>-<arch> chứa binary cho nền tảng hiện tại.
      if (/^\/node_modules\/@napi-rs\/canvas-[^/]+(?:\/|$)/u.test(file)) return false;
      return !KEEP_NODE_MODULES.some(
        (pkg) =>
          file === `/node_modules/${pkg}` ||
          file.startsWith(`/node_modules/${pkg}/`) ||
          // Packager duyệt từ trên xuống; phải giữ thư mục scope cha để tới được package con.
          `/node_modules/${pkg}`.startsWith(`${file}/`),
      );
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    // macOS dùng DMG làm bản phát hành chính; ZIP dành cho dự phòng hoặc cập nhật.
    new MakerDMG({}),
    new MakerZIP({}, ["darwin"]),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: "src/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
    // Giải nén native module .node sang app.asar.unpacked để better_sqlite3.node nạp được.
    new AutoUnpackNativesPlugin({}),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      // Keep cookie encryption disabled: Chromium would initialize macOS Keychain access at startup.
      // API keys use explicit safeStorage calls instead; macOS distribution still needs a stable,
      // valid signing identity to avoid repeated Keychain prompts between updates.
      [FuseV1Options.EnableCookieEncryption]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
