import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type { z } from "zod";
import { validateInput } from "@main/ipc/validate";
import type { Contract } from "@shared/ipc";
import { createLogger } from "@main/logger";

const log = createLogger("ipc");

/** Binding gồm hợp đồng và hàm nghiệp vụ, chưa phụ thuộc Electron. */
export interface Binding {
  contract: Contract;
  fn: (input: never, event: IpcMainInvokeEvent) => unknown;
}

/** Ghép hợp đồng với hàm; kiểu đầu vào/đầu ra được suy từ hợp đồng. */
export function bind<S extends z.ZodType, O>(
  contract: Contract<S, O>,
  fn: (input: z.infer<S>, event: IpcMainInvokeEvent) => NoInfer<O> | Promise<NoInfer<O>>,
): Binding {
  return { contract, fn: fn as Binding["fn"] };
}

/** Nơi duy nhất đăng ký ipcMain handler, kiểm tra đầu vào bằng Zod. */
export function register(bindings: Binding[]): void {
  for (const { contract, fn } of bindings) {
    ipcMain.handle(contract.channel, async (event, raw: unknown) => {
      try {
        const input = validateInput(contract.channel, contract.input, raw);
        return await (fn as (i: unknown, e: IpcMainInvokeEvent) => unknown)(input, event);
      } catch (err) {
        log.error(`${contract.channel} failed`, err);
        throw err;
      }
    });
  }
}
