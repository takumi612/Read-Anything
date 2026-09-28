/* @vitest-environment happy-dom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@renderer/store/persist-preference", () => ({ persistPreference: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

import { usePrefsStore } from "@renderer/store/prefs-store";
import { AnnotationPaletteSettings } from "./AnnotationPaletteSettings";

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
  usePrefsStore.setState({
    annotationColors: ["yellow", "green", "blue", "pink", "purple", "#f97316"],
    annotationPalette: ["yellow", "green", "blue", "pink", "purple", "#f97316"],
    lastHighlightStyle: "yellow",
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("AnnotationPaletteSettings", () => {
  it("shows a visible delete action for a saved custom highlight color", async () => {
    await act(async () => {
      root.render(createElement(AnnotationPaletteSettings));
      await Promise.resolve();
    });

    const customColorHex = [...host.querySelectorAll<HTMLInputElement>('input[type="text"]')].find(
      (input) => input.value === "#F97316",
    );
    const deleteButton = customColorHex?.parentElement?.querySelector<HTMLButtonElement>("button");
    expect(deleteButton).toBeDefined();

    await act(async () => deleteButton?.click());

    expect(usePrefsStore.getState().annotationColors).not.toContain("#f97316");
  });

  it("commits an edited highlight HEX value without losing the event value", async () => {
    await act(async () => {
      root.render(createElement(AnnotationPaletteSettings));
      await Promise.resolve();
    });

    const hexInput = [...host.querySelectorAll<HTMLInputElement>('input[type="text"]')].find(
      (input) => input.value === "#F97316",
    );
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    expect(hexInput).toBeDefined();
    expect(setValue).toBeDefined();

    await act(async () => {
      hexInput?.focus();
      setValue?.call(hexInput, "#3456AB");
      hexInput?.dispatchEvent(new Event("input", { bubbles: true }));
      hexInput?.blur();
      await Promise.resolve();
    });

    const preferences = usePrefsStore.getState();
    expect(preferences.annotationColors).toContain("#3456ab");
    expect(preferences.annotationPalette).toContain("#3456ab");
    expect(preferences.annotationColors).not.toContain("#f97316");
  });
});
