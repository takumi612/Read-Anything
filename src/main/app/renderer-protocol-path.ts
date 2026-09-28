import path from "node:path";

/** Resolve a URL pathname only when it stays inside the bundled renderer directory. */
export function resolveRendererAssetPath(rendererRoot: string, requestPath: string): string | null {
  if (!requestPath.startsWith("/")) return null;

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  if (decodedPath.includes("\0")) return null;

  const relativePath = decodedPath.replace(/^[/\\]+/u, "");
  if (!relativePath) return null;

  const root = path.resolve(rendererRoot);
  const assetPath = path.resolve(root, relativePath);
  const relative = path.relative(root, assetPath);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return null;
  }
  return assetPath;
}
