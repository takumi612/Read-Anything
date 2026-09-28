import { describe, expect, it } from "vitest";
import { applyWindowsPdfAssociation } from "./windows-pdf-association";

describe("Windows PDF association", () => {
  it("registers a chooser entry that launches the current Squirrel version with spaced paths intact", () => {
    const commands: string[][] = [];
    applyWindowsPdfAssociation(
      "register",
      {
        executablePath:
          "C:\\Users\\Reader\\App Data\\Local\\Read-Anything\\app-0.1.0\\Read-Anything.exe",
        updateExePath: "C:\\Users\\Reader\\App Data\\Local\\Read-Anything\\Update.exe",
      },
      (args) => commands.push(args),
    );

    expect(commands).toContainEqual([
      "add",
      "HKCU\\Software\\Classes\\Read-Anything.PDF\\shell\\open\\command",
      "/ve",
      "/t",
      "REG_SZ",
      "/d",
      '"C:\\Users\\Reader\\App Data\\Local\\Read-Anything\\Update.exe" --processStart "Read-Anything.exe" --process-start-args "\\"%1\\""',
      "/f",
    ]);
    expect(commands).toContainEqual([
      "add",
      "HKCU\\Software\\Classes\\.pdf\\OpenWithProgids",
      "/v",
      "Read-Anything.PDF",
      "/t",
      "REG_NONE",
      "/f",
    ]);
    expect(commands).toContainEqual([
      "add",
      "HKCU\\Software\\RegisteredApplications",
      "/v",
      "Read-Anything",
      "/t",
      "REG_SZ",
      "/d",
      "Software\\Read-Anything\\Capabilities",
      "/f",
    ]);
    expect(
      commands.some((args) => args[1] === "HKCU\\Software\\Classes\\.pdf" && args[0] === "add"),
    ).toBe(false);
  });

  it("removes only Read-Anything's PDF chooser registration on uninstall", () => {
    const commands: string[][] = [];
    applyWindowsPdfAssociation(
      "unregister",
      {
        executablePath:
          "C:\\Users\\Reader\\App Data\\Local\\Read-Anything\\app-0.1.0\\Read-Anything.exe",
        updateExePath: "C:\\Users\\Reader\\App Data\\Local\\Read-Anything\\Update.exe",
      },
      (args) => commands.push(args),
    );

    expect(commands).toContainEqual([
      "delete",
      "HKCU\\Software\\Classes\\.pdf\\OpenWithProgids",
      "/v",
      "Read-Anything.PDF",
      "/f",
    ]);
    expect(
      commands.some((args) => args[0] === "delete" && args[1] === "HKCU\\Software\\Classes\\.pdf"),
    ).toBe(false);
  });
});
