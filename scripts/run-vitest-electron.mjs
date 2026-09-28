import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const electronPath = require("electron");
const vitestPath = fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url));

const result = spawnSync(electronPath, [vitestPath, ...process.argv.slice(2)], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
