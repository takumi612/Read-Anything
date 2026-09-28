import type { PdfSurroundingBackground, PdfSurroundingColor } from "@shared/preferences";

export const MAX_PDF_SURROUNDING_COLORS = 12;

function hasColor(colors: readonly PdfSurroundingColor[], color: string, exceptId?: string): boolean {
  return colors.some(
    (item) => item.id !== exceptId && item.color.toLowerCase() === color.toLowerCase(),
  );
}

export function addPdfSurroundingColor(
  current: PdfSurroundingBackground,
  color: PdfSurroundingColor,
): PdfSurroundingBackground {
  const normalized = { ...color, name: color.name.trim(), color: color.color.toLowerCase() };
  if (
    current.colors.length >= MAX_PDF_SURROUNDING_COLORS ||
    current.colors.some((item) => item.id === color.id) ||
    hasColor(current.colors, normalized.color)
  ) {
    return current;
  }
  return { colors: [...current.colors, normalized], selectedId: normalized.id };
}

export function editPdfSurroundingColor(
  current: PdfSurroundingBackground,
  id: string,
  patch: Partial<Pick<PdfSurroundingColor, "name" | "color" | "showInThemeMenu">>,
): PdfSurroundingBackground {
  const color = current.colors.find((item) => item.id === id);
  if (!color) return current;
  const nextColor = patch.color?.toLowerCase();
  if (nextColor && hasColor(current.colors, nextColor, id)) return current;
  const nextName = patch.name?.trim();
  if (patch.name !== undefined && !nextName) return current;
  return {
    ...current,
    selectedId:
      current.selectedId === id && patch.showInThemeMenu === false ? null : current.selectedId,
    colors: current.colors.map((item) =>
      item.id === id ? { ...item, ...patch, name: nextName ?? item.name, color: nextColor ?? item.color } : item,
    ),
  };
}

export function deletePdfSurroundingColor(
  current: PdfSurroundingBackground,
  id: string,
): PdfSurroundingBackground {
  if (!current.colors.some((color) => color.id === id)) return current;
  return {
    colors: current.colors.filter((color) => color.id !== id),
    selectedId: current.selectedId === id ? null : current.selectedId,
  };
}

export function resolvePdfSurroundingColor(
  current: PdfSurroundingBackground,
  id: string,
): PdfSurroundingColor | null {
  const color = current.colors.find((item) => item.id === id);
  return color?.showInThemeMenu ? color : null;
}

export function selectedPdfSurroundingColor(
  current: PdfSurroundingBackground,
): PdfSurroundingColor | null {
  return current.colors.find((color) => color.id === current.selectedId) ?? null;
}
