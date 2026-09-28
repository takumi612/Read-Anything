import { describe, expect, it } from "vitest";
import { initMainI18n, setMainLanguage, t } from "@main/i18n";

describe("main i18n", () => {
  it("translates errors per active language and switches at runtime", () => {
    initMainI18n("vi");
    // The provider term and {{id}} interpolation follow the active locale.
    expect(t("errors.providerNotFound", { id: "p1" })).toBe("Không tìm thấy nhà cung cấp p1");
    setMainLanguage("en");
    expect(t("errors.providerNotFound", { id: "p1" })).toBe("provider p1 not found");
  });
});
