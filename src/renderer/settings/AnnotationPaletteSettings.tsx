import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@renderer/components/ui/button";
import { usePrefsStore } from "@renderer/store/prefs-store";
import {
  annotationColorHex,
  fallbackToolbarHighlightStyle,
  MAX_ANNOTATION_PALETTE_COLORS,
  setToolbarColorEnabled,
} from "@renderer/reader/annotation-colors";
import type { AnnotationFillStyle } from "@shared/annotations";

const HEX_COLOR = /^#[0-9a-f]{6}$/iu;

function includesColor(colors: readonly string[], target: string): boolean {
  return colors.some((color) => color.toLowerCase() === target.toLowerCase());
}

export function AnnotationPaletteSettings() {
  const { t } = useTranslation();
  const colors = usePrefsStore((state) => state.annotationColors);
  const toolbarColors = usePrefsStore((state) => state.annotationPalette);
  const setColors = usePrefsStore((state) => state.setAnnotationColors);
  const setToolbarColors = usePrefsStore((state) => state.setAnnotationPalette);
  const lastHighlightStyle = usePrefsStore((state) => state.lastHighlightStyle);
  const setLastHighlightStyle = usePrefsStore((state) => state.setLastHighlightStyle);
  const [newColor, setNewColor] = useState("#f97316");
  const [hexDrafts, setHexDrafts] = useState<Record<string, string>>({});

  const addColor = () => {
    const color = newColor.toLowerCase();
    if (!HEX_COLOR.test(color) || includesColor(colors, color)) return;
    setColors([...colors, color as `#${string}`]);
  };

  const setEnabled = (color: AnnotationFillStyle, enabled: boolean) => {
    setToolbarColors(setToolbarColorEnabled(toolbarColors, color, enabled));
  };

  const editColor = (oldColor: AnnotationFillStyle, nextColor: string) => {
    const normalized = nextColor.toLowerCase();
    if (
      !HEX_COLOR.test(normalized) ||
      (normalized !== oldColor && includesColor(colors, normalized))
    ) {
      return false;
    }
    setColors(colors.map((color) => (color === oldColor ? (normalized as `#${string}`) : color)));
    if (includesColor(toolbarColors, oldColor)) {
      setToolbarColors(
        toolbarColors.map((color) => (color === oldColor ? (normalized as `#${string}`) : color)),
      );
    }
    if (lastHighlightStyle === oldColor) setLastHighlightStyle(normalized as `#${string}`);
    setHexDrafts((drafts) => {
      const next = { ...drafts };
      delete next[oldColor];
      return next;
    });
    return true;
  };

  const deleteColor = (color: AnnotationFillStyle) => {
    if (colors.length <= 1 || (includesColor(toolbarColors, color) && toolbarColors.length <= 1)) {
      return;
    }
    if (includesColor(toolbarColors, color)) {
      setToolbarColors(toolbarColors.filter((item) => item !== color));
    }
    setColors(colors.filter((item) => item !== color));
    if (lastHighlightStyle === color) {
      setLastHighlightStyle(
        fallbackToolbarHighlightStyle(
          lastHighlightStyle,
          toolbarColors.filter((item) => item !== color),
          colors.filter((item) => item !== color),
        ),
      );
    }
  };

  const colorLabel = (color: AnnotationFillStyle) => {
    switch (color) {
      case "yellow":
        return t("reader.annotation.color.yellow");
      case "green":
        return t("reader.annotation.color.green");
      case "blue":
        return t("reader.annotation.color.blue");
      case "pink":
        return t("reader.annotation.color.pink");
      case "purple":
        return t("reader.annotation.color.purple");
      default:
        return color;
    }
  };

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div>
        <h3 className="text-sm font-medium">{t("settings.annotationPalette.title")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("settings.annotationPalette.description")}
        </p>
      </div>

      <div className="space-y-2">
        {colors.map((color, index) => {
          const enabled = includesColor(toolbarColors, color);
          const hexValue = annotationColorHex(color);
          return (
            <div
              key={color}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background/60 p-2"
            >
              <input
                type="checkbox"
                checked={enabled}
                disabled={
                  (enabled && toolbarColors.length <= 1) ||
                  (!enabled && toolbarColors.length >= MAX_ANNOTATION_PALETTE_COLORS)
                }
                aria-label={t("settings.annotationPalette.toolbar", { color: colorLabel(color) })}
                onChange={(event) => setEnabled(color, event.currentTarget.checked)}
                className="size-4 accent-primary"
              />
              <input
                type="color"
                value={hexValue}
                aria-label={t("settings.annotationPalette.color", { number: index + 1 })}
                onChange={(event) => editColor(color, event.currentTarget.value)}
                className="size-9 cursor-pointer rounded-md border-0 bg-transparent p-0"
              />
              <span className="min-w-16 flex-1 text-xs text-muted-foreground">
                {colorLabel(color)}
              </span>
              <input
                type="text"
                value={hexDrafts[color] ?? hexValue.toUpperCase()}
                aria-label={t("settings.annotationPalette.hex", { color: colorLabel(color) })}
                aria-invalid={hexDrafts[color] !== undefined && !HEX_COLOR.test(hexDrafts[color])}
                maxLength={7}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setHexDrafts((drafts) => ({ ...drafts, [color]: value }));
                }}
                onBlur={() => {
                  const draft = hexDrafts[color];
                  if (!draft || !editColor(color, draft)) {
                    setHexDrafts((drafts) => ({ ...drafts, [color]: hexValue.toUpperCase() }));
                  }
                }}
                className="h-8 w-24 rounded-md border border-input bg-background px-2 font-mono text-xs uppercase"
              />
              <Button
                variant="ghost"
                size="sm"
                disabled={colors.length <= 1 || (enabled && toolbarColors.length <= 1)}
                onClick={() => deleteColor(color)}
                aria-label={t("settings.annotationPalette.remove", { color: colorLabel(color) })}
              >
                <Trash2 className="size-4" />
                {t("settings.annotationPalette.removeAction", "Delete")}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="color"
          value={newColor}
          aria-label={t("settings.annotationPalette.newColor")}
          onChange={(event) => setNewColor(event.currentTarget.value)}
          className="size-9 cursor-pointer rounded-md border-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={newColor.toUpperCase()}
          aria-label={t("settings.annotationPalette.newColorHex")}
          maxLength={7}
          onChange={(event) => setNewColor(event.currentTarget.value)}
          className="h-8 w-24 rounded-md border border-input bg-background px-2 font-mono text-xs uppercase"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={!HEX_COLOR.test(newColor) || includesColor(colors, newColor)}
          onClick={addColor}
        >
          <Plus className="size-4" />
          {t("settings.annotationPalette.add")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("settings.annotationPalette.savedNote")}</p>
    </div>
  );
}
