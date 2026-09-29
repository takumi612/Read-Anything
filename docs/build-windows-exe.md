# Chuyển mã nguồn thành EXE

`package` tạo ứng dụng có thể chạy trực tiếp trong một thư mục. `make:win` tạo trình cài đặt Windows từ bản build. Cả hai lệnh phải chạy trong thư mục có `package.json` của Read-Anything.

<a id="before"></a>

## 1. Chuẩn bị bản build

Nếu chưa cài dependency, làm theo [hướng dẫn chạy từ source](run-from-source.md#install). Đóng cửa sổ Read-Anything đang mở trước khi ghi đè thư mục `out`; Windows có thể giữ `app.asar` hoặc EXE.

    corepack pnpm --version
    corepack pnpm typecheck

`typecheck` kiểm tra mã TypeScript và build parser EPUB. Nếu muốn phát hành cho người khác, xem thêm `corepack pnpm test` và `corepack pnpm lint`. Đây là kiểm tra source; kiểm tra EXE chạy thật nằm ở bước 3.

<a id="package"></a>

## 2. Tạo thư mục ứng dụng chạy trực tiếp

    corepack pnpm package

Electron Forge dùng cấu hình [`forge.config.ts`](../forge.config.ts). Vite build main, preload và renderer; Forge tạo `out/Read-Anything-win32-x64/`. Chạy bản mới từ đúng đường dẫn:

    .\out\Read-Anything-win32-x64\Read-Anything.exe

Tệp `Read-Anything.exe` cần các tệp cạnh nó trong cùng thư mục, đặc biệt `resources/app.asar`, native module, migrations và từ điển. Sao chép riêng mỗi EXE sang chỗ khác sẽ không tạo bản chạy đầy đủ. Sau mỗi lần sửa source, chạy lại `package` để cập nhật thư mục này.

<a id="e2e"></a>

## 3. Kiểm tra chính bản EXE đã đóng gói

Kịch bản E2E cần một tệp PDF hoặc EPUB có sẵn trên máy; repository không kèm sách mẫu. Chạy script với đường dẫn của bạn:

    node scripts/e2e-packaged-pdf.mjs --sample="C:\Books\sample.pdf"

Mặc định script kiểm tra EXE ở `out\Read-Anything-win32-x64\Read-Anything.exe`. Nếu muốn kiểm tra một bản EXE khác, thêm tùy chọn `--exe`:

    node scripts/e2e-packaged-pdf.mjs --sample="C:\Books\sample.pdf" --exe="C:\Apps\Read-Anything.exe"

Muốn build trước khi kiểm tra, chạy `corepack pnpm package`, rồi chạy lệnh E2E ở trên. Script dùng profile thử nghiệm tạm, nên không thay đổi thư viện sách thường ngày. Kiểm tra các dòng `PASS` và dòng kết luận cuối. Một build thành công chưa chứng minh PDF render và các thao tác reader chạy trong EXE.

<a id="installer"></a>

## 4. Tạo trình cài đặt Windows

    corepack pnpm make:win

`make:win` gọi `electron-forge make --platform=win32`. Forge dùng MakerSquirrel trong `forge.config.ts`; tệp cài đặt có dạng:

    out\make\squirrel.windows\x64\*Setup.exe

Phiên bản `0.1.0` được lấy từ `package.json`; khi đổi phiên bản, tên tệp đổi theo. Mở Setup để cài, sau đó chạy từ Start Menu. Nếu bạn chỉ cần tự thử code mới, bước 2 đã đủ; Setup có ích khi muốn cài vào Windows. Đặt Read-Anything làm trình đọc PDF mặc định qua Windows Settings → Apps → Default apps → `.pdf`.

<a id="contents"></a>

## Forge đưa gì vào bản đóng gói

| Nguồn | Đích hoặc mục đích |
|----|----|
| `src/main.ts`, `src/preload.ts`, `src/renderer.tsx` | Vite build thành main, preload và renderer trong `.vite/`. |
| `src/main/db/migrations/` | `resources/migrations/`; main đọc khi mở DB bản package. |
| `assets/dictionary/` | `resources/dictionary/`; ứng dụng cài bản DB từ điển địa phương vào userData. |
| `better-sqlite3`, `pdfjs-dist`, `@napi-rs/canvas` | Được giữ như runtime dependencies; native `.node` được giải nén ngoài ASAR. |
| pdfjs CMaps, standard fonts và WASM | `vite.renderer.config.ts` copy vào đầu ra renderer để đọc PDF đặc biệt. |
| `assets/icons/icon.ico` | Biểu tượng Windows do Forge chọn từ basename `assets/icons/icon`. |

Ứng dụng đóng gói có `resources/app.asar`. Khi chạy, main phục vụ renderer qua loopback `127.0.0.1` bằng [`renderer-server.ts`](../src/main/app/renderer-server.ts). Việc này cho worker và tài nguyên PDF dùng URL ổn định trong Electron.

<a id="locked"></a>

## Khi Windows từ chối ghi đè `app.asar`

1.  Đóng Read-Anything, kể cả cửa sổ bản cài đặt và bản trong `out`. Kiểm tra Task Manager không còn tiến trình `Read-Anything.exe` của chính ứng dụng.
2.  Chạy lại `corepack pnpm package` tại project root. Không cần xóa source, database hoặc thư mục sách người dùng.
3.  Nếu công cụ đang chạy trong môi trường chỉ đọc/giới hạn quyền, build vào vị trí được phép ghi rồi chép toàn bộ thư mục package về `out/Read-Anything-win32-x64`. Đảm bảo đã đóng ứng dụng trước khi chép.
4.  Chạy EXE ở `out` và E2E chỉ rõ `--exe` nếu có nhiều bản. Kiểm tra thời gian sửa đổi của `resources/app.asar`; EXE riêng lẻ có thể giữ nguyên dù mã mới đã nằm trong ASAR.

Lỗi `EPERM` nêu đường dẫn bị chặn, nhưng tự nó chưa chỉ ra nguyên nhân. Tiến trình giữ file và quyền ghi thư mục đều cần kiểm tra.

<a id="release"></a>

## Trước khi đưa cho người khác

Kiểm tra Setup trên máy sạch hoặc user profile mới, đặc biệt migration, nhập sách, hiển thị PDF, từ điển offline và quyền đọc tệp. Trình cài đặt Windows trong repo là Squirrel; việc build không đồng nghĩa với ký mã hoặc vượt cảnh báo của Windows. Phiên bản và giấy phép nằm trong [`package.json`](../package.json) và [`LICENSE`](../LICENSE).
