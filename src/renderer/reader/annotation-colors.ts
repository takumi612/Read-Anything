import type { AnnotationDto, AnnotationFillStyle, AnnotationStyle } from "@shared/annotations";
import { DEFAULT_ANNOTATION_PALETTE } from "@shared/preferences";
import { FILL_COLORS } from "./highlight";

const BUILT_IN_COLORS: Record<string, string> = {
  yellow: "#fde047",
  green: "#86efac",
  blue: "#7dd3fc",
  pink: "#f9a8d4",
  purple: "#d8b4fe",
};

export const ANNOTATION_STYLES: readonly AnnotationStyle[] = [
  ...new Set<AnnotationStyle>([...DEFAULT_ANNOTATION_PALETTE, ...FILL_COLORS, "underline"]),
];

export const MAX_ANNOTATION_PALETTE_COLORS = 6;

/** Toggles one saved color without allowing the quick toolbar to exceed its six slots. */
export function setToolbarColorEnabled(
  enabledColors: readonly AnnotationFillStyle[],
  color: AnnotationFillStyle,
  enabled: boolean,
): AnnotationFillStyle[] {
  if (enabled) {
    if (
      enabledColors.includes(color) ||
      enabledColors.length >= MAX_ANNOTATION_PALETTE_COLORS
    ) {
      return [...enabledColors];
    }
    return [...enabledColors, color];
  }
  return enabledColors.length > 1
    ? enabledColors.filter((enabledColor) => enabledColor !== color)
    : [...enabledColors];
}

/** Picks a surviving enabled color when the selected annotation color is removed. */
export function fallbackToolbarHighlightStyle(
  lastStyle: AnnotationStyle,
  enabledColors: readonly AnnotationFillStyle[],
  savedColors: readonly AnnotationFillStyle[],
): AnnotationStyle {
  return resolveToolbarHighlightStyle(
    lastStyle,
    enabledColors.filter((color) => savedColors.includes(color)),
  );
}

/** Keeps an old saved last-used color from bypassing the user's enabled toolbar palette. */
export function resolveToolbarHighlightStyle(
  lastStyle: AnnotationStyle,
  enabledColors: readonly AnnotationStyle[],
): AnnotationStyle {
  return enabledColors.includes(lastStyle) ? lastStyle : (enabledColors[0] ?? "yellow");
}

export function annotationColorHex(style: AnnotationStyle): string {
  if (style === "underline") return "#6b7280";
  return style.startsWith("#") ? style : (BUILT_IN_COLORS[style] ?? "#fde047");
}

export function annotationColorRgba(style: AnnotationStyle, alpha: number): string {
  const hex = annotationColorHex(style).slice(1);
  const value = Number.parseInt(hex, 16);
  const red = (value >> 16) & 0xff;
  const green = (value >> 8) & 0xff;
  const blue = value & 0xff;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export type AnnotationStyleGroup = {
  style: AnnotationStyle;
  annotations: AnnotationDto[];
};

export function countAnnotationsByStyle(annotations: readonly AnnotationDto[]) {
  const styles = new Set<AnnotationStyle>([
    ...ANNOTATION_STYLES,
    ...annotations.map((annotation) => annotation.style),
  ]);
  const counts = Object.fromEntries([...styles].map((style) => [style, 0])) as Record<
    string,
    number
  >;
  for (const annotation of annotations) counts[annotation.style] += 1;
  return counts;
}

export function filterAnnotationsByStyle(
  annotations: readonly AnnotationDto[],
  style: AnnotationStyle | null,
): AnnotationDto[] {
  return style === null
    ? [...annotations]
    : annotations.filter((annotation) => annotation.style === style);
}

export function groupAnnotationsByStyle(
  annotations: readonly AnnotationDto[],
): AnnotationStyleGroup[] {
  const styles = new Set<AnnotationStyle>([
    ...ANNOTATION_STYLES,
    ...annotations.map((annotation) => annotation.style),
  ]);
  const groups = new Map<AnnotationStyle, AnnotationDto[]>();
  for (const style of styles) groups.set(style, []);
  for (const annotation of annotations) groups.get(annotation.style)?.push(annotation);
  return [...styles].flatMap((style) => {
    const items = groups.get(style)!;
    return items.length > 0 ? [{ style, annotations: items }] : [];
  });
}
