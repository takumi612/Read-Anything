import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { initAppService } from "./src/main/app/app-service";
import { setApiKeyStorageForTesting } from "./src/main/secrets/api-key-storage";

// 「AppService 恒可用」全局不变量（fail-fast spec）：测试与生产同构——
// 每个测试 worker 启动即注入测试 env，消费方测试无需 mock、不存在降级分支。
initAppService({
  dataDir: mkdtempSync(path.join(tmpdir(), "marginalia-test-")), // 每 worker 独立 tmp 目录，互不冲突
  isDev: false, // 测试按 prod 级别门槛运行（debug 不记录）；logger 恒双写 console + 文件
  openFolder: async () => {},
});

// Electron's safeStorage API is unavailable in `electron --run-as-node`; use a reversible test
// adapter so repository behavior can be exercised without an OS credential store.
setApiKeyStorageForTesting({
  isEncryptionAvailable: () => true,
  getSelectedStorageBackend: () => "test",
  encryptString: (value) => Buffer.from(Buffer.from(value, "utf8").toString("base64"), "utf8"),
  decryptString: (value) => Buffer.from(value.toString("utf8"), "base64").toString("utf8"),
});
