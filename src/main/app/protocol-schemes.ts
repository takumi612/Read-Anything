import { protocol } from "electron";

/** Electron requires every privileged app scheme to be registered before readiness in one call. */
export function registerAppProtocolSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: "cover", privileges: { standard: true, secure: true, supportFetchAPI: true } },
    { scheme: "media", privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}
