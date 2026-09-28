/* @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { getVoicesReady } from "./voices";

describe("getVoicesReady", () => {
  it("shares one pending voiceschanged listener across simultaneous consumers", async () => {
    const listeners: EventListener[] = [];
    const addEventListener = vi.fn((_type: string, listener: EventListener) => {
      listeners.push(listener);
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [],
        addEventListener,
      },
    });

    const first = getVoicesReady(5000);
    const second = getVoicesReady(5000);
    const registeredListeners = addEventListener.mock.calls.length;
    for (const listener of listeners) listener(new Event("voiceschanged"));

    await expect(Promise.all([first, second])).resolves.toEqual([[], []]);
    expect(registeredListeners).toBe(1);
  });
});
