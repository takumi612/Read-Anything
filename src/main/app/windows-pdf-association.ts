import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export type PdfAssociationAction = "register" | "unregister";
export type RegistryCommandRunner = (args: string[]) => void;

interface AssociationPaths {
  executablePath: string;
  updateExePath: string;
}

const PROG_ID = "Read-Anything.PDF";
const APP_NAME = "Read-Anything";
const CLASSES = "HKCU\\Software\\Classes";
const execFileAsync = promisify(execFile);

/** Windows owns the final choice; only read the current per-user ProgId. */
export async function getWindowsPdfAssociationStatus(): Promise<"default" | "other" | "unknown"> {
  if (process.platform !== "win32") return "unknown";
  try {
    const { stdout } = await execFileAsync(
      "reg.exe",
      [
        "query",
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.pdf\\UserChoice",
        "/v",
        "ProgId",
      ],
      { windowsHide: true },
    );
    const progId = /^\s*ProgId\s+REG_\w+\s+(.+?)\s*$/im.exec(stdout)?.[1];
    if (!progId) return "unknown";
    return progId.trim().toLowerCase() === PROG_ID.toLowerCase() ? "default" : "other";
  } catch {
    return "unknown";
  }
}

function registrationCommands(paths: AssociationPaths): string[][] {
  const exeName = path.win32.basename(paths.executablePath);
  const openCommand =
    `"${paths.updateExePath}" --processStart "${exeName}" ` + `--process-start-args "\\"%1\\""`;
  const capabilities = "HKCU\\Software\\Read-Anything\\Capabilities";

  return [
    ["add", `${CLASSES}\\${PROG_ID}`, "/ve", "/t", "REG_SZ", "/d", "Read-Anything PDF Document", "/f"],
    [
      "add",
      `${CLASSES}\\${PROG_ID}\\DefaultIcon`,
      "/ve",
      "/t",
      "REG_SZ",
      "/d",
      `"${paths.executablePath}",0`,
      "/f",
    ],
    ["add", `${CLASSES}\\${PROG_ID}\\shell`, "/ve", "/t", "REG_SZ", "/d", "open", "/f"],
    [
      "add",
      `${CLASSES}\\${PROG_ID}\\shell\\open\\command`,
      "/ve",
      "/t",
      "REG_SZ",
      "/d",
      openCommand,
      "/f",
    ],
    ["add", `${CLASSES}\\.pdf\\OpenWithProgids`, "/v", PROG_ID, "/t", "REG_NONE", "/f"],
    ["add", capabilities, "/v", "ApplicationName", "/t", "REG_SZ", "/d", APP_NAME, "/f"],
    [
      "add",
      capabilities,
      "/v",
      "ApplicationDescription",
      "/t",
      "REG_SZ",
      "/d",
      "Read and annotate PDF documents. AI features use API keys supplied by the user.",
      "/f",
    ],
    ["add", `${capabilities}\\FileAssociations`, "/v", ".pdf", "/t", "REG_SZ", "/d", PROG_ID, "/f"],
    [
      "add",
      "HKCU\\Software\\RegisteredApplications",
      "/v",
      APP_NAME,
      "/t",
      "REG_SZ",
      "/d",
      "Software\\Read-Anything\\Capabilities",
      "/f",
    ],
  ];
}

function unregistrationCommands(): string[][] {
  return [
    ["delete", `${CLASSES}\\.pdf\\OpenWithProgids`, "/v", PROG_ID, "/f"],
    ["delete", `${CLASSES}\\${PROG_ID}`, "/f"],
    ["delete", "HKCU\\Software\\Read-Anything\\Capabilities", "/f"],
    ["delete", "HKCU\\Software\\RegisteredApplications", "/v", APP_NAME, "/f"],
  ];
}

/** Add/remove Read-Anything as a PDF candidate without changing Windows' current default choice. */
export function applyWindowsPdfAssociation(
  action: PdfAssociationAction,
  paths: AssociationPaths,
  runRegistry: RegistryCommandRunner,
  ignoreFailures = false,
): void {
  const commands = action === "register" ? registrationCommands(paths) : unregistrationCommands();
  const failures: unknown[] = [];
  for (const args of commands) {
    try {
      runRegistry(args);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0 && !ignoreFailures) {
    throw new AggregateError(failures, `Unable to ${action} the Windows PDF association.`);
  }
}
