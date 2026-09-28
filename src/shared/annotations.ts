// src/shared/annotations.ts
import { z } from "zod";

const builtInAnnotationStyle = z.enum([
  "yellow",
  "green",
  "blue",
  "pink",
  "purple",
  "underline",
]);
/** Hex colors are stored directly as styles so existing annotations keep their exact color. */
export const annotationStyle = z.union([
  builtInAnnotationStyle,
  z.string().regex(/^#[0-9a-fA-F]{6}$/),
]) as z.ZodType<z.infer<typeof builtInAnnotationStyle> | `#${string}`>;
export type AnnotationStyle = z.infer<typeof builtInAnnotationStyle> | `#${string}`;

export const annotationFillStyle = z.union([
  z.enum(["yellow", "green", "blue", "pink", "purple"]),
  z.string().regex(/^#[0-9a-fA-F]{6}$/),
]) as z.ZodType<Exclude<AnnotationStyle, "underline">>;
export type AnnotationFillStyle = Exclude<AnnotationStyle, "underline">;

export interface AnnotationDto {
  id: string;
  bookId: string;
  style: AnnotationStyle;
  note: string;
  selectedText: string;
  locatorRange: string;
  createdAt: number;
  updatedAt: number;
}

export const createAnnotationInput = z.object({
  bookId: z.string().min(1),
  style: annotationStyle,
  note: z.string(),
  selectedText: z.string().min(1),
  locatorRange: z.string().min(1),
});
export type CreateAnnotationInput = z.infer<typeof createAnnotationInput>;

export const updateAnnotationInput = z.object({
  id: z.string().min(1),
  patch: z
    .object({
      style: annotationStyle.optional(),
      note: z.string().optional(),
    })
    .refine((p) => p.style !== undefined || p.note !== undefined, {
      message: "patch must include at least one of: style, note",
    }),
});
export type UpdateAnnotationInput = z.infer<typeof updateAnnotationInput>;

export const annotationIdInput = z.object({ id: z.string().min(1) });
export type AnnotationIdInput = z.infer<typeof annotationIdInput>;
