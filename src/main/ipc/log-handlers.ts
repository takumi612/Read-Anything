import { C } from "@shared/ipc";
import { appService } from "@main/app";
import { writeRendererLog } from "@main/logger/logger-service"; // Lối vào riêng cho IPC.
import { bind, register, type Binding } from "@main/ipc/registry";

export const logBindings: Binding[] = [
  bind(C.logWrite, (input) => writeRendererLog(input.level, input.module, input.message)),
  bind(C.appOpenLogsDir, () => appService.openFolder(appService.getPath("logsDir"))),
];

export function registerLogHandlers(): void {
  register(logBindings);
}
