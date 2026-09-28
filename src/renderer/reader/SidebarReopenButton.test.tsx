/* @vitest-environment happy-dom */
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarReopenButton } from "./SidebarReopenButton";

vi.mock("@renderer/components/ui/button", () => ({
  Button: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
    createElement("button", props, children),
}));

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("SidebarReopenButton", () => {
  it("provides an accessible, direct control to reopen navigation", () => {
    const onOpen = vi.fn();
    act(() => root.render(createElement(SidebarReopenButton, { label: "Expand sidebar", onOpen })));

    const button = host.querySelector<HTMLButtonElement>("button");
    expect(button?.getAttribute("aria-label")).toBe("Expand sidebar");
    expect(button?.getAttribute("aria-expanded")).toBe("false");
    expect(button?.getAttribute("aria-controls")).toBe("reader-navigation-sidebar");
    expect(button?.className).toContain("fixed");

    act(() => button?.click());
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("opens as soon as a pointer presses the visible handle", () => {
    const onOpen = vi.fn();
    act(() => root.render(createElement(SidebarReopenButton, { label: "Expand sidebar", onOpen })));

    const button = host.querySelector<HTMLButtonElement>("button");
    act(() =>
      button?.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" }),
      ),
    );

    expect(onOpen).toHaveBeenCalledOnce();
  });
});
