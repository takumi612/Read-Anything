import { AnnotationEditorType } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { AnnotationStyle } from "@shared/annotations";

export interface PdfAnnotationExport {
  id: string;
  page: number;
  style: AnnotationStyle;
  note: string;
  /** Each quad is top-left, top-right, bottom-left, bottom-right in PDF coordinates. */
  quads: readonly (readonly number[])[];
}

export interface TextLayerRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PdfPageViewport {
  convertToPdfPoint(x: number, y: number): number[];
}

export function pdfQuadsFromClientRects(
  rects: Iterable<TextLayerRect>,
  origin: { left: number; top: number },
  viewport: PdfPageViewport,
): number[][] {
  const quads: number[][] = [];
  for (const rect of rects) {
    if (rect.width < 1 || rect.height < 1) continue;
    const left = rect.left - origin.left;
    const top = rect.top - origin.top;
    const right = left + rect.width;
    const bottom = top + rect.height;
    const points = [
      ...viewport.convertToPdfPoint(left, top),
      ...viewport.convertToPdfPoint(right, top),
      ...viewport.convertToPdfPoint(left, bottom),
      ...viewport.convertToPdfPoint(right, bottom),
    ];
    if (points.every(Number.isFinite)) quads.push(points);
  }
  return quads;
}

const APP_EDITOR_KEY_PREFIX = "pdfjs_internal_editor_marginalia_";
const NAMED_COLOR: Record<string, [number, number, number]> = {
  yellow: [253, 224, 71],
  green: [134, 239, 172],
  blue: [125, 211, 252],
  pink: [249, 168, 212],
  purple: [216, 180, 254],
  underline: [107, 114, 128],
};

export function pdfAnnotationColor(
  style: AnnotationStyle,
): { color: [number, number, number]; opacity: number } {
  if (!style.startsWith("#")) return { color: NAMED_COLOR[style]!, opacity: style === "underline" ? 0.6 : 0.45 };
  const value = Number.parseInt(style.slice(1), 16);
  return {
    color: [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff],
    opacity: 0.45,
  };
}

function annotationRect(quads: readonly (readonly number[])[]): [number, number, number, number] {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const quad of quads) {
    for (let index = 0; index < 8; index += 2) {
      xs.push(quad[index]!);
      ys.push(quad[index + 1]!);
    }
  }
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function toOutline(quad: readonly number[]): number[] {
  // PDF.js stores text quads as TL, TR, BL, BR and paints the outline clockwise.
  return [quad[0]!, quad[1]!, quad[2]!, quad[3]!, quad[6]!, quad[7]!, quad[4]!, quad[5]!];
}

/** Replace the app-managed editor entries and serialize them as standard PDF markup annotations. */
export async function exportPdfAnnotations(
  document: PDFDocumentProxy,
  annotations: readonly PdfAnnotationExport[],
): Promise<Uint8Array<ArrayBuffer>> {
  for (const [key] of document.annotationStorage) {
    if (typeof key === "string" && key.startsWith(APP_EDITOR_KEY_PREFIX)) {
      document.annotationStorage.remove(key);
    }
  }

  for (const annotation of annotations) {
    const quads = annotation.quads.filter(
      (quad) =>
        quad.length === 8 &&
        quad.every(Number.isFinite) &&
        Math.abs(quad[0]! - quad[2]!) > 0.1 &&
        Math.abs(quad[1]! - quad[5]!) > 0.1,
    );
    if (
      !annotation.id ||
      !Number.isInteger(annotation.page) ||
      annotation.page < 1 ||
      annotation.page > document.numPages ||
      quads.length === 0
    ) {
      throw new Error("Không thể lưu chú thích vì vị trí văn bản không còn khớp với PDF.");
    }

    const rect = annotationRect(quads);
    const { color, opacity } = pdfAnnotationColor(annotation.style);
    const editor = {
      annotationType: AnnotationEditorType.HIGHLIGHT,
      pageIndex: annotation.page - 1,
      rect,
      rotation: 0,
      structTreeParentId: null,
      popupRef: "",
      color,
      opacity,
      thickness: 1,
      quadPoints: Float32Array.from(quads.flat()),
      outlines: quads.map(toOutline),
      ...(annotation.note.trim()
        ? {
            popup: {
              contents: annotation.note.trim(),
              rect,
              open: false,
            },
          }
        : {}),
    };
    document.annotationStorage.setValue(`${APP_EDITOR_KEY_PREFIX}${annotation.id}`, editor);
  }

  return document.annotationStorage.size > 0
    ? document.saveDocument()
    : document.getData().then((bytes) => new Uint8Array(bytes));
}
