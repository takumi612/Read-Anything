import { describe, expect, it, vi } from "vitest";
import { makeTextPdf } from "@marginalia/pdf-parser/fixture";
import type { LoadBytes } from "@main/ai/tools";
import { formatPdfEvidence, retrievePdfEvidence } from "./pdf-retrieval";

describe("PDF evidence retrieval", () => {
  it("uses the selected phrase and question to find page-attributed context across the PDF", async () => {
    const bytes = await makeTextPdf({ outline: false, title: "PDF evidence fixture", pages: 3 });
    const loadBytes = vi.fn<LoadBytes>(async () => bytes);

    const evidence = await retrievePdfEvidence(
      "pdf-evidence-selected-phrase",
      loadBytes,
      "body text of page 2",
      "What does this passage mean?",
      3,
    );

    expect(evidence.map(({ page }) => page)).toContain(2);
    expect(evidence.find(({ page }) => page === 2)?.text).toContain("body text of page 2");
    expect(evidence.map(({ page }) => page)).toContain(3);
    expect(new Set(evidence.map(({ page }) => page)).size).toBe(evidence.length);
    expect(formatPdfEvidence(evidence)).toContain("[p.2]");
    expect(formatPdfEvidence(evidence)).toContain("[p.3]");
    expect(loadBytes).toHaveBeenCalledTimes(1);
  });

  it("keeps the current page available when the question has no matching terms", async () => {
    const bytes = await makeTextPdf({
      outline: false,
      title: "PDF current page fixture",
      pages: 3,
    });
    const loadBytes: LoadBytes = async () => bytes;

    const evidence = await retrievePdfEvidence(
      "pdf-evidence-current-page",
      loadBytes,
      "",
      "and the is",
      2,
    );

    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({ page: 2 });
    expect(evidence[0]?.text).toContain("body text of page 2");
    expect(formatPdfEvidence(evidence)).toMatch(
      /^## Relevant excerpts retrieved from the PDF\n\[p\.2\]/u,
    );
  });

  it("returns no fabricated evidence when there is no match and no current page", async () => {
    const bytes = await makeTextPdf({ outline: false, title: "PDF no-match fixture", pages: 3 });
    const loadBytes: LoadBytes = async () => bytes;

    const evidence = await retrievePdfEvidence(
      "pdf-evidence-no-match",
      loadBytes,
      "",
      "and the is",
    );

    expect(evidence).toEqual([]);
    expect(formatPdfEvidence(evidence)).toBeNull();
  });
});
