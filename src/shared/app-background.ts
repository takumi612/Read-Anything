/** Maximum size for a local application background image. */
export const APPLICATION_BACKGROUND_MAX_BYTES = 8 * 1024 * 1024;

/** app:set-background result; image bytes are stored in the local blob table. */
export type ApplicationBackgroundPickResult =
  | { status: "set"; blobId: string }
  | { status: "too-large" }
  | { status: "unsupported" };
