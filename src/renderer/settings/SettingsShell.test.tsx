/* @vitest-environment happy-dom */
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("@renderer/components/ui/button", () => ({
  Button: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
    createElement("button", props, children),
}));

vi.mock("@renderer/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children?: ReactNode; className?: string }) =>
    createElement("div", { className }, children),
}));

vi.mock("./ModelsSettings", () => ({ ModelsSettings: () => null }));
vi.mock("./AppearanceSettings", () => ({ AppearanceSettings: () => null }));
vi.mock("./ReadingSettings", () => ({ ReadingSettings: () => null }));
vi.mock("./AdvancedSettings", () => ({ AdvancedSettings: () => null }));
vi.mock("./AgentSettings", () => ({ AgentSettings: () => null }));
vi.mock("./MemorySettings", () => ({ MemorySettings: () => null }));
vi.mock("./WebSearchSettings", () => ({ WebSearchSettings: () => null }));

import { SettingsShell } from "./SettingsShell";
import { useSettingsStore } from "@renderer/store/settings-store";

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
  useSettingsStore.setState({ open: true, activeCategory: "appearance" });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("SettingsShell", () => {
  it("renders an opaque layer above the reader chrome", () => {
    act(() => root.render(createElement(SettingsShell)));

    const dialog = host.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog?.className).toContain("z-[100]");
    expect(dialog?.className).toContain("bg-background");
    expect(dialog?.className).not.toContain("bg-background/90");
  });

  it("keeps the Close action in the settings navigation", () => {
    act(() => root.render(createElement(SettingsShell)));

    const closeButton = host.querySelector<HTMLButtonElement>('button[aria-label="Đóng cài đặt"]');
    expect(closeButton?.closest("nav")).not.toBeNull();
  });
});
