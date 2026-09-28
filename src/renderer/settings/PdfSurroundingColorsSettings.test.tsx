/* @vitest-environment happy-dom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@renderer/store/persist-preference", () => ({ persistPreference: vi.fn() }));

import { usePrefsStore } from "@renderer/store/prefs-store";
import { PdfSurroundingColorsSettings } from "./PdfSurroundingColorsSettings";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === "string" ? fallback : _key,
  }),
}));

const activeColor = {
  id: "sage",
  name: "Soft sage",
  color: "#e4ece3",
  showInThemeMenu: true,
};

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
    pdfSurroundingBackground: { colors: [activeColor], selectedId: activeColor.id },
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("PdfSurroundingColorsSettings", () => {
  it("allows editing a saved surrounding color through its HEX field", async () => {
    await act(async () => {
      root.render(createElement(PdfSurroundingColorsSettings));
      await Promise.resolve();
    });

    const hexInput = [...host.querySelectorAll<HTMLInputElement>('input[type="text"]')].find(
      (input) => input.getAttribute("aria-label")?.includes("settings.pdfCustomSurrounding.hex"),
    );
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    expect(hexInput).toBeDefined();
    expect(setValue).toBeDefined();

    await act(async () => {
      hexInput?.focus();
      setValue?.call(hexInput, "#AABBCC");
      hexInput?.dispatchEvent(new Event("input", { bubbles: true }));
      hexInput?.blur();
      await Promise.resolve();
    });

    expect(usePrefsStore.getState().pdfSurroundingBackground.colors[0]?.color).toBe("#aabbcc");
  });

  it("shows a visible Remove action for each saved surrounding color", async () => {
    await act(async () => {
      root.render(createElement(PdfSurroundingColorsSettings));
      await Promise.resolve();
    });

    const removeButton = [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      /remove/iu.test(button.textContent ?? ""),
    );
    expect(removeButton).toBeDefined();

    await act(async () => removeButton?.click());

    expect(usePrefsStore.getState().pdfSurroundingBackground.colors).toHaveLength(0);
  });

  it("lets users add a PDF color by entering its HEX value", async () => {
    await act(async () => {
      root.render(createElement(PdfSurroundingColorsSettings));
      await Promise.resolve();
    });

    const hexInput = host.querySelector<HTMLInputElement>(
      'input[aria-label="New PDF background color HEX"]',
    );
    const nameInput = host.querySelector<HTMLInputElement>(
      'input[aria-label="New PDF background color name"]',
    );
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    expect(hexInput).not.toBeNull();
    expect(nameInput).not.toBeNull();
    expect(setValue).toBeDefined();

    await act(async () => {
      setValue?.call(hexInput, "#123ABC");
      hexInput?.dispatchEvent(new Event("input", { bubbles: true }));
      setValue?.call(nameInput, "Blue gray");
      nameInput?.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });

    const addButton = [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      /add color/iu.test(button.textContent ?? ""),
    );
    expect(addButton?.disabled).toBe(false);
    await act(async () => addButton?.click());

    expect(usePrefsStore.getState().pdfSurroundingBackground.colors.at(-1)).toMatchObject({
      name: "Blue gray",
      color: "#123abc",
    });
  });

  it("commits a saved color name edited through the text field", async () => {
    await act(async () => {
      root.render(createElement(PdfSurroundingColorsSettings));
      await Promise.resolve();
    });

    const nameInput = host.querySelector<HTMLInputElement>('input[type="text"]');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    expect(nameInput).not.toBeNull();
    expect(setValue).toBeDefined();

    await act(async () => {
      nameInput?.focus();
      setValue?.call(nameInput, "Updated sage");
      nameInput?.dispatchEvent(new Event("input", { bubbles: true }));
      nameInput?.blur();
      await Promise.resolve();
    });

    expect(usePrefsStore.getState().pdfSurroundingBackground.colors[0]?.name).toBe("Updated sage");
  });

  it("stops applying a custom color when it is hidden from the theme menu", async () => {
    await act(async () => {
      root.render(createElement(PdfSurroundingColorsSettings));
      await Promise.resolve();
    });

    const visibleInMenu = host.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(visibleInMenu).not.toBeNull();
    await act(async () => visibleInMenu?.click());

    expect(usePrefsStore.getState().pdfSurroundingBackground).toEqual({
      colors: [{ ...activeColor, showInThemeMenu: false }],
      selectedId: null,
    });
  });
});
