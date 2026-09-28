/* @vitest-environment happy-dom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRecordReadingPage } from "./use-record-reading-page";

const streak = {
  goal: 10,
  pagesToday: 1,
  currentStreak: 0,
  longestStreak: 0,
  readingDays: 0,
  daily: [],
};

let host: HTMLDivElement;
let root: Root;
let recordPageRead: ReturnType<typeof vi.fn>;
let record: (pageNumber: number, totalPages: number) => void;

function Harness() {
  record = useRecordReadingPage("book-1");
  return null;
}

function setup() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(QueryClientProvider, { client }, createElement(Harness)),
    );
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  recordPageRead = vi.fn(async () => ({
    pageStreak: streak,
    bookProgress: { confirmedPages: 1, percent: 0.05 },
  }));
  window.api = { stats: { recordPageRead } } as never;
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("useRecordReadingPage", () => {
  it("records a page only after five continuous seconds", async () => {
    setup();
    act(() => record(7, 140));
    await act(async () => vi.advanceTimersByTimeAsync(4_999));
    expect(recordPageRead).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(recordPageRead).toHaveBeenCalledWith({ bookId: "book-1", pageNumber: 7, totalPages: 140 });
  });

  it("restarts the confirmation timer when the reader changes pages", async () => {
    setup();
    act(() => record(7, 140));
    await act(async () => vi.advanceTimersByTimeAsync(4_000));
    act(() => record(8, 140));
    await act(async () => vi.advanceTimersByTimeAsync(4_999));
    expect(recordPageRead).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(recordPageRead).toHaveBeenCalledTimes(1);
    expect(recordPageRead).toHaveBeenCalledWith({ bookId: "book-1", pageNumber: 8, totalPages: 140 });
  });
});
