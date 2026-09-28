import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@renderer/components/ui/button";
import { usePrefsStore } from "@renderer/store/prefs-store";
import {
  MAX_PDF_SURROUNDING_COLORS,
  addPdfSurroundingColor,
  deletePdfSurroundingColor,
  editPdfSurroundingColor,
} from "@renderer/theme/pdf-surrounding-colors";

const HEX_COLOR = /^#[0-9a-f]{6}$/iu;

export function PdfSurroundingColorsSettings() {
  const { t } = useTranslation();
  const background = usePrefsStore((state) => state.pdfSurroundingBackground);
  const setBackground = usePrefsStore((state) => state.setPdfSurroundingBackground);
  const setPdfColorMode = usePrefsStore((state) => state.setPdfColorMode);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#e4ece3");
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [hexDrafts, setHexDrafts] = useState<Record<string, string>>({});

  const addColor = () => {
    const name = newName.trim();
    const color = newColor.toLowerCase();
    if (!name || !HEX_COLOR.test(color)) return;
    const next = addPdfSurroundingColor(background, {
      id: crypto.randomUUID(),
      name,
      color,
      showInThemeMenu: true,
    });
    if (next === background) return;
    setBackground(next);
    setPdfColorMode("light");
    setNewName("");
  };

  const colorExists = (value: string, exceptId?: string) =>
    background.colors.some(
      (color) => color.id !== exceptId && color.color.toLowerCase() === value.toLowerCase(),
    );

  const commitHexDraft = (id: string, draft: string) => {
    const normalized = draft.trim().toLowerCase();
    if (HEX_COLOR.test(normalized) && !colorExists(normalized, id)) {
      const next = editPdfSurroundingColor(background, id, { color: normalized });
      if (next !== background) setBackground(next);
    }
    setHexDrafts((drafts) => {
      const updated = { ...drafts };
      delete updated[id];
      return updated;
    });
  };

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div>
        <h3 className="text-sm font-medium">
          {t("settings.pdfCustomSurrounding.title", "Custom PDF background colors")}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t(
            "settings.pdfCustomSurrounding.description",
            "Save colors for the space around PDF pages. They do not recolor the PDF page itself or the application background.",
          )}
        </p>
      </div>

      <div className="space-y-2">
        {background.colors.map((color) => (
          <div
            key={color.id}
            className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-background/60 p-3"
          >
            <input
              type="checkbox"
              checked={color.showInThemeMenu}
              aria-label={t("settings.pdfCustomSurrounding.showInMenu", {
                name: color.name,
                defaultValue: "Show {{name}} in the theme menu",
              })}
              onChange={(event) =>
                setBackground(
                  editPdfSurroundingColor(background, color.id, {
                    showInThemeMenu: event.currentTarget.checked,
                  }),
                )
              }
              className="mb-2 size-4 accent-primary"
            />
            <span className="mb-2 min-w-20 text-xs text-muted-foreground">
              {t("settings.pdfCustomSurrounding.menuVisibility", "Show in menu")}
            </span>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              <span>{t("settings.pdfCustomSurrounding.colorLabel", "Color")}</span>
              <input
                type="color"
                value={color.color}
                aria-label={t("settings.pdfCustomSurrounding.color", {
                  name: color.name,
                  defaultValue: "{{name}} color",
                })}
                onChange={(event) => {
                  setHexDrafts((drafts) => {
                    const updated = { ...drafts };
                    delete updated[color.id];
                    return updated;
                  });
                  setBackground(
                    editPdfSurroundingColor(background, color.id, {
                      color: event.currentTarget.value,
                    }),
                  );
                }}
                className="size-9 cursor-pointer rounded-md border border-input bg-background p-0.5"
              />
            </label>
            <label className="flex min-w-32 flex-1 flex-col gap-1 text-xs text-muted-foreground">
              <span>{t("settings.pdfCustomSurrounding.nameLabel", "Name")}</span>
              <input
                type="text"
                value={nameDrafts[color.id] ?? color.name}
                aria-label={t("settings.pdfCustomSurrounding.name", {
                  number: background.colors.indexOf(color) + 1,
                  defaultValue: "PDF background color {{number}} name",
                })}
                maxLength={40}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setNameDrafts((drafts) => ({ ...drafts, [color.id]: value }));
                }}
                onBlur={() => {
                  const draft = nameDrafts[color.id];
                  if (draft === undefined) return;
                  const next = editPdfSurroundingColor(background, color.id, { name: draft });
                  if (next !== background) setBackground(next);
                  setNameDrafts((drafts) => {
                    const updated = { ...drafts };
                    delete updated[color.id];
                    return updated;
                  });
                }}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
              />
            </label>
            <label className="flex w-32 flex-col gap-1 text-xs text-muted-foreground">
              <span>{t("settings.pdfCustomSurrounding.hexLabel", "HEX")}</span>
              <input
                type="text"
                value={hexDrafts[color.id] ?? color.color.toUpperCase()}
                aria-label={t("settings.pdfCustomSurrounding.hex", {
                  name: color.name,
                  defaultValue: "HEX for {{name}}",
                })}
                aria-invalid={
                  hexDrafts[color.id] !== undefined &&
                  (!HEX_COLOR.test(hexDrafts[color.id]) ||
                    colorExists(hexDrafts[color.id], color.id))
                }
                maxLength={7}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setHexDrafts((drafts) => ({ ...drafts, [color.id]: value }));
                }}
                onBlur={(event) => commitHexDraft(color.id, event.currentTarget.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 font-mono text-sm uppercase text-foreground"
              />
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setBackground(deletePdfSurroundingColor(background, color.id))}
              aria-label={t("settings.pdfCustomSurrounding.remove", {
                name: color.name,
                defaultValue: "Remove {{name}}",
              })}
            >
              <Trash2 aria-hidden="true" className="size-4" />
              {t("settings.pdfCustomSurrounding.removeAction", "Remove")}
            </Button>
          </div>
        ))}
      </div>

      {background.colors.length < MAX_PDF_SURROUNDING_COLORS ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border p-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              <span>{t("settings.pdfCustomSurrounding.colorLabel", "Color")}</span>
              <input
                type="color"
                value={HEX_COLOR.test(newColor) ? newColor : "#e4ece3"}
                aria-label={t("settings.pdfCustomSurrounding.newColor", "New PDF background color")}
                onChange={(event) => setNewColor(event.currentTarget.value)}
                className="size-9 cursor-pointer rounded-md border border-input bg-background p-0.5"
              />
            </label>
            <label className="flex min-w-32 flex-1 flex-col gap-1 text-xs text-muted-foreground">
              <span>{t("settings.pdfCustomSurrounding.nameLabel", "Name")}</span>
              <input
                type="text"
                value={newName}
                aria-label={t(
                  "settings.pdfCustomSurrounding.newName",
                  "New PDF background color name",
                )}
                maxLength={40}
                placeholder={t("settings.pdfCustomSurrounding.namePlaceholder", "Color name")}
                onChange={(event) => setNewName(event.currentTarget.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
              />
            </label>
            <label className="flex w-32 flex-col gap-1 text-xs text-muted-foreground">
              <span>{t("settings.pdfCustomSurrounding.hexLabel", "HEX")}</span>
              <input
                type="text"
                value={newColor.toUpperCase()}
                aria-label={t(
                  "settings.pdfCustomSurrounding.newHex",
                  "New PDF background color HEX",
                )}
                aria-invalid={!HEX_COLOR.test(newColor)}
                maxLength={7}
                onChange={(event) => setNewColor(event.currentTarget.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 font-mono text-sm uppercase text-foreground"
              />
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!newName.trim() || !HEX_COLOR.test(newColor) || colorExists(newColor)}
              onClick={addColor}
            >
              <Plus aria-hidden="true" className="size-4" />
              {t("settings.pdfCustomSurrounding.add", "Add color")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t(
              "settings.pdfCustomSurrounding.addHint",
              "Set a name and a valid HEX value to add this color.",
            )}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("settings.pdfCustomSurrounding.limit", "You can save up to 12 custom colors.")}
        </p>
      )}
    </div>
  );
}
