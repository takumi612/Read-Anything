import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const e2ePrefix = "read-anything-e2e-pdf-";
const args = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith("--"))
    .map((arg) => {
      const [key, ...value] = arg.slice(2).split("=");
      return [key, value.length ? value.join("=") : true];
    }),
);
const appRoot = args.has("app-root") ? path.resolve(String(args.get("app-root"))) : null;
const exePath = path.resolve(
  String(
    args.get("exe") ||
      (appRoot
        ? path.join(root, "node_modules", "electron", "dist", "electron.exe")
        : path.join(root, "out", "Read-Anything-win32-x64", "Read-Anything.exe")),
  ),
);
const samplePath = args.has("sample") ? path.resolve(String(args.get("sample"))) : null;
const sampleExtension = samplePath ? path.extname(samplePath).toLowerCase() : null;
const captureSelection = args.has("capture");
const keepProfile = args.has("keep-profile");
const pinchOnly = args.has("pinch-only");
const pinchPage = args.has("pinch-page") ? Number(args.get("pinch-page")) : null;
const pinchNotesPanel = args.has("pinch-notes-panel");
const thumbnailsOnly = args.has("thumbnails-only");
const backgroundOnly = args.has("background-only");
const disableGpu = args.has("disable-gpu");
const noSandbox = args.has("no-sandbox");
const capturePages = args.has("capture-pages");
const layoutOnly = args.has("layout-only") || args.has("pre-render-steps");
const checks = [];
let profilePath;
let child;
let client;
let failed = false;
let lastProgressState = null;
let lastEpubDomState = null;

function check(name, condition, detail = "") {
  if (!condition) throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
  checks.push(name);
  console.log(`PASS  ${name}${detail ? ` (${detail})` : ""}`);
}

async function captureAppearanceObservation(name) {
  const screenshot = await client.call("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const screenshotPath = path.join(profilePath, `appearance-${name}.png`);
  await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
  console.log(`VISUAL ${name}: ${screenshotPath}`);
  return screenshotPath;
}

async function closeSettingsWithPointer(scope) {
  const hitTarget = await client.evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const button = [...(dialog?.querySelectorAll('button') ?? [])].find(element =>
      /^(Close settings|Đóng cài đặt)$/u.test(element.getAttribute('aria-label') || '')
    );
    if (!dialog || !button) return null;
    const rect = button.getBoundingClientRect();
    const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const background = getComputedStyle(dialog).backgroundColor;
    const alpha = background.match(/^rgba\\([^,]+,[^,]+,[^,]+,\\s*([^)]+)\\)$/iu)?.[1];
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      topLayer: Number.parseInt(getComputedStyle(dialog).zIndex, 10) > 70,
      opaque: alpha === undefined || Number(alpha) === 1,
      closeReceivesHit: button.contains(target),
    };
  })()`);
  check(
    `${scope}: Settings is opaque above the reader and Close receives pointer hits`,
    Boolean(hitTarget?.topLayer && hitTarget.opaque && hitTarget.closeReceivesHit),
    JSON.stringify(hitTarget),
  );
  if (!hitTarget) return false;

  await client.call("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: hitTarget.x,
    y: hitTarget.y,
  });
  await client.call("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: hitTarget.x,
    y: hitTarget.y,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  await client.call("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: hitTarget.x,
    y: hitTarget.y,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
  const closed = await waitFor(
    `${scope} Settings close by pointer`,
    () => client.evaluate(`!document.querySelector('[role="dialog"]')`),
    2_000,
    50,
  );
  check(`${scope}: Settings closes using a real pointer click`, closed);
  return closed;
}

function epubPageAppearanceExpression() {
  return `(() => {
    const sections = [...document.querySelectorAll('[data-section-index]')];
    const frames = [...document.querySelectorAll('iframe')];
    const frame = frames.find(candidate => candidate.srcdoc?.length > 0);
    const doc = frame?.contentDocument ?? null;
    const body = doc?.body ? getComputedStyle(doc.body) : null;
    const styleText = frame?.srcdoc.match(/<style id="vd-style">([\\s\\S]*?)<\\/style>/i)?.[1] ?? '';
    return {
      sectionCount: sections.length,
      frameCount: frames.length,
      sections: sections.slice(0, 3).map(section => ({
        index: section.getAttribute('data-section-index'),
        height: Math.round(section.getBoundingClientRect().height),
        html: section.innerHTML.slice(0, 240),
      })),
      frameSummaries: frames.slice(0, 3).map(candidate => ({
        title: candidate.title,
        srcDocLength: candidate.srcdoc?.length ?? 0,
        bodyReady: Boolean(candidate.contentDocument?.body),
      })),
      srcDocLength: frame?.srcdoc.length ?? 0,
      injectedCss: styleText,
      background: body?.backgroundColor ?? null,
      color: body?.color ?? null,
    };
  })()`;
}

async function runEpubAppearanceChecks() {
  await waitFor("library screen before importing EPUB", () =>
    client.evaluate(`Boolean(document.querySelector('main') && window.api?.library?.import)`),
  );
  const importedBook = await client.evaluate(
    `window.api.library.import({filePath:${JSON.stringify(samplePath)}})`,
    120_000,
  );
  check("packaged EXE imports the sample EPUB", importedBook?.format === "epub");
  if (!importedBook?.id) throw new Error("EPUB import returned no book id");

  await client.call("Page.reload", { ignoreCache: true });
  await sleep(2_500);
  const bookCard = await waitFor("imported EPUB card after app reload", () =>
    client.evaluate(`(() => {
      const title = ${JSON.stringify(importedBook.title ?? importedBook.id)};
      const button = [...document.querySelectorAll('button[aria-label]')].find(element =>
        (element.getAttribute('aria-label') || '').startsWith(title)
      );
      button?.click();
      return Boolean(button);
    })()`),
  );
  check("imported EPUB can be opened from the library", bookCard);
  const startReading = await waitFor("EPUB reading start screen", () =>
    client.evaluate(`(() => {
      const button = [...document.querySelectorAll('button')].find(element =>
        ['Start reading', 'Bắt đầu đọc'].includes(element.innerText.trim())
      );
      button?.click();
      return Boolean(button);
    })()`),
  );
  check("EPUB reading session starts", startReading);
  await client.call("Page.bringToFront");
  await client.evaluate("window.focus()");

  const rendered = await waitFor(
    "sample EPUB section iframe",
    async () => {
      const state = await client.evaluate(epubPageAppearanceExpression());
      lastEpubDomState = state;
      return state?.frameCount > 0 && state?.srcDocLength > 0 ? state : null;
    },
    10_000,
  );
  check(
    "packaged EXE renders the sample EPUB",
    rendered.frameCount > 0 && rendered.srcDocLength > 0,
    path.basename(samplePath),
  );

  const epubGroup =
    '[role="group"][aria-label="EPUB page colors"], [role="group"][aria-label="Màu trang EPUB"]';
  const pdfGroup =
    '[role="group"][aria-label="PDF surrounding background"], [role="group"][aria-label="Màu nền quanh trang PDF"]';
  const selectMode = async (groupSelector, modes, rootSelector = "body") =>
    client.evaluate(`(() => {
      const root = document.querySelector(${JSON.stringify(rootSelector)});
      const group = root?.querySelector(${JSON.stringify(groupSelector)});
      const labels = ${JSON.stringify(modes)};
      const option = [...(group?.querySelectorAll('button') ?? [])].find(button =>
        labels.includes(button.innerText.trim())
      );
      option?.click();
      return Boolean(option);
    })()`);
  const isModeSelected = async (groupSelector, modes, rootSelector = "body") =>
    client.evaluate(`(() => {
      const root = document.querySelector(${JSON.stringify(rootSelector)});
      const group = root?.querySelector(${JSON.stringify(groupSelector)});
      const labels = ${JSON.stringify(modes)};
      const option = [...(group?.querySelectorAll('button') ?? [])].find(button =>
        labels.includes(button.innerText.trim())
      );
      return Boolean(option && option.getAttribute('aria-pressed') === 'true');
    })()`);

  const appThemeMenuOpenedFromEpub = await client.evaluate(`(() => {
    const button = [...document.querySelectorAll('button[aria-label]')].find(element =>
      /^(Application theme|Giao diện ứng dụng):/u.test(element.getAttribute('aria-label') || '')
    );
    button?.click();
    return Boolean(button);
  })()`);
  check("Application theme menu opens while reading EPUB", appThemeMenuOpenedFromEpub);
  const epubQuickMenu = await waitFor("EPUB theme and page-tone options", () =>
    client.evaluate(`(() => {
      const popup = document.querySelector('[data-slot="popover-content"]');
      if (!popup) return null;
      return {
        epub: popup.querySelector(${JSON.stringify(epubGroup)})?.querySelectorAll('button').length ?? 0,
        pdf: popup.querySelector(${JSON.stringify(pdfGroup)})?.querySelectorAll('button').length ?? 0,
        theme: [...popup.querySelectorAll('[role="group"]')]
          .find(group => /^(Application theme|Giao diện ứng dụng)$/u.test(group.getAttribute('aria-label') || ''))
          ?.querySelectorAll('button[aria-pressed]').length ?? 0,
        hasApplicationBackground: Boolean(popup.querySelector('input[type="color"], input[type="file"]')),
        pdfBrightnessControl: Boolean(popup.querySelector('input[type="range"]')),
      };
    })()`),
  );
  check(
    "EPUB theme menu shows six EPUB tones and hides PDF tones",
    epubQuickMenu.epub === 6 &&
      epubQuickMenu.pdf === 0 &&
      epubQuickMenu.theme === 3 &&
      !epubQuickMenu.pdfBrightnessControl,
  );
  check(
    "theme menu keeps application background settings separate",
    !epubQuickMenu.hasApplicationBackground,
  );
  await captureAppearanceObservation("epub-theme-menu");
  const epubQuickPaperSelected = await selectMode(
    epubGroup,
    ["Warm paper", "Giấy ấm"],
    '[data-slot="popover-content"]',
  );
  check("EPUB warm-paper tone is selectable in the theme menu", epubQuickPaperSelected);
  const quickPaperPage = await waitFor("EPUB warm-paper page after quick-menu change", async () => {
    const style = await client.evaluate(epubPageAppearanceExpression());
    return style?.background === "rgb(255, 250, 240)" ? style : null;
  });
  check(
    "theme-menu tone change immediately updates the EPUB page",
    quickPaperPage.background === "rgb(255, 250, 240)",
  );

  const settingsOpened = await waitFor("Settings button in reader", () =>
    client.evaluate(`(() => {
      const button = [...document.querySelectorAll('button[aria-label]')].find(element =>
        /^(Settings|Cài đặt)$/u.test(element.getAttribute('aria-label') || '')
      );
      button?.click();
      return Boolean(button);
    })()`),
  );
  check("settings open directly from the reader", settingsOpened);

  const appearanceTab = await waitFor("Appearance settings section", () =>
    client.evaluate(`(() => {
      const button = [...document.querySelectorAll('[role="dialog"] nav button')].find(element =>
        /^(Appearance|Giao diện)$/u.test(element.innerText.trim())
      );
      button?.click();
      return Boolean(button);
    })()`),
  );
  check("Appearance section is available", appearanceTab);

  const selectAppearanceMode = async (groupSelector, modes) =>
    selectMode(groupSelector, modes, '[role="dialog"]');
  const optionCounts = await client.evaluate(`(() => ({
    epub: document.querySelector(${JSON.stringify(epubGroup)})?.querySelectorAll('button').length ?? 0,
    pdf: document.querySelector(${JSON.stringify(pdfGroup)})?.querySelectorAll('button').length ?? 0,
    appBackground: Boolean(document.querySelector('[role="dialog"] input[type="color"][aria-label="Background color"], [role="dialog"] input[type="color"][aria-label="Màu nền"]')),
  }))()`);
  check(
    "Appearance settings show all six EPUB and PDF tones",
    optionCounts.epub === 6 && optionCounts.pdf === 6,
  );
  check("application background remains in Appearance settings", optionCounts.appBackground);

  const epubLightSelected = await selectAppearanceMode(epubGroup, ["Original", "Gốc"]);
  check("EPUB original page mode can be selected from Appearance", epubLightSelected);
  const pdfLightSelected = await selectAppearanceMode(pdfGroup, ["Original", "Gốc"]);
  check("PDF original page mode can be selected from Appearance", pdfLightSelected);

  const epubDarkSelected = await selectAppearanceMode(epubGroup, ["Dark", "Tối"]);
  check("EPUB dark page mode can be selected", epubDarkSelected);
  const darkPage = await waitFor("dark EPUB page styling", async () => {
    const style = await client.evaluate(epubPageAppearanceExpression());
    const injectedDarkCss = style?.injectedCss.includes("background-color: #15181c !important");
    const computedStyleMatches =
      style?.background === "rgb(21, 24, 28)" && style?.color === "rgb(201, 205, 209)";
    return injectedDarkCss && computedStyleMatches ? style : null;
  });
  check(
    "EPUB dark mode changes only the EPUB reading page",
    darkPage.background === "rgb(21, 24, 28)",
  );
  check(
    "changing EPUB tone leaves the PDF tone selection unchanged",
    await isModeSelected(pdfGroup, ["Original", "Gốc"], '[role="dialog"]'),
  );
  const pdfDarkSelected = await selectAppearanceMode(pdfGroup, ["Dark", "Tối"]);
  check("PDF dark page mode can be selected from Appearance", pdfDarkSelected);
  const epubDarkAfterPdfChange = await waitFor(
    "EPUB stays dark after PDF mode change",
    async () => {
      const style = await client.evaluate(epubPageAppearanceExpression());
      return style?.injectedCss.includes("background-color: #15181c !important") &&
        style.background === "rgb(21, 24, 28)"
        ? style
        : null;
    },
  );
  check(
    "changing PDF tone leaves the EPUB page mode unchanged",
    epubDarkAfterPdfChange.injectedCss.includes("background-color: #15181c !important"),
  );

  await closeSettingsWithPointer("EPUB");
  await waitFor("EPUB Appearance settings to close", () =>
    client.evaluate(`!document.querySelector('[role="dialog"]')`),
  );
  await captureAppearanceObservation("epub-dark");

  const appThemeMenuOpened = await client.evaluate(`(() => {
    const button = [...document.querySelectorAll('button[aria-label]')].find(element =>
      /^(Application theme|Giao diện ứng dụng):/u.test(element.getAttribute('aria-label') || '')
    );
    button?.click();
    return Boolean(button);
  })()`);
  check("application theme menu opens", appThemeMenuOpened);
  const themePopupHasOnlyThemeOptions = await waitFor(
    "theme popover without application background controls",
    () =>
      client.evaluate(`(() => {
      const popup = document.querySelector('[data-slot="popover-content"]');
      if (!popup) return null;
      return {
        hasBackgroundControls: Boolean(popup.querySelector('input[type="color"], input[type="file"]')) || /Application background|Nền ứng dụng/u.test(popup.innerText),
        options: [...popup.querySelectorAll('button[aria-pressed]')].map(button => button.innerText.trim()),
      };
    })()`),
  );
  check(
    "theme popover contains no application background controls",
    !themePopupHasOnlyThemeOptions.hasBackgroundControls,
  );
  const epubToneMenuGroups = await client.evaluate(`(() => {
    const popup = document.querySelector('[data-slot="popover-content"]');
    return {
      epub: popup?.querySelector(${JSON.stringify(epubGroup)})?.querySelectorAll('button').length ?? 0,
      pdf: popup?.querySelector(${JSON.stringify(pdfGroup)})?.querySelectorAll('button').length ?? 0,
    };
  })()`);
  check(
    "EPUB reader theme menu keeps only EPUB tones",
    epubToneMenuGroups.epub === 6 && epubToneMenuGroups.pdf === 0,
  );
  const applicationLightSelected = await client.evaluate(`(() => {
    const item = [...document.querySelectorAll('[data-slot="popover-content"] button[aria-pressed]')].find(element =>
      /^(Light|Sáng)$/u.test(element.innerText.trim())
    );
    item?.click();
    return Boolean(item);
  })()`);
  check("application theme can be changed independently", applicationLightSelected);
  const darkPageAfterAppThemeChange = await waitFor(
    "EPUB page retains its own dark appearance",
    async () => {
      const style = await client.evaluate(epubPageAppearanceExpression());
      return style?.injectedCss.includes("background-color: #15181c !important") &&
        style.background === "rgb(21, 24, 28)"
        ? style
        : null;
    },
  );
  check(
    "application theme changes do not recolor the EPUB page",
    darkPageAfterAppThemeChange.injectedCss.includes("background-color: #15181c !important"),
  );
  console.log(`\n${checks.length} packaged EPUB appearance checks passed.`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not allocate a debug port");
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

async function waitFor(description, predicate, timeoutMs = 30_000, intervalMs = 250) {
  const until = Date.now() + timeoutMs;
  let lastValue;
  while (Date.now() < until) {
    lastValue = await predicate();
    if (lastValue) return lastValue;
    if (child?.exitCode != null) {
      throw new Error(`${description}: packaged app exited with code ${child.exitCode}`);
    }
    await sleep(intervalMs);
  }
  throw new Error(`${description}: timed out${lastValue ? ` (${JSON.stringify(lastValue)})` : ""}`);
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    this.runtimeEvents = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.method === "Runtime.exceptionThrown") {
        const details = message.params?.exceptionDetails;
        this.runtimeEvents.push({
          type: "exception",
          text: details?.exception?.description || details?.text || "Unknown renderer exception",
        });
      } else if (message.method === "Runtime.consoleAPICalled") {
        const params = message.params ?? {};
        const text = (params.args ?? [])
          .map((argument) => argument.value ?? argument.description ?? "")
          .join(" ")
          .slice(0, 1200);
        if (["error", "warning"].includes(params.type) || text.includes("[renderer]")) {
          this.runtimeEvents.push({ type: params.type, text });
        }
      }
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject, timer } = this.pending.get(message.id);
      clearTimeout(timer);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    });
    socket.addEventListener("close", () => {
      for (const request of this.pending.values()) {
        clearTimeout(request.timer);
        request.reject(new Error("DevTools connection closed"));
      }
      this.pending.clear();
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("DevTools WebSocket timed out")), 10_000);
      socket.addEventListener(
        "open",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      socket.addEventListener(
        "error",
        () => {
          clearTimeout(timer);
          reject(new Error("Could not connect to the packaged app DevTools"));
        },
        { once: true },
      );
    });
    const client = new CdpClient(socket);
    await client.call("Runtime.enable");
    return client;
  }

  call(method, params = {}, timeoutMs = 20_000) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`DevTools call timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression, timeoutMs = 20_000) {
    const result = await this.call(
      "Runtime.evaluate",
      {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      },
      timeoutMs,
    );
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description || result.exceptionDetails.text,
      );
    }
    return result.result?.value;
  }

  close() {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.close();
  }
}

async function waitForTarget(port) {
  return waitFor(
    "packaged PDF reader startup",
    async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json`);
        if (!response.ok) return null;
        return (await response.json()).find((target) => target.type === "page");
      } catch {
        return null;
      }
    },
    45_000,
  );
}

function currentPageExpression() {
  return `(() => {
    const scroller = document.querySelector('.reader-scroll-region');
    const top = scroller?.getBoundingClientRect().top ?? 0;
    const pages = [...(scroller?.querySelectorAll('.textLayer[data-page]') ?? [])]
      .map(layer => ({ page: Number(layer.dataset.page), top: layer.getBoundingClientRect().top, height: layer.getBoundingClientRect().height }))
      .filter(page => page.height > 0)
      .sort((a, b) => a.top - b.top);
    const visible = pages.find(page => page.top <= top && page.top + page.height > top)
      ?? [...pages].reverse().find(page => page.top + page.height <= top)
      ?? pages[0];
    const header = [...document.querySelectorAll('header')]
      .map(element => element.innerText.trim())
      .find(text => text.split('\\n').some(line => line.includes('%') && line.includes('/'))) ?? '';
    const pageLine = header.split('\\n').find(line => line.includes('%') && line.includes('/')) ?? '';
    const match = pageLine.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
    return { visiblePage: visible?.page ?? null, headerPage: match ? Number(match[1]) : null, pageCount: match ? Number(match[2]) : null };
  })()`;
}

async function clickFindButton() {
  return client.evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(element =>
      ['Find', 'Tìm kiếm'].includes(element.getAttribute('aria-label') || element.title)
    );
    button?.click();
    return Boolean(button);
  })()`);
}

async function verifyReaderLayout() {
  const initial = await waitFor("reader sidebar navigation controls", () =>
    client.evaluate(`(() => {
      const header = document.querySelector('header');
      const leftGroup = header?.firstElementChild;
      const firstButton = leftGroup?.querySelector('button');
      const buttonName = button => button.getAttribute('aria-label') || button.title || '';
      const collapse = [...document.querySelectorAll('button[aria-expanded="true"]')]
        .find(button => /collapse sidebar|thu gọn thanh bên/i.test(buttonName(button)));
      const pagesTab = [...document.querySelectorAll('[role="tab"]')]
        .some(tab => /^(pages|trang)$/i.test(tab.getAttribute('aria-label') || ''));
      const floatingThumbnails = [...document.querySelectorAll('button')]
        .some(button => /page thumbnails|ảnh thu nhỏ trang/i.test(buttonName(button)));
      const summaryStatusVisible = /(?:summary|tóm tắt)\\s+(?:pending|not generated|generating|ready|chưa tạo|đang tạo|sẵn sàng)/i
        .test(document.body.innerText);
      const completeReadingVisible = [...document.querySelectorAll('button')]
        .some(button => /complete reading|hoàn tất đọc/i.test(button.innerText || button.getAttribute('aria-label') || ''));
      const scroller = document.querySelector('.reader-scroll-region');
      const scrollerStyle = scroller ? getComputedStyle(scroller) : null;
      const scrollOverflow = scrollerStyle?.overflowY ?? '';
      const scrollbarWidth = scroller
        ? Number.parseFloat(getComputedStyle(scroller, '::-webkit-scrollbar').width)
        : 0;
      const currentBookTitle = [...document.querySelectorAll('button[aria-current="page"]')]
        .map(button => button.innerText.trim())
        .find(Boolean) || '';
      const sidebarText = document.querySelector('[role="tablist"]')?.parentElement?.parentElement?.innerText || '';
      const sidebarRepeatsBookTitle = Boolean(currentBookTitle) &&
        sidebarText.toLocaleLowerCase().includes(currentBookTitle.toLocaleLowerCase());
      return firstButton && collapse ? {
        firstIsLibraryArrow: Boolean(firstButton.querySelector('svg.lucide-arrow-left')),
        collapseAvailable: true,
        pagesTab,
        floatingThumbnails,
        summaryStatusVisible,
        completeReadingVisible,
        scrollOverflow,
        scrollbarWidth,
        sidebarRepeatsBookTitle,
      } : null;
    })()`),
  );
  check("Library back arrow stays first in the reader header", initial.firstIsLibraryArrow);
  check(
    "Pages stays in the sidebar without a floating thumbnails button",
    initial.pagesTab && !initial.floatingThumbnails,
  );
  check("AI summary status is absent from the reading interface", !initial.summaryStatusVisible);
  check("Complete reading action is temporarily absent", !initial.completeReadingVisible);
  check("reader exposes a vertical scrollbar", ["auto", "scroll"].includes(initial.scrollOverflow));
  check(
    "reader scrollbar has a comfortable 12px hit area",
    initial.scrollbarWidth >= 12,
    `${initial.scrollbarWidth}px`,
  );
  check("Book title is not repeated in the left sidebar", !initial.sidebarRepeatsBookTitle);

  const didCollapse = await client.evaluate(`(() => {
    const button = [...document.querySelectorAll('button[aria-expanded="true"]')]
      .find(element => /collapse sidebar|thu gọn thanh bên/i.test(element.getAttribute('aria-label') || element.title || ''));
    button?.click();
    return Boolean(button);
  })()`);
  check("sidebar has an in-pane collapse control", didCollapse);

  await sleep(250);
  const visibleReopen = await client.evaluate(`(() => {
    const isVisible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && rect.left < innerWidth && rect.right > 0 &&
        rect.top < innerHeight && rect.bottom > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const button = document.querySelector('[data-testid="sidebar-reopen"]');
    return Boolean(button && isVisible(button));
  })()`);
  check("collapsed sidebar has a visible reopen button", visibleReopen);

  const reopenHitTarget = await client.evaluate(`(() => {
    const button = document.querySelector('[data-testid="sidebar-reopen"]');
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return button.contains(target) ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
  })()`);
  check("sidebar reopen button is not covered by the PDF surface", reopenHitTarget !== null);
  await client.evaluate(`(() => {
    window.__sidebarReopenPointerTrace = [];
    for (const type of ['pointerdown', 'pointerup', 'click']) {
      document.addEventListener(type, event => {
        const target = event.target instanceof Element ? event.target.closest('[data-testid="sidebar-reopen"]') : null;
        window.__sidebarReopenPointerTrace.push({
          type,
          targetIsReopenButton: Boolean(target),
          trusted: event.isTrusted,
          defaultPrevented: event.defaultPrevented,
        });
      }, true);
    }
    return true;
  })()`);
  if (reopenHitTarget) {
    await client.call("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: reopenHitTarget.x,
      y: reopenHitTarget.y,
    });
    await client.call("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: reopenHitTarget.x,
      y: reopenHitTarget.y,
      button: "left",
      buttons: 1,
      clickCount: 1,
    });
    const reopenedOnPointerPress = await waitFor(
      "sidebar opens on pointer press",
      () =>
        client.evaluate(`(() => [...document.querySelectorAll('button[aria-expanded="true"]')]
        .some(button => /collapse sidebar|thu gọn thanh bên/i.test(button.getAttribute('aria-label') || button.title || '')))()`),
      2_000,
      50,
    );
    check("sidebar opens when the pointer presses the visible handle", reopenedOnPointerPress);
    await client.call("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: reopenHitTarget.x,
      y: reopenHitTarget.y,
      button: "left",
      buttons: 0,
      clickCount: 1,
    });
  }
  const pointerTrace = await client.evaluate(`(() => ({
    trace: window.__sidebarReopenPointerTrace ?? [],
    reopenButtonStillPresent: Boolean(document.querySelector('[data-testid="sidebar-reopen"]')),
  }))()`);
  console.log(`DIAGNOSTIC sidebar pointer activation: ${JSON.stringify(pointerTrace)}`);
  check(
    "sidebar reopen button receives a trusted pointer press",
    Boolean(
      pointerTrace.trace.some(
        (event) => event.type === "pointerdown" && event.targetIsReopenButton && event.trusted,
      ),
    ),
  );
  await waitFor("sidebar restored", () =>
    client.evaluate(`(() => [...document.querySelectorAll('button[aria-expanded="true"]')]
      .some(button => /collapse sidebar|thu gọn thanh bên/i.test(button.getAttribute('aria-label') || button.title || '') &&
      (() => { const r = button.getBoundingClientRect(); return r.left < innerWidth && r.right > 0 && r.top < innerHeight && r.bottom > 0; })()))()`),
  );
  const scrollHeader = await client.evaluate(`(() => {
    const scroller = document.querySelector('.reader-scroll-region');
    const header = document.querySelector('header');
    if (!scroller || !header) return null;
    const rect = scroller.getBoundingClientRect();
    return { initialTop: scroller.scrollTop, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  check("reader has an auto-hiding header and scroll region", scrollHeader !== null);
  if (scrollHeader) {
    await client.call("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: scrollHeader.x,
      y: scrollHeader.y,
      deltaX: 0,
      deltaY: 300,
    });
  }
  await waitFor(
    "PDF reader responds to wheel input",
    () =>
      client.evaluate(
        `document.querySelector('.reader-scroll-region')?.scrollTop > ${scrollHeader?.initialTop ?? 0} + 2`,
      ),
    5_000,
  );
  await sleep(250);
  const headerAfterFirstWheel = await client.evaluate(`(() => {
    const wrapper = document.querySelector('header')?.parentElement;
    const scroller = document.querySelector('.reader-scroll-region');
    return { wrapperHeight: wrapper?.getBoundingClientRect().height ?? null, scrollTop: scroller?.scrollTop ?? null };
  })()`);
  console.log(`DIAGNOSTIC first downward wheel: ${JSON.stringify(headerAfterFirstWheel)}`);
  await waitFor(
    "reader header hides while scrolling down",
    () =>
      client.evaluate(
        `(document.querySelector('header')?.parentElement?.getBoundingClientRect().height ?? 0) === 0`,
      ),
    5_000,
  );
  const downTop = await client.evaluate(
    `document.querySelector('.reader-scroll-region')?.scrollTop ?? 0`,
  );
  if (scrollHeader) {
    await client.call("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: scrollHeader.x,
      y: scrollHeader.y,
      deltaX: 0,
      deltaY: -300,
    });
  }
  await waitFor(
    "PDF reader responds to upward wheel input",
    () =>
      client.evaluate(
        `document.querySelector('.reader-scroll-region')?.scrollTop < ${downTop} - 2`,
      ),
    5_000,
  );
  await waitFor(
    "reader header returns while scrolling up",
    () =>
      client.evaluate(
        `(document.querySelector('header')?.parentElement?.getBoundingClientRect().height ?? 0) > 0`,
      ),
    5_000,
  );
}

async function pressCtrlF() {
  await client.call("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Control",
    code: "ControlLeft",
    windowsVirtualKeyCode: 17,
  });
  await client.call("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "f",
    code: "KeyF",
    modifiers: 2,
    windowsVirtualKeyCode: 70,
  });
  await client.call("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "f",
    code: "KeyF",
    modifiers: 2,
    windowsVirtualKeyCode: 70,
  });
  await client.call("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Control",
    code: "ControlLeft",
    windowsVirtualKeyCode: 17,
  });
}

async function dispatchPinchZoom(deltaY, anchor, steps = 12) {
  for (let step = 0; step < steps; step++) {
    await client.call("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: anchor.x,
      y: anchor.y,
      deltaX: 0,
      deltaY,
      modifiers: 2,
    });
    await sleep(16);
  }
}

async function checkPinchZoom() {
  await client.evaluate(`(() => {
    window.__marginaliaE2eZoomTrace = [];
    document.addEventListener('wheel', event => {
      if (!event.ctrlKey) return;
      const scroller = document.querySelector('.reader-scroll-region');
      if (!scroller) return;
      const page = [...scroller.querySelectorAll('.textLayer[data-page]')]
        .map(layer => ({ page: Number(layer.dataset.page), rect: layer.getBoundingClientRect() }))
        .find(item => item.rect.top <= event.clientY && item.rect.bottom > event.clientY);
      const sample = {
        y: event.clientY,
        deltaY: event.deltaY,
        page: page?.page ?? null,
        ratio: page ? (event.clientY - page.rect.top) / page.rect.height : null,
        pageTop: page?.rect.top ?? null,
        pageHeight: page?.rect.height ?? null,
        scrollTop: scroller.scrollTop,
        headerHeight: document.querySelector('header')?.parentElement?.getBoundingClientRect().height ?? null,
        target: (event.target instanceof Element ? event.target.tagName + '.' + event.target.className : ''),
      };
      window.__marginaliaE2eZoomTrace.push(sample);
      setTimeout(() => { sample.defaultPrevented = event.defaultPrevented; }, 0);
    }, true);
  })()`);
  const before = await waitFor("PDF page under the touchpad zoom anchor", () =>
    client.evaluate(zoomAnchorExpression()),
  );
  check("touchpad zoom starts on the visible PDF page", before.page > 0, `page ${before.page}`);
  await dispatchPinchZoom(-6, before);
  const afterIn = await waitForStableZoomAnchor(before, "touchpad zoom-in");
  const zoomTrace = await client.evaluate("window.__marginaliaE2eZoomTrace ?? []");
  check(
    "touchpad zoom-in keeps the page and reading point under the cursor",
    afterIn.page === before.page && Math.abs(afterIn.ratio - before.ratio) <= 0.04,
    `page ${before.page} → ${afterIn.page}; point ${before.ratio.toFixed(3)} → ${afterIn.ratio.toFixed(3)}; height ${before.height.toFixed(1)} → ${afterIn.height.toFixed(1)}; header ${before.headerHeight}px → ${afterIn.headerHeight}px${afterIn.page === before.page ? "" : `; wheel trace ${JSON.stringify(zoomTrace)}`}`,
  );
  await dispatchPinchZoom(6, afterIn);
  const afterOut = await waitForStableZoomAnchor(afterIn, "touchpad zoom-out");
  const settledPages = await client.evaluate(`(() => {
    const scroller = document.querySelector('.reader-scroll-region');
    const pages = [...(scroller?.querySelectorAll('.textLayer[data-page]') ?? [])]
      .map(layer => ({
        page: Number(layer.dataset.page),
        top: layer.getBoundingClientRect().top,
        height: layer.getBoundingClientRect().height,
      }));
    return { scrollTop: scroller?.scrollTop ?? null, pages };
  })()`);
  const zoomOutStable =
    afterOut.page === afterIn.page && Math.abs(afterOut.ratio - afterIn.ratio) <= 0.04;
  check(
    "touchpad zoom-out keeps the page and reading point under the cursor",
    zoomOutStable,
    `page ${afterIn.page} → ${afterOut.page}; point ${afterIn.ratio.toFixed(3)} → ${afterOut.ratio.toFixed(3)}; height ${afterIn.height.toFixed(1)} → ${afterOut.height.toFixed(1)}; header ${afterIn.headerHeight}px → ${afterOut.headerHeight}px${zoomOutStable ? "" : `; wheel trace ${JSON.stringify(zoomTrace)}; settled pages ${JSON.stringify(settledPages)}`}`,
  );
}

async function waitForStableZoomAnchor(previous, label) {
  const deadline = Date.now() + 10_000;
  let last = null;
  let stableSamples = 0;
  await sleep(350); // Let queued wheel events and Virtuoso scrollToIndex updates settle.
  while (Date.now() < deadline) {
    const anchor = await client.evaluate(zoomAnchorExpression());
    if (anchor && Math.abs(anchor.height - previous.height) > 10) {
      if (
        last &&
        anchor.page === last.page &&
        Math.abs(anchor.height - last.height) < 0.5 &&
        Math.abs(anchor.ratio - last.ratio) < 0.002
      ) {
        stableSamples++;
      } else {
        stableSamples = 0;
      }
      if (stableSamples >= 2) return anchor;
      last = anchor;
    }
    await sleep(100);
  }
  throw new Error(`${label} did not settle to a stable changed layout`);
}

function zoomAnchorExpression() {
  return `(() => {
    const scroller = document.querySelector('.reader-scroll-region');
    if (!scroller) return null;
    const viewport = scroller.getBoundingClientRect();
    const x = viewport.left + viewport.width / 2;
    const y = viewport.top + viewport.height * 0.42;
    const page = [...scroller.querySelectorAll('.textLayer[data-page]')]
      .map(layer => ({ page: Number(layer.dataset.page), rect: layer.getBoundingClientRect() }))
      .find(item => item.rect.top <= y && item.rect.bottom > y);
    if (!page || page.rect.height <= 0) return null;
    return {
      x,
      y,
      page: page.page,
      ratio: (y - page.rect.top) / page.rect.height,
      height: page.rect.height,
      headerHeight: document.querySelector('header')?.parentElement?.getBoundingClientRect().height ?? null,
    };
  })()`;
}

function pagePaintExpression(pageNumber) {
  return `((pageNumber) => {
    const layer = document.querySelector('.textLayer[data-page="' + pageNumber + '"]');
    const canvas = layer?.parentElement?.querySelector('canvas');
    if (!layer || !canvas || canvas.width < 1 || canvas.height < 1) return null;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    const canvasAttributes = { width: canvas.getAttribute('width'), height: canvas.getAttribute('height') };
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const step = Math.max(1, Math.ceil(Math.sqrt((canvas.width * canvas.height) / 20000)));
    let inkSamples = 0;
    let opaqueSamples = 0;
    let sampledPixels = 0;
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        sampledPixels++;
        const offset = (y * canvas.width + x) * 4;
        if (pixels[offset + 3] > 0) opaqueSamples++;
        if (pixels[offset + 3] > 0 && (pixels[offset] < 245 || pixels[offset + 1] < 245 || pixels[offset + 2] < 245)) inkSamples++;
      }
    }
    return { width: canvas.width, height: canvas.height, canvasAttributes, textLength: layer.textContent?.trim().length ?? 0, sampledPixels, opaqueSamples, inkSamples };
  })(${JSON.stringify(pageNumber)})`;
}

async function runApplicationBackgroundChecks(initialPagePaint) {
  const epubGroup =
    '[role="group"][aria-label="EPUB page colors"], [role="group"][aria-label="Màu trang EPUB"]';
  const pdfGroup =
    '[role="group"][aria-label="PDF surrounding background"], [role="group"][aria-label="Màu nền quanh trang PDF"]';
  const themeTrigger = await client.evaluate(`(() => {
    const button = [...document.querySelectorAll('button[aria-label]')].find(element =>
      /^(Application theme|Giao diện ứng dụng):/u.test(element.getAttribute('aria-label') || '')
    );
    button?.click();
    return Boolean(button);
  })()`);
  check("application theme popover opens in the PDF reader", themeTrigger);

  const popover = await waitFor("theme and PDF page-tone quick popover", () =>
    client.evaluate(`(() => {
      const popup = document.querySelector('[data-slot="popover-content"]');
      const text = popup?.innerText || '';
      return popup
        ? {
            text,
            hasBackgroundInput: Boolean(popup.querySelector('input[type="color"], input[type="file"]')),
            themeOptions: [...popup.querySelectorAll('[role="group"]')]
              .find(group => /^(Application theme|Giao diện ứng dụng)$/u.test(group.getAttribute('aria-label') || ''))
              ?.querySelectorAll('button[aria-pressed]').length ?? 0,
            epubOptions: popup.querySelector(${JSON.stringify(epubGroup)})?.querySelectorAll('button').length ?? 0,
            pdfOptions: popup.querySelector(${JSON.stringify(pdfGroup)})?.querySelectorAll('button').length ?? 0,
            pdfBrightness: popup.querySelector('input[type="range"]')?.value ?? null,
          }
        : null;
    })()`),
  );
  check(
    "PDF theme popover shows PDF tones and hides EPUB tones",
    !popover.hasBackgroundInput &&
      popover.themeOptions === 3 &&
      popover.epubOptions === 0 &&
      popover.pdfOptions === 6 &&
      popover.pdfBrightness === "100" &&
      !/Application background|Nền ứng dụng/u.test(popover.text),
  );
  await captureAppearanceObservation("pdf-theme-menu");
  const brightnessChanged = await client.evaluate(`(() => {
    const popup = document.querySelector('[data-slot="popover-content"]');
    const slider = popup?.querySelector('input[type="range"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!slider || !setter) return false;
    setter.call(slider, '125');
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    return slider.value === '125';
  })()`);
  check("PDF brightness can be adjusted in the Application theme menu", brightnessChanged);
  const brighterCanvas = await waitFor("PDF page canvas responds to brightness control", () =>
    client.evaluate(`(() => {
      const canvas = document.querySelector('.textLayer[data-page="1"]')?.parentElement?.querySelector('canvas');
      return canvas && getComputedStyle(canvas).filter.includes('brightness(1.25)')
        ? getComputedStyle(canvas).filter
        : null;
    })()`),
  );
  check("PDF brightness changes the page rendering immediately", brighterCanvas.includes("1.25"));
  const brightnessReset = await client.evaluate(`(() => {
    const popup = document.querySelector('[data-slot="popover-content"]');
    const button = [...(popup?.querySelectorAll('button') ?? [])].find(element =>
      /^(Reset|Đặt lại)$/u.test(element.innerText.trim())
    );
    button?.click();
    return Boolean(button);
  })()`);
  check("PDF brightness has a one-click reset", brightnessReset);
  const normalCanvas = await waitFor("PDF brightness returns to default", () =>
    client.evaluate(`(() => {
      const canvas = document.querySelector('.textLayer[data-page="1"]')?.parentElement?.querySelector('canvas');
      return canvas && getComputedStyle(canvas).filter.includes('brightness(1)')
        ? getComputedStyle(canvas).filter
        : null;
    })()`),
  );
  check(
    "PDF brightness reset restores the default rendering",
    normalCanvas.includes("brightness(1)"),
  );
  const pdfQuickPaperSelected = await client.evaluate(`(() => {
    const popup = document.querySelector('[data-slot="popover-content"]');
    const group = popup?.querySelector(${JSON.stringify(pdfGroup)});
    const button = [...(group?.querySelectorAll('button') ?? [])].find(option =>
      /^(Warm paper|Giấy ấm)$/u.test(option.innerText.trim())
    );
    button?.click();
    return Boolean(button);
  })()`);
  check("PDF warm-paper tone is selectable in the theme menu", pdfQuickPaperSelected);
  const quickPdfBackdrop = await waitFor("PDF quick-menu warm-paper backdrop", () =>
    client.evaluate(`(() => {
      const element = document.querySelector('.reader-scroll-region');
      const color = element ? getComputedStyle(element).backgroundColor : null;
      return color === 'rgb(245, 240, 230)' ? color : null;
    })()`),
  );
  check(
    "theme-menu tone change immediately updates the PDF surround",
    quickPdfBackdrop === "rgb(245, 240, 230)",
  );

  const darkSelected = await client.evaluate(`(() => {
    const button = [...document.querySelectorAll('[data-slot="popover-content"] button[aria-pressed]')]
      .find(element => /^(Dark|Tối)$/u.test(element.innerText.trim()));
    button?.click();
    return Boolean(button);
  })()`);
  check("application theme can be changed independently from PDF appearance", darkSelected);
  await waitFor("dark application theme", () =>
    client.evaluate(`document.documentElement.classList.contains('dark')`),
  );
  check(
    "application theme change keeps the selected PDF tone",
    (await client.evaluate(
      `getComputedStyle(document.querySelector('.reader-scroll-region')).backgroundColor`,
    )) === "rgb(245, 240, 230)",
  );
  const readerPageAfterPopoverChanges = await waitFor(
    "PDF canvas remains rendered after theme/background changes",
    async () => {
      const state = await client.evaluate(pagePaintExpression(1));
      return state?.inkSamples > 0 ? state : null;
    },
    15_000,
    250,
  );
  const samePagePaint =
    ["width", "height", "textLength", "sampledPixels", "opaqueSamples", "inkSamples"].every(
      (key) => readerPageAfterPopoverChanges[key] === initialPagePaint[key],
    ) &&
    readerPageAfterPopoverChanges.canvasAttributes.width ===
      initialPagePaint.canvasAttributes.width &&
    readerPageAfterPopoverChanges.canvasAttributes.height ===
      initialPagePaint.canvasAttributes.height;
  check("PDF page canvas is unchanged by application theme", samePagePaint);

  await client.evaluate(`(() => {
    const trigger = [...document.querySelectorAll('button[aria-label]')].find(element =>
      /^(Application theme|Giao diện ứng dụng):/u.test(element.getAttribute('aria-label') || '')
    );
    trigger?.click();
  })()`);
  const settingsTrigger = await client.evaluate(`(() => {
    const button = [...document.querySelectorAll('button[aria-label]')].find(element =>
      /^(Settings|Cài đặt)$/u.test(element.getAttribute('aria-label') || '')
    );
    button?.click();
    return Boolean(button);
  })()`);
  check("settings can be opened over the reader", settingsTrigger);
  const pdfSettingsCloseTest = await closeSettingsWithPointer("PDF");
  check("PDF settings panel remains easy to close", pdfSettingsCloseTest);
  const settingsReopenedForAppearance = await client.evaluate(`(() => {
    const button = [...document.querySelectorAll('button[aria-label]')].find(element =>
      /^(Settings|Cài đặt)$/u.test(element.getAttribute('aria-label') || '')
    );
    button?.click();
    return Boolean(button);
  })()`);
  check(
    "Settings can be reopened after closing it from the PDF reader",
    settingsReopenedForAppearance,
  );
  const appearanceSection = await waitFor("Appearance settings section", () =>
    client.evaluate(`(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const button = [...(dialog?.querySelectorAll('nav button') ?? [])].find(element =>
        /^(Appearance|Giao diện)$/u.test(element.innerText.trim())
      );
      button?.click();
      return Boolean(button);
    })()`),
  );
  check("Appearance settings open from the reader", appearanceSection);
  await captureAppearanceObservation("settings-overlay-pdf");

  const groups = await client.evaluate(`(() => ({
    epub: document.querySelector('[role="dialog"]')?.querySelector(${JSON.stringify(epubGroup)})?.querySelectorAll('button').length ?? 0,
    pdf: document.querySelector('[role="dialog"]')?.querySelector(${JSON.stringify(pdfGroup)})?.querySelectorAll('button').length ?? 0,
    appBackground: Boolean(document.querySelector('[role="dialog"] input[type="color"][aria-label="Background color"], [role="dialog"] input[type="color"][aria-label="Màu nền"]')),
  }))()`);
  check(
    "PDF Appearance settings show both six-choice format palettes",
    groups.epub === 6 && groups.pdf === 6,
  );
  check("application background remains available in Appearance", groups.appBackground);
  const appearanceHasPdfBrightness = await client.evaluate(`(() => {
    const settingsDialog = [...document.querySelectorAll('[role="dialog"]')].find(dialog =>
      [...dialog.querySelectorAll('nav button')].some(button =>
        /^(Appearance|Giao diện)$/u.test(button.innerText.trim())
      )
    );
    return Boolean(settingsDialog?.querySelector('input[type="range"]'));
  })()`);
  check(
    "PDF brightness is only available in the Application theme menu",
    !appearanceHasPdfBrightness,
  );

  const modes = [
    { labels: ["Original", "Gốc"], expected: "rgb(230, 232, 235)" },
    { labels: ["Warm paper", "Giấy ấm"], expected: "rgb(245, 240, 230)" },
    { labels: ["Sepia"], expected: "rgb(233, 221, 197)" },
    { labels: ["Soft green", "Xanh dịu"], expected: "rgb(228, 236, 227)" },
    { labels: ["Dark", "Tối"], expected: "rgb(21, 24, 28)" },
    { labels: ["System", "Hệ thống"], system: true },
  ];
  const choosePdfMode = async (labels) =>
    client.evaluate(`(() => {
      const group = document.querySelector('[role="dialog"]')?.querySelector(${JSON.stringify(pdfGroup)});
      const labels = ${JSON.stringify(labels)};
      const button = [...(group?.querySelectorAll('button') ?? [])].find(option =>
        labels.includes(option.getAttribute('aria-label') || option.innerText.trim())
      );
      button?.click();
      return Boolean(button);
    })()`);
  const pdfModeSelected = async (labels) =>
    client.evaluate(`(() => {
      const group = document.querySelector('[role="dialog"]')?.querySelector(${JSON.stringify(pdfGroup)});
      const labels = ${JSON.stringify(labels)};
      const button = [...(group?.querySelectorAll('button') ?? [])].find(option =>
        labels.includes(option.getAttribute('aria-label') || option.innerText.trim())
      );
      return button?.getAttribute('aria-pressed') === 'true';
    })()`);

  for (const mode of modes) {
    const selected = await choosePdfMode(mode.labels);
    check(`PDF ${mode.labels[0]} option is selectable`, selected);
    const systemDark = mode.system
      ? await client.evaluate(`window.matchMedia('(prefers-color-scheme: dark)').matches`)
      : false;
    const expected = mode.system
      ? systemDark
        ? "rgb(21, 24, 28)"
        : "rgb(230, 232, 235)"
      : mode.expected;
    const backdrop = await waitFor(`PDF ${mode.labels[0]} backdrop`, () =>
      client.evaluate(`(() => {
        const element = document.querySelector('.reader-scroll-region');
        const color = element ? getComputedStyle(element).backgroundColor : null;
        return color === ${JSON.stringify(expected)} ? color : null;
      })()`),
    );
    check(
      `PDF ${mode.labels[0]} changes the PDF reading backdrop`,
      backdrop === expected,
      backdrop,
    );
    check(
      `PDF ${mode.labels[0]} is the active PDF-only setting`,
      await pdfModeSelected(mode.labels),
    );
    const pageAfterMode = await client.evaluate(pagePaintExpression(1));
    check(
      `PDF ${mode.labels[0]} keeps the rendered page canvas intact`,
      pageAfterMode?.width === initialPagePaint.width &&
        pageAfterMode?.height === initialPagePaint.height &&
        pageAfterMode?.inkSamples === initialPagePaint.inkSamples &&
        pageAfterMode?.opaqueSamples === initialPagePaint.opaqueSamples,
    );
  }
  const epubDarkClicked = await client.evaluate(`(() => {
    const group = document.querySelector('[role="dialog"]')?.querySelector(${JSON.stringify(epubGroup)});
    const option = [...(group?.querySelectorAll('button') ?? [])].find(button =>
      /^(Dark|Tối)$/u.test(button.getAttribute('aria-label') || button.innerText.trim())
    );
    option?.click();
    return Boolean(option);
  })()`);
  check("EPUB tone can be changed from PDF reading settings", epubDarkClicked);
  const epubDarkSelected = await waitFor("EPUB dark tone selection to render", () =>
    client.evaluate(`(() => {
      const group = document.querySelector('[role="dialog"]')?.querySelector(${JSON.stringify(epubGroup)});
      const option = [...(group?.querySelectorAll('button') ?? [])].find(button =>
        /^(Dark|Tối)$/u.test(button.getAttribute('aria-label') || button.innerText.trim())
      );
      return option?.getAttribute('aria-pressed') === 'true';
    })()`),
  );
  check("EPUB dark tone becomes active after rendering", epubDarkSelected);
  check(
    "changing EPUB tone preserves the selected PDF tone",
    await pdfModeSelected(["System", "Hệ thống"]),
  );
  const paperToneSelected = await choosePdfMode(["Warm paper", "Giấy ấm"]);
  check("PDF warm-paper tone can be selected for visual inspection", paperToneSelected);
  const pdfBackdropBeforeAppChange = await waitFor(
    "PDF warm-paper backdrop before app background change",
    () =>
      client.evaluate(`(() => {
      const element = document.querySelector('.reader-scroll-region');
      const color = element ? getComputedStyle(element).backgroundColor : null;
      return color === 'rgb(245, 240, 230)' ? color : null;
    })()`),
  );
  check(
    "PDF surrounding area visibly changes to warm paper",
    pdfBackdropBeforeAppChange === "rgb(245, 240, 230)",
  );

  const settingsColor = "#6d6654";
  const appearanceColorApplied = await waitFor(
    "background color control in Appearance settings",
    () =>
      client.evaluate(`(() => {
      const input = document.querySelector('[role="dialog"] input[type="color"][aria-label="Background color"], [role="dialog"] input[type="color"][aria-label="Màu nền"]');
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, ${JSON.stringify(settingsColor)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return input.value.toLowerCase() === ${JSON.stringify(settingsColor)};
    })()`),
  );
  check("application background color changes from Appearance settings", appearanceColorApplied);

  const readerPageAfterSettings = await client.evaluate(pagePaintExpression(1));
  const readerBackdropAfterSettings = await client.evaluate(`(() => {
    const element = document.querySelector('.reader-scroll-region');
    return element ? getComputedStyle(element).backgroundColor : null;
  })()`);
  const appBackgroundVisibleInReader = await client.evaluate(
    `Boolean(document.querySelector('[aria-hidden="true"].pointer-events-none > div'))`,
  );
  check(
    "application background changes do not affect PDF page, backdrop, or reader surface",
    readerPageAfterSettings?.inkSamples === initialPagePaint.inkSamples &&
      readerPageAfterSettings?.width === initialPagePaint.width &&
      readerPageAfterSettings?.height === initialPagePaint.height &&
      readerBackdropAfterSettings === pdfBackdropBeforeAppChange &&
      !appBackgroundVisibleInReader,
  );

  const pdfCustomColorAdded = await client.evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const heading = [...(dialog?.querySelectorAll('h3') ?? [])].find(element =>
      /^(Custom PDF background colors|Màu nền PDF tùy chỉnh)$/u.test(element.innerText.trim())
    );
    const root = heading?.parentElement?.parentElement;
    const color = root?.querySelector('input[type="color"][aria-label="New PDF background color"], input[type="color"][aria-label="Màu nền PDF mới"]');
    const name = root?.querySelector('input[type="text"][aria-label="New PDF background color name"], input[type="text"][aria-label="Tên màu nền PDF mới"]');
    const hex = root?.querySelector('input[type="text"][aria-label="New PDF background color HEX"], input[type="text"][aria-label="Mã HEX màu nền PDF mới"]');
    const add = [...(root?.querySelectorAll('button') ?? [])].find(button => /^(Add color|Thêm màu)$/u.test(button.innerText.trim()));
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!color || !name || !hex || !add || !setter) return false;
    setter.call(hex, '#d4b9a5');
    hex.dispatchEvent(new Event('input', { bubbles: true }));
    hex.dispatchEvent(new Event('change', { bubbles: true }));
    setter.call(name, 'E2E Mist');
    name.dispatchEvent(new Event('input', { bubbles: true }));
    name.dispatchEvent(new Event('change', { bubbles: true }));
    if (color.value.toLowerCase() !== '#d4b9a5') return false;
    add.click();
    return true;
  })()`);
  check("Appearance can add a named PDF color by entering HEX", pdfCustomColorAdded);
  const pdfCustomColorExists = await waitFor("custom PDF color row is saved", () =>
    client.evaluate(
      `Boolean(document.querySelector('[role="dialog"] input[type="checkbox"][aria-label="Show E2E Mist in the theme menu"], [role="dialog"] input[type="checkbox"][aria-label="Hiện E2E Mist trong menu giao diện"]'))`,
    ),
  );
  check(
    "custom PDF color is available for editing and theme-menu visibility",
    pdfCustomColorExists,
  );

  const pdfCustomColorNameDrafted = await client.evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const visible = [...(dialog?.querySelectorAll('input[type="checkbox"]') ?? [])].find(input =>
      /^(Show E2E Mist in the theme menu|Hiện E2E Mist trong menu giao diện)$/u.test(input.getAttribute('aria-label') || '')
    );
    const row = visible?.parentElement;
    const name = row?.querySelector('input[type="text"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!name || !setter) return false;
    name.focus();
    setter.call(name, 'E2E Sage');
    name.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  check("custom PDF color name accepts a text edit", pdfCustomColorNameDrafted);
  const pdfCustomColorNameDraftedVisible = await waitFor("PDF color name draft renders", () =>
    client.evaluate(`(() => [...document.querySelectorAll('[role="dialog"] input[type="text"]')]
      .some(input => input.value === 'E2E Sage'))()`),
  );
  check("PDF color name draft remains visible after input", pdfCustomColorNameDraftedVisible);

  const pdfCustomColorNameCommitted = await client.evaluate(`(() => {
    const input = [...document.querySelectorAll('[role="dialog"] input[type="text"]')].find(element =>
      element.value === 'E2E Sage'
    );
    input?.blur();
    return Boolean(input);
  })()`);
  check("custom PDF color name can be committed on blur", pdfCustomColorNameCommitted);
  const pdfCustomColorNameSaved = await waitFor("PDF color row uses the edited name", () =>
    client.evaluate(
      `Boolean(document.querySelector('[role="dialog"] input[type="checkbox"][aria-label="Show E2E Sage in the theme menu"], [role="dialog"] input[type="checkbox"][aria-label="Hiện E2E Sage trong menu giao diện"]'))`,
    ),
  );
  check("custom PDF color name updates its saved row", pdfCustomColorNameSaved);

  const pdfCustomColorHexEdited = await client.evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const visible = [...(dialog?.querySelectorAll('input[type="checkbox"]') ?? [])].find(input =>
      /^(Show E2E Sage in the theme menu|Hiện E2E Sage trong menu giao diện)$/u.test(input.getAttribute('aria-label') || '')
    );
    const row = visible?.parentElement;
    const color = row?.querySelector('input[type="color"]');
    const hex = [...(row?.querySelectorAll('input[type="text"]') ?? [])].find(input =>
      /^(HEX value for E2E Sage|Mã HEX của E2E Sage)$/u.test(input.getAttribute('aria-label') || '')
    );
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!color || !hex || !setter) return false;
    hex.focus();
    setter.call(hex, '#cdbbaa');
    hex.dispatchEvent(new Event('input', { bubbles: true }));
    hex.dispatchEvent(new Event('change', { bubbles: true }));
    hex.blur();
    return true;
  })()`);
  check("custom PDF color HEX value can be edited", pdfCustomColorHexEdited);
  const pdfCustomColorHexSaved = await waitFor("HEX edit updates the saved PDF color swatch", () =>
    client.evaluate(`(() => {
        const visible = [...document.querySelectorAll('[role="dialog"] input[type="checkbox"]')].find(input =>
          /^(Show E2E Sage in the theme menu|Hiện E2E Sage trong menu giao diện)$/u.test(input.getAttribute('aria-label') || '')
        );
        return visible?.parentElement?.querySelector('input[type="color"]')?.value.toLowerCase() === '#cdbbaa';
      })()`),
  );
  check("PDF HEX changes are saved to the swatch color", pdfCustomColorHexSaved);
  const pdfCustomColorApplied = await waitFor(
    "updated custom PDF color appears in Appearance",
    () =>
      client.evaluate(`(() => {
      const group = [...document.querySelectorAll('[role="dialog"] [role="group"]')].find(element =>
        /^(Custom PDF background colors|Màu nền PDF tùy chỉnh)$/u.test(element.getAttribute('aria-label') || '')
      );
      return Boolean([...(group?.querySelectorAll('button') ?? [])].find(button => button.getAttribute('aria-label') === 'E2E Sage'));
    })()`),
  );
  check("edited custom PDF color is selectable in Appearance", pdfCustomColorApplied);
  const pdfCustomColorSelected = await client.evaluate(`(() => {
    const group = [...document.querySelectorAll('[role="dialog"] [role="group"]')].find(element =>
      /^(Custom PDF background colors|Màu nền PDF tùy chỉnh)$/u.test(element.getAttribute('aria-label') || '')
    );
    const option = [...(group?.querySelectorAll('button') ?? [])].find(button => button.getAttribute('aria-label') === 'E2E Sage');
    option?.click();
    return Boolean(option);
  })()`);
  check("custom PDF surrounding color can be applied while reading", pdfCustomColorSelected);
  const customBackdrop = await waitFor("custom PDF surround color renders", () =>
    client.evaluate(
      `getComputedStyle(document.querySelector('.reader-scroll-region')).backgroundColor === 'rgb(205, 187, 170)'`,
    ),
  );
  check("custom PDF color changes only the area around the page", customBackdrop);
  const customColorPreservesPdfCanvas = await client.evaluate(pagePaintExpression(1));
  check(
    "custom PDF surrounding color preserves the scanned/text page canvas",
    customColorPreservesPdfCanvas?.width === initialPagePaint.width &&
      customColorPreservesPdfCanvas?.height === initialPagePaint.height &&
      customColorPreservesPdfCanvas?.inkSamples === initialPagePaint.inkSamples &&
      customColorPreservesPdfCanvas?.opaqueSamples === initialPagePaint.opaqueSamples,
  );

  const settingsClosedForThemeMenu = await client.evaluate(`(() => {
    const button = [...document.querySelectorAll('[role="dialog"] button[aria-label]')].find(element =>
      /^(Close settings|Đóng cài đặt)$/u.test(element.getAttribute('aria-label') || '')
    );
    button?.click();
    return Boolean(button);
  })()`);
  check(
    "Appearance settings close before checking the reader theme menu",
    settingsClosedForThemeMenu,
  );
  await waitFor("settings close before custom PDF menu verification", () =>
    client.evaluate(`!document.querySelector('[role="dialog"]')`),
  );
  const customThemeMenuOpened = await client.evaluate(`(() => {
    const button = [...document.querySelectorAll('button[aria-label]')].find(element =>
      /^(Application theme|Giao diện ứng dụng):/u.test(element.getAttribute('aria-label') || '')
    );
    button?.click();
    return Boolean(button);
  })()`);
  check("Application theme menu opens with custom PDF colors available", customThemeMenuOpened);
  const customThemeMenuOption = await waitFor(
    "custom PDF color appears in the reader theme menu",
    () =>
      client.evaluate(`(() => {
      const popup = document.querySelector('[data-slot="popover-content"]');
      const group = [...(popup?.querySelectorAll('[role="group"]') ?? [])].find(element =>
        /^(Custom PDF background colors|Màu nền PDF tùy chỉnh)$/u.test(element.getAttribute('aria-label') || '')
      );
      return [...(group?.querySelectorAll('button') ?? [])].some(button => button.getAttribute('aria-label') === 'E2E Sage');
    })()`),
  );
  check("visible custom PDF color is available in the reader theme menu", customThemeMenuOption);
  const customThemeMenuColorSelected = await client.evaluate(`(() => {
    const popup = document.querySelector('[data-slot="popover-content"]');
    const group = [...(popup?.querySelectorAll('[role="group"]') ?? [])].find(element =>
      /^(Custom PDF background colors|Màu nền PDF tùy chỉnh)$/u.test(element.getAttribute('aria-label') || '')
    );
    const option = [...(group?.querySelectorAll('button') ?? [])].find(button => button.getAttribute('aria-label') === 'E2E Sage');
    option?.click();
    return Boolean(option);
  })()`);
  check("custom PDF color applies from the theme menu", customThemeMenuColorSelected);
  const menuBackdrop = await waitFor("theme-menu custom PDF backdrop", () =>
    client.evaluate(
      `getComputedStyle(document.querySelector('.reader-scroll-region')).backgroundColor === 'rgb(205, 187, 170)'`,
    ),
  );
  check("theme-menu custom PDF color updates the page surround", menuBackdrop);
  await client.evaluate(`(() => {
    const trigger = [...document.querySelectorAll('button[aria-label]')].find(element =>
      /^(Application theme|Giao diện ứng dụng):/u.test(element.getAttribute('aria-label') || '')
    );
    trigger?.click();
  })()`);
  const settingsReopenedForColorCleanup = await client.evaluate(`(() => {
    const button = [...document.querySelectorAll('button[aria-label]')].find(element =>
      /^(Settings|Cài đặt)$/u.test(element.getAttribute('aria-label') || '')
    );
    button?.click();
    return Boolean(button);
  })()`);
  check("settings reopen for custom PDF palette cleanup", settingsReopenedForColorCleanup);
  const appearanceReopenedForColorCleanup = await waitFor(
    "Appearance reopens for PDF palette cleanup",
    () =>
      client.evaluate(`(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const button = [...(dialog?.querySelectorAll('nav button') ?? [])].find(element =>
        /^(Appearance|Giao diện)$/u.test(element.innerText.trim())
      );
      button?.click();
      return Boolean(button && [...(dialog?.querySelectorAll('h3') ?? [])].some(heading =>
        /^(Custom PDF background colors|Màu nền PDF tùy chỉnh)$/u.test(heading.innerText.trim())
      ));
    })()`),
  );
  check("Appearance is active for custom PDF palette cleanup", appearanceReopenedForColorCleanup);

  const pdfCustomColorHidden = await client.evaluate(`(() => {
    const input = [...document.querySelectorAll('[role="dialog"] input[type="checkbox"]')].find(element =>
      /^(Show E2E Sage in the theme menu|Hiện E2E Sage trong menu giao diện)$/u.test(element.getAttribute('aria-label') || '')
    );
    input?.click();
    return Boolean(input);
  })()`);
  check("custom PDF color can be hidden from the theme menu", pdfCustomColorHidden);
  const hiddenPdfColorLeavesPicker = await waitFor(
    "hidden custom color leaves the Appearance picker",
    () =>
      client.evaluate(`!([...document.querySelectorAll('[role="dialog"] [role="group"]')].some(group =>
      /^(Custom PDF background colors|Màu nền PDF tùy chỉnh)$/u.test(group.getAttribute('aria-label') || '') &&
      [...group.querySelectorAll('button')].some(button => button.getAttribute('aria-label') === 'E2E Sage')
    ))`),
  );
  check(
    "hidden custom PDF color is removed from the selectable palette",
    hiddenPdfColorLeavesPicker,
  );
  const pdfCustomColorShownAgain = await client.evaluate(`(() => {
    const input = [...document.querySelectorAll('[role="dialog"] input[type="checkbox"]')].find(element =>
      /^(Show E2E Sage in the theme menu|Hiện E2E Sage trong menu giao diện)$/u.test(element.getAttribute('aria-label') || '')
    );
    input?.click();
    return Boolean(input);
  })()`);
  check("custom PDF color can be shown in the theme menu again", pdfCustomColorShownAgain);

  const highlightPaletteStart = await client.evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const heading = [...(dialog?.querySelectorAll('h3') ?? [])].find(element =>
      /^(Highlight colors|Màu đánh dấu)$/u.test(element.innerText.trim())
    );
    const root = heading?.parentElement?.parentElement;
    return root ? {
      checkboxes: [...root.querySelectorAll('input[type="checkbox"]')].length,
      enabled: [...root.querySelectorAll('input[type="checkbox"]')].filter(input => input.checked).length,
      add: Boolean([...root.querySelectorAll('button')].find(button => /^(Add color|Thêm màu)$/u.test(button.innerText.trim()))),
    } : null;
  })()`);
  check(
    "Appearance starts with six highlight colors enabled on the reader toolbar",
    highlightPaletteStart?.checkboxes === 6 &&
      highlightPaletteStart.enabled === 6 &&
      highlightPaletteStart.add,
    JSON.stringify(highlightPaletteStart),
  );
  const customHighlightAdded = await client.evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const heading = [...(dialog?.querySelectorAll('h3') ?? [])].find(element =>
      /^(Highlight colors|Màu đánh dấu)$/u.test(element.innerText.trim())
    );
    const root = heading?.parentElement?.parentElement;
    const input = root?.querySelector('input[type="text"][aria-label="New highlight color HEX value"], input[type="text"][aria-label="Mã HEX của màu đánh dấu mới"]');
    const add = [...(root?.querySelectorAll('button') ?? [])].find(button => /^(Add color|Thêm màu)$/u.test(button.innerText.trim()));
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!input || !add || !setter) return false;
    setter.call(input, '#12ab34');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    add.click();
    return true;
  })()`);
  check("Appearance can add a custom RGB/HEX highlight color", customHighlightAdded);
  const customHighlightSaved = await waitFor("custom highlight color is saved", () =>
    client.evaluate(`Boolean([...document.querySelectorAll('[role="dialog"] input[type="checkbox"]')].find(input =>
      (input.getAttribute('aria-label') || '').includes('#12ab34')
    ))`),
  );
  check("custom highlight is saved without exceeding the six toolbar slots", customHighlightSaved);
  const customHighlightEdited = await client.evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const input = [...(dialog?.querySelectorAll('input[type="text"]') ?? [])].find(element =>
      (element.getAttribute('aria-label') || '').includes('HEX value for #12ab34') ||
      (element.getAttribute('aria-label') || '').includes('Mã HEX của #12ab34')
    );
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!input || !setter) return false;
    input.focus();
    setter.call(input, '#3456ab');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.blur();
    return true;
  })()`);
  check("custom highlight HEX value can be edited", customHighlightEdited);
  const customHighlightUpdated = await waitFor("edited highlight palette row", () =>
    client.evaluate(`Boolean([...document.querySelectorAll('[role="dialog"] input[type="checkbox"]')].find(input =>
      (input.getAttribute('aria-label') || '').includes('#3456ab')
    ))`),
  );
  check("edited highlight color replaces its previous value", customHighlightUpdated);
  const customHighlightCanBeEnabled = await client.evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const checkboxes = [...(dialog?.querySelectorAll('input[type="checkbox"]') ?? [])];
    const custom = checkboxes.find(input => (input.getAttribute('aria-label') || '').includes('#3456ab'));
    const firstEnabled = checkboxes.find(input => input.checked);
    if (!custom || !firstEnabled) return false;
    firstEnabled.click();
    custom.click();
    return true;
  })()`);
  check(
    "user can replace one toolbar color with a custom highlight color",
    customHighlightCanBeEnabled,
  );
  const customHighlightToolbarCount = await client.evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const heading = [...(dialog?.querySelectorAll('h3') ?? [])].find(element =>
      /^(Highlight colors|Màu đánh dấu)$/u.test(element.innerText.trim())
    );
    return [...(heading?.parentElement?.parentElement?.querySelectorAll('input[type="checkbox"]') ?? [])]
      .filter(input => input.checked).length;
  })()`);
  check(
    "reader toolbar keeps exactly six enabled highlight colors",
    customHighlightToolbarCount === 6,
  );
  const customHighlightDeleted = await client.evaluate(`(() => {
    const button = [...document.querySelectorAll('[role="dialog"] button[aria-label]')].find(element =>
      /^(Delete #3456ab highlight color|Xóa màu đánh dấu #3456ab)$/u.test(element.getAttribute('aria-label') || '')
    );
    button?.click();
    return Boolean(button);
  })()`);
  check("custom highlight color can be deleted", customHighlightDeleted);
  const toolbarRestored = await client.evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const heading = [...(dialog?.querySelectorAll('h3') ?? [])].find(element =>
      /^(Highlight colors|Màu đánh dấu)$/u.test(element.innerText.trim())
    );
    const checkboxes = [...(heading?.parentElement?.parentElement?.querySelectorAll('input[type="checkbox"]') ?? [])];
    const first = checkboxes.find(input => !input.checked);
    first?.click();
    const updated = [...(heading?.parentElement?.parentElement?.querySelectorAll('input[type="checkbox"]') ?? [])];
    return updated.filter(input => input.checked).length;
  })()`);
  check(
    "deleting a custom color leaves the default six toolbar slots usable",
    toolbarRestored === 6,
  );

  const pdfCustomColorDeleted = await client.evaluate(`(() => {
    const button = [...document.querySelectorAll('[role="dialog"] button[aria-label]')].find(element =>
      /^(Remove E2E Sage|Xóa E2E Sage)$/u.test(element.getAttribute('aria-label') || '')
    );
    button?.click();
    return Boolean(button);
  })()`);
  check("custom PDF surrounding color can be deleted", pdfCustomColorDeleted);
  const pdfPaletteCleanup = await waitFor("custom PDF color removed from Appearance", () =>
    client.evaluate(`!([...document.querySelectorAll('[role="dialog"] input[type="checkbox"]')].some(input =>
      (input.getAttribute('aria-label') || '').includes('E2E Sage')
    ))`),
  );
  check("deleted custom PDF color leaves no stale visibility control", pdfPaletteCleanup);
  const warmPaperRestored = await client.evaluate(`(() => {
    const group = document.querySelector('[role="dialog"]')?.querySelector(${JSON.stringify(pdfGroup)});
    const option = [...(group?.querySelectorAll('button') ?? [])].find(button =>
      /^(Warm paper|Giấy ấm)$/u.test(button.innerText.trim())
    );
    option?.click();
    return Boolean(option);
  })()`);
  check("PDF paper tone remains available after custom-color CRUD", warmPaperRestored);

  const settingsClosed = await client.evaluate(`(() => {
    const button = [...document.querySelectorAll('button[aria-label]')].find(element =>
      /^(Close settings|Đóng cài đặt)$/u.test(element.getAttribute('aria-label') || '')
    );
    button?.click();
    return Boolean(button);
  })()`);
  check("Appearance settings close after editing", settingsClosed);
  await waitFor("PDF Appearance settings to close", () =>
    client.evaluate(`!document.querySelector('[role="dialog"]')`),
  );
  await captureAppearanceObservation("pdf-warm-paper");

  const returnedToLibrary = await client.evaluate(`(() => {
    const button = [...document.querySelectorAll('button[aria-label]')].find(element =>
      /^(Library|Thư viện)$/u.test(element.getAttribute('aria-label') || '')
    );
    button?.click();
    return Boolean(button);
  })()`);
  check("reader returns to the library after checking page isolation", returnedToLibrary);

  const libraryColor = await waitFor("application background updates in the library", () =>
    client.evaluate(`(() => {
      const layer = document.querySelector('[aria-hidden="true"].pointer-events-none > div');
      if (!layer) return null;
      const color = getComputedStyle(layer).backgroundColor;
      return color === 'rgb(109, 102, 84)' ? color : null;
    })()`),
  );
  check(
    "Appearance settings color is visible immediately in the library",
    libraryColor === "rgb(109, 102, 84)",
  );

  const libraryThemeTrigger = await client.evaluate(`(() => {
    const trigger = [...document.querySelectorAll('button[aria-label]')].find(element =>
      /^(Application theme|Giao diện ứng dụng):/u.test(element.getAttribute('aria-label') || '')
    );
    trigger?.click();
    return Boolean(trigger);
  })()`);
  check("Application theme menu can be opened in the library", libraryThemeTrigger);
  const libraryThemeMenu = await waitFor("library application theme menu", () =>
    client.evaluate(`(() => {
    const popup = document.querySelector('[data-slot="popover-content"]');
    return popup
      ? {
          theme: [...popup.querySelectorAll('[role="group"]')]
            .find(group => /^(Application theme|Giao diện ứng dụng)$/u.test(group.getAttribute('aria-label') || ''))
            ?.querySelectorAll('button[aria-pressed]').length ?? 0,
          epub: popup.querySelector(${JSON.stringify(epubGroup)})?.querySelectorAll('button').length ?? 0,
          pdf: popup.querySelector(${JSON.stringify(pdfGroup)})?.querySelectorAll('button').length ?? 0,
        }
      : null;
  })()`),
  );
  check(
    "library theme menu shows application theme without book-specific tones",
    libraryThemeMenu?.theme === 3 && libraryThemeMenu.epub === 0 && libraryThemeMenu.pdf === 0,
  );
  await client.evaluate(
    `document.querySelector('[data-slot="popover-trigger"][aria-expanded="true"]')?.click()`,
  );

  const librarySettingsTrigger = await client.evaluate(`(() => {
    const button = [...document.querySelectorAll('button[aria-label]')].find(element =>
      /^(Settings|Cài đặt)$/u.test(element.getAttribute('aria-label') || '')
    );
    button?.click();
    return Boolean(button);
  })()`);
  check("Settings opens in the library", librarySettingsTrigger);
  const libraryAppearance = await client.evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const button = [...(dialog?.querySelectorAll('nav button') ?? [])].find(element =>
      /^(Appearance|Giao diện)$/u.test(element.innerText.trim())
    );
    button?.click();
    return Boolean(button);
  })()`);
  check("Application background controls are in the Appearance section", libraryAppearance);
  const libraryFormatPalettes = await client.evaluate(`(() => ({
    epub: document.querySelector(${JSON.stringify(epubGroup)})?.querySelectorAll('button').length ?? 0,
    pdf: document.querySelector(${JSON.stringify(pdfGroup)})?.querySelectorAll('button').length ?? 0,
  }))()`);
  check(
    "library Appearance shows defaults for both formats when no book is active",
    libraryFormatPalettes.epub === 6 && libraryFormatPalettes.pdf === 6,
  );

  const selectedImage = await client.evaluate(`(() => {
    const input = document.querySelector('[role="dialog"] input[type="file"]');
    if (!input) return false;
    const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jUoUAAAAASUVORK5CYII='), char => char.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], 'e2e-background.png', { type: 'image/png' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  check("background image can be selected through the packaged UI", selectedImage);
  const imageActive = await waitFor("saved image becomes the active library background", () =>
    client.evaluate(`(() => {
      const layer = document.querySelector('[aria-hidden="true"].pointer-events-none > div');
      const status = [...document.querySelectorAll('span')].some(element =>
        /This background image is active|Đang dùng ảnh nền này/u.test(element.innerText)
      );
      return layer?.style.backgroundImage.includes('media://blob/') && status
        ? layer.style.backgroundImage
        : null;
    })()`),
  );
  check(
    "chosen image is stored and applied to the library background",
    imageActive?.includes("media://blob/"),
  );

  const colorAfterImage = await client.evaluate(`(() => {
    const input = document.querySelector('[role="dialog"] input[type="color"][aria-label="Background color"], [role="dialog"] input[type="color"][aria-label="Màu nền"]');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, '#3a5947');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return input.value.toLowerCase() === '#3a5947';
  })()`);
  check("background can switch from saved image back to a solid color", colorAfterImage);
  const savedImageAction = await client.evaluate(`(() => {
    const button = [...document.querySelectorAll('[role="dialog"] button')].find(element =>
      /^(Use saved image|Dùng ảnh đã lưu)$/u.test(element.innerText.trim())
    );
    button?.click();
    return Boolean(button);
  })()`);
  check("saved background image can be restored from Appearance settings", savedImageAction);
  await waitFor("restored saved image background", () =>
    client.evaluate(
      `document.querySelector('[aria-hidden="true"].pointer-events-none > div')?.style.backgroundImage.includes('media://blob/')`,
    ),
  );

  const reset = await client.evaluate(`(() => {
    const button = [...document.querySelectorAll('[role="dialog"] button[aria-label]')].find(element =>
      /^(Reset|Đặt lại)$/u.test(element.getAttribute('aria-label') || '')
    );
    button?.click();
    return Boolean(button);
  })()`);
  check("Reset control removes the custom background", reset);
  const backgroundReset = await waitFor("default library background after reset", () =>
    client.evaluate(`!document.querySelector('[aria-hidden="true"].pointer-events-none > div')`),
  );
  check("reset restores the default library background", backgroundReset);
  const darkThemePreserved = await client.evaluate(
    `document.documentElement.classList.contains('dark')`,
  );
  check("resetting the background leaves the application theme unchanged", darkThemePreserved);
}

async function closeApp() {
  if (!child) return;
  const launchedApp = child;
  if (client) {
    try {
      await client.call("Browser.close", {}, 3_000);
    } catch {
      // Browser.close normally closes the CDP socket before returning a reply.
    }
  }
  client?.close();
  if (launchedApp.exitCode == null) {
    await Promise.race([new Promise((resolve) => launchedApp.once("exit", resolve)), sleep(3_000)]);
  }
  if (launchedApp.exitCode == null && process.platform === "win32") {
    const result = spawnSync("taskkill.exe", ["/PID", String(launchedApp.pid), "/T", "/F"], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.status !== 0) {
      console.warn(
        `Could not stop packaged E2E process tree (exit ${String(result.status)}): ${(result.stderr || result.stdout || "no details").trim().slice(0, 400)}`,
      );
    }
  } else if (launchedApp.exitCode == null) {
    launchedApp.kill("SIGTERM");
  }
  child = null;
}

async function removeProfileSafely() {
  if (!profilePath) return;
  const tempRoot = path.resolve(tmpdir());
  const target = path.resolve(profilePath);
  if (
    !target.startsWith(`${tempRoot}${path.sep}`) ||
    !path.basename(target).startsWith(e2ePrefix)
  ) {
    throw new Error("Refusing to remove a test profile outside the dedicated temp directory");
  }
  const deadline = Date.now() + 10_000;
  while (true) {
    try {
      await rm(target, { recursive: true, force: true });
      return true;
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : null;
      if (["EBUSY", "EPERM", "ENOTEMPTY"].includes(code) && Date.now() < deadline) {
        await sleep(250);
        continue;
      }
      console.warn(`Could not remove the E2E profile (${String(code ?? error)}); retaining it.`);
      return false;
    }
  }
}

async function main() {
  if (args.has("help")) {
    console.log(
      "Usage: node scripts/e2e-packaged-pdf.mjs [--sample=<absolute-pdf-or-epub-path>] [--exe=<absolute-exe-path>] [--app-root=<built-app-root>] [--capture] [--capture-pages] [--keep-profile] [--background-only] [--pinch-only] [--thumbnails-only] [--layout-only] [--disable-gpu] [--no-sandbox]",
    );
    console.log(
      "Starts the packaged EXE, or Electron with a built app root, using a fresh temporary profile.",
    );
    return;
  }
  if (typeof WebSocket !== "function") {
    throw new Error("Run this E2E script with Node.js 21 or newer (built-in WebSocket support)");
  }
  if (!existsSync(exePath)) throw new Error(`Electron executable not found: ${exePath}`);
  if (appRoot && !existsSync(appRoot)) throw new Error(`Built app root not found: ${appRoot}`);
  if (!samplePath) {
    throw new Error(
      "No sample file specified. Pass --sample=<absolute-pdf-or-epub-path>.",
    );
  }
  if (!existsSync(samplePath)) {
    throw new Error(
      `Sample file not found: ${samplePath}. Pass --sample=<absolute-pdf-or-epub-path>.`,
    );
  }
  if (![".pdf", ".epub"].includes(sampleExtension)) {
    throw new Error(`Unsupported sample format: ${sampleExtension}. Use a PDF or EPUB file.`);
  }
  if (backgroundOnly && sampleExtension !== ".pdf") {
    throw new Error(
      "--background-only requires a PDF sample so page-canvas isolation can be verified",
    );
  }
  profilePath = await mkdtemp(path.join(tmpdir(), e2ePrefix));
  const port = await freePort();
  child = spawn(
    exePath,
    [
      `--user-data-dir=${profilePath}`,
      `--remote-debugging-port=${port}`,
      ...(noSandbox ? ["--no-sandbox"] : []),
      ...(disableGpu
        ? ["--disable-gpu", "--disable-gpu-compositing", "--use-gl=swiftshader", "--in-process-gpu"]
        : []),
      "--e2e-unthrottled-pdf",
      ...(appRoot ? [appRoot, samplePath] : [samplePath]),
    ],
    { stdio: "ignore" },
  );
  const target = await waitForTarget(port);
  client = await CdpClient.connect(target.webSocketDebuggerUrl);
  await client.call("Runtime.enable");
  await client.call("Page.enable");
  await client
    .call("Emulation.setPageVisibilityOverride", { visibilityState: "visible" })
    .catch(() => {});
  await client.call("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
  await client.call("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await client.call("Page.bringToFront");

  if (sampleExtension === ".epub") {
    await runEpubAppearanceChecks();
    return;
  }

  const readingState = await waitFor("imported PDF start screen", () =>
    client.evaluate(`(() => {
      const start = [...document.querySelectorAll('button')].find(button =>
        ['Start reading', 'Bắt đầu đọc'].includes(button.innerText.trim())
      );
      return start ? 'start' : document.querySelector('.textLayer[data-page]') ? 'reading' : null;
    })()`),
  );
  if (readingState === "start") {
    await client.evaluate(`(() => {
      const start = [...document.querySelectorAll('button')].find(button =>
        ['Start reading', 'Bắt đầu đọc'].includes(button.innerText.trim())
      );
      start?.click();
      return Boolean(start);
    })()`);
  }
  const rendered = await waitFor(
    "sample PDF canvas",
    () => client.evaluate(`document.querySelectorAll('.reader-scroll-region canvas').length > 0`),
    60_000,
  );
  check("packaged EXE renders the sample PDF", rendered, path.basename(samplePath));

  const jbig2Asset =
    await client.evaluate(`fetch(new URL('wasm/jbig2.wasm', document.baseURI)).then(async response => ({
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    byteLength: (await response.arrayBuffer()).byteLength,
  }))`);
  check(
    "packaged EXE serves PDF.js JBIG2 decoder",
    jbig2Asset.status === 200 &&
      jbig2Asset.contentType.includes("application/wasm") &&
      jbig2Asset.byteLength > 0,
    `${jbig2Asset.status}, ${jbig2Asset.contentType}, ${jbig2Asset.byteLength} bytes`,
  );

  const firstPagePaint = await waitFor(
    "initialized first-page canvas",
    async () => {
      const state = await client.evaluate(pagePaintExpression(1));
      return state?.canvasAttributes.width && state?.canvasAttributes.height ? state : null;
    },
    30_000,
    250,
  );
  check(
    "first PDF page contains painted content",
    firstPagePaint.inkSamples > 0,
    `${firstPagePaint.width}×${firstPagePaint.height}, text ${firstPagePaint.textLength} chars, ${firstPagePaint.opaqueSamples}/${firstPagePaint.sampledPixels} opaque and ${firstPagePaint.inkSamples} ink samples`,
  );
  if (layoutOnly) await verifyReaderLayout();
  if (backgroundOnly) {
    await runApplicationBackgroundChecks(firstPagePaint);
    console.log(`\n${checks.length} packaged application background E2E checks passed.`);
    return;
  }
  if (layoutOnly) {
    console.log(`\n${checks.length} reader layout checks passed.`);
    return;
  }

  if (!layoutOnly) {
    // Exercise collapsible panes only after the first page has painted. This
    // protects the virtualized reader from startup-time layout changes.
    await verifyReaderLayout();
    const paintAfterSidebarChanges = await waitFor(
      "first PDF page remains painted after sidebar changes",
      async () => {
        const state = await client.evaluate(pagePaintExpression(1));
        return state?.inkSamples > 0 ? state : null;
      },
      15_000,
      250,
    );
    check(
      "sidebar collapse and restore preserve rendered PDF pixels",
      paintAfterSidebarChanges.inkSamples > 0,
      `${paintAfterSidebarChanges.inkSamples} ink samples after layout changes`,
    );
  }

  if (pinchOnly) {
    const initialPage = await waitFor("virtualized PDF reader", () =>
      client.evaluate(zoomAnchorExpression()),
    );
    if (pinchNotesPanel) {
      const toolsOpened = await client.evaluate(`(() => {
        const button = [...document.querySelectorAll('button[aria-label]')].find(element =>
          /^(Reader tools|Công cụ đọc)$/u.test(element.getAttribute('aria-label') || '')
        );
        button?.click();
        return Boolean(button);
      })()`);
      if (!toolsOpened) throw new Error("Could not open the Reader tools menu for the pinch setup");
      const notesOpened = await waitFor("Reader tools notes item", () =>
        client.evaluate(`(() => {
          const item = [...document.querySelectorAll('[role="menuitem"]')].find(element =>
            /^(Notes|Ghi chú|Book notes|Ghi chú sách)$/u.test(element.innerText.trim())
          );
          item?.click();
          return Boolean(item);
        })()`),
      );
      if (!notesOpened) throw new Error("Could not select Book notes for the pinch setup");
      const notesPanel = await waitFor("right-side Book notes panel", () =>
        client.evaluate(`(() => {
          const title = [...document.querySelectorAll('h2')].find(element =>
            /^(Notes|Ghi chú|Book notes|Ghi chú sách)$/u.test(element.innerText.trim())
          );
          if (!title) return null;
          const scroller = document.querySelector('.reader-scroll-region');
          const panel = title.closest('.flex.h-full');
          return {
            title: title.innerText.trim(),
            windowWidth: window.innerWidth,
            readerWidth: scroller?.getBoundingClientRect().width ?? null,
            panelWidth: panel?.getBoundingClientRect().width ?? null,
          };
        })()`),
      );
      check(
        "pinch setup opens the right-side notes panel",
        notesPanel.readerWidth != null && notesPanel.readerWidth < notesPanel.windowWidth,
        `${notesPanel.title}; reader ${notesPanel.readerWidth}px; panel ${notesPanel.panelWidth}px`,
      );
    }
    if (pinchPage && Number.isInteger(pinchPage) && pinchPage > 0) {
      const scrollTarget = await client.evaluate(`(() => {
        const scroller = document.querySelector('.reader-scroll-region');
        const headerText = document.querySelector('header')?.innerText ?? '';
        const pageCount = Number(headerText.match(/\\/\\s*(\\d+)/u)?.[1] ?? 0);
        if (!scroller || pageCount < ${pinchPage}) return null;
        const top = (scroller.scrollHeight - scroller.clientHeight) * (${pinchPage} - 1) / (pageCount - 1);
        scroller.scrollTo({ top, behavior: 'instant' });
        return { top, pageCount };
      })()`);
      if (!scrollTarget) throw new Error(`Could not position the PDF reader at page ${pinchPage}`);
      console.log(`PINCH_SETUP  page ${initialPage.page} → page ${pinchPage} near its top`);
      await waitFor(`page ${pinchPage} text layer`, () =>
        client.evaluate(
          `Boolean(document.querySelector('.reader-scroll-region .textLayer[data-page="${pinchPage}"]'))`,
        ),
      );
      await client.evaluate(`(() => {
        const scroller = document.querySelector('.reader-scroll-region');
        const page = scroller?.querySelector('.textLayer[data-page="${pinchPage}"]');
        if (!scroller || !page) return null;
        const viewport = scroller.getBoundingClientRect();
        const pageRect = page.getBoundingClientRect();
        const anchorY = viewport.top + viewport.height * 0.42;
        const targetTop = anchorY - 12;
        scroller.scrollTop += pageRect.top - targetTop;
        return { targetPage: ${pinchPage}, targetTop, viewportTop: viewport.top };
      })()`);
      const positioned = await waitFor(`near-top pinch anchor on page ${pinchPage}`, () =>
        client.evaluate(`(() => {
          const anchor = ${zoomAnchorExpression()};
          return anchor?.page === ${pinchPage} && anchor.ratio >= 0 && anchor.ratio <= 0.04
            ? anchor
            : null;
        })()`),
      );
      check(
        `pinch setup positions the cursor near the top of page ${pinchPage}`,
        positioned.page === pinchPage && positioned.ratio <= 0.04,
        `point ${positioned.ratio.toFixed(3)}; page height ${positioned.height.toFixed(1)}`,
      );
    } else {
      const scrollTarget = await client.evaluate(`(() => {
        const scroller = document.querySelector('.reader-scroll-region');
        if (!scroller) return null;
        const top = Math.max(0, Math.floor((scroller.scrollHeight - scroller.clientHeight) * 0.55));
        scroller.scrollTo({ top, behavior: 'instant' });
        return { top, scrollHeight: scroller.scrollHeight };
      })()`);
      console.log(
        `PINCH_SETUP  page ${initialPage.page} → mid-document scrollTop ${scrollTarget?.top}`,
      );
      const midDocumentPage = await waitFor(
        "mid-document PDF page under the touchpad zoom anchor",
        () =>
          client
            .evaluate(zoomAnchorExpression())
            .then((anchor) => (anchor && anchor.page > initialPage.page ? anchor : null)),
        30_000,
      );
      const midPagePaint = await waitFor(
        "painted PDF pixels on a mid-document page",
        async () => {
          const state = await client.evaluate(pagePaintExpression(midDocumentPage.page));
          return state?.inkSamples > 0 ? state : null;
        },
        30_000,
        250,
      );
      check(
        "mid-document PDF page contains painted content",
        midPagePaint.inkSamples > 0,
        `page ${midDocumentPage.page}: ${midPagePaint.inkSamples} ink samples`,
      );
    }
    await checkPinchZoom();
    console.log(`\n${checks.length} packaged E2E checks passed.`);
    return;
  }

  if (thumbnailsOnly) {
    const pagesTabActivated = await client.evaluate(`(() => {
      const pages = [...document.querySelectorAll('[role="tab"]')]
        .find(tab => ['Pages', 'Trang'].includes(tab.getAttribute('aria-label') || ''));
      pages?.click();
      return Boolean(pages);
    })()`);
    check("Pages tab opens thumbnails inside the navigation sidebar", pagesTabActivated);
    if (capturePages) {
      await sleep(500);
      const screenshot = await client.call("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
      });
      const screenshotPath = path.join(profilePath, "pages-view.png");
      await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
      console.log(`SCREENSHOT  ${screenshotPath}`);
    }
    const pagesState = await waitFor("active Pages sidebar", () =>
      client.evaluate(`(() => {
        const pages = [...document.querySelectorAll('[role="tab"]')]
          .find(tab => ['Pages', 'Trang'].includes(tab.getAttribute('aria-label') || ''));
        const active = pages?.getAttribute('aria-selected') === 'true' || pages?.getAttribute('data-active') === 'true';
        const thumbs = [...document.querySelectorAll('button[aria-label]')]
          .filter(button => /^Go to page \\d+$|^Đến trang \\d+$/u.test(button.getAttribute('aria-label') || '')).length;
        return active && thumbs > 0 ? { active, thumbs } : null;
      })()`),
    );
    check(
      "Pages sidebar renders only the visible page thumbnails",
      pagesState.thumbs > 0,
      `${pagesState.thumbs} visible rows`,
    );
    console.log(`\n${checks.length} packaged thumbnail E2E checks passed.`);
    return;
  }

  const openedFind = await clickFindButton();
  check("PDF find panel opens", openedFind);
  await waitFor("PDF search field", () =>
    client.evaluate(
      `Boolean(document.querySelector('input[placeholder="Find in PDF"], input[placeholder="Tìm trong PDF"]'))`,
    ),
  );
  const wholeWordDefault = await client.evaluate(`(() => {
    const button = [...document.querySelectorAll('button[aria-pressed]')].find(element =>
      /Whole word|Đúng từ/u.test(element.innerText || element.getAttribute('aria-label') || '')
    );
    return button?.getAttribute('aria-pressed') === 'true';
  })()`);
  check("PDF find defaults to whole-word matching", wholeWordDefault);
  await client.evaluate(`(() => {
    const input = document.querySelector('input[placeholder="Find in PDF"], input[placeholder="Tìm trong PDF"]');
    input?.focus();
    return Boolean(input);
  })()`);
  await client.call("Input.insertText", { text: "the" });
  const page13Match = await waitFor(
    "search result for page 13",
    () =>
      client.evaluate(`(() => {
      const input = document.querySelector('input[placeholder="Find in PDF"], input[placeholder="Tìm trong PDF"]');
      const panel = input?.closest('section');
      const row = [...(panel?.querySelectorAll('button') ?? [])].find(button =>
        /^(?:Page|Trang)\\s+13(?!\\d)/u.test(button.innerText.trim())
      );
      return row ? row.innerText.trim().slice(0, 7) : null;
    })()`),
    120_000,
  );
  check("full-text search returns page 13", page13Match != null, "query: the");
  const searchEmphasis = await client.evaluate(`(() => {
    const input = document.querySelector('input[placeholder="Find in PDF"], input[placeholder="Tìm trong PDF"]');
    const panel = input?.closest('section');
    const isWordCharacter = value => /[\\p{L}\\p{N}_]/u.test(value || '');
    const highlights = [...(panel?.querySelectorAll('strong') ?? [])];
    const exactWholeWord = highlights.every(element => {
      const siblings = [...(element.parentNode?.childNodes ?? [])];
      const index = siblings.indexOf(element);
      const before = siblings.slice(0, index).map(node => node.textContent || '').join('').slice(-1);
      const after = siblings.slice(index + 1).map(node => node.textContent || '').join('').slice(0, 1);
      return element.textContent?.trim().toLowerCase() === 'the' &&
        !isWordCharacter(before) && !isWordCharacter(after);
    });
    return { count: highlights.length, exactWholeWord };
  })()`);
  check(
    "search results emphasize exact whole-word matches",
    searchEmphasis.count > 0 && searchEmphasis.exactWholeWord,
    `${searchEmphasis.count} emphasized occurrence(s)`,
  );
  await client.evaluate(`document.body.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true,
    pointerType: 'mouse',
  }))`);
  const searchHiddenOutside = await waitFor("search panel hides after an outside pointerdown", () =>
    client.evaluate(
      `!document.querySelector('input[placeholder="Find in PDF"], input[placeholder="Tìm trong PDF"]')`,
    ),
  );
  check("outside click hides the PDF search panel", searchHiddenOutside);
  const reopenedFind = await clickFindButton();
  check("PDF search can be reopened after an outside click", reopenedFind);
  const retainedQuery = await waitFor("search query survives closing the panel", () =>
    client.evaluate(`(() => {
      const input = document.querySelector('input[placeholder="Find in PDF"], input[placeholder="Tìm trong PDF"]');
      return input?.value === 'the' ? input.value : null;
    })()`),
  );
  check("reopened PDF search keeps the previous keyword", retainedQuery === "the", retainedQuery);
  const restoredPage13Match = await waitFor("restored search result for page 13", () =>
    client.evaluate(`(() => {
      const input = document.querySelector('input[placeholder="Find in PDF"], input[placeholder="Tìm trong PDF"]');
      const panel = input?.closest('section');
      const row = [...(panel?.querySelectorAll('button') ?? [])].find(button =>
        /^(?:Page|Trang)\\s+13(?!\\d)/u.test(button.innerText.trim())
      );
      return row ? row.innerText.trim().slice(0, 7) : null;
    })()`),
  );
  check("search results return after reopening the panel", restoredPage13Match != null);
  const clickedResult = await client.evaluate(`(() => {
    const input = document.querySelector('input[placeholder="Find in PDF"], input[placeholder="Tìm trong PDF"]');
    const panel = input?.closest('section');
    const row = [...(panel?.querySelectorAll('button') ?? [])].find(button =>
      /^(?:Page|Trang)\\s+13(?!\\d)/u.test(button.innerText.trim())
    );
    row?.click();
    return Boolean(row);
  })()`);
  check("page 13 result can be opened", clickedResult);
  const pageState = await waitFor(
    "search target and page header agreement",
    async () => {
      const state = await client.evaluate(currentPageExpression());
      return state.visiblePage === 13 && state.headerPage === 13 ? state : null;
    },
    20_000,
    200,
  );
  check(
    "search target and page label stay in sync",
    pageState?.visiblePage === 13 && pageState?.headerPage === 13,
  );

  await client.evaluate(`document.body.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true,
    pointerType: 'mouse',
  }))`);
  const searchClosedBeforeNavigation = await waitFor(
    "search panel closes before sidebar navigation",
    () =>
      client.evaluate(
        `!document.querySelector('input[placeholder="Find in PDF"], input[placeholder="Tìm trong PDF"]')`,
      ),
  );
  check("search panel closes before navigating to Pages", searchClosedBeforeNavigation);

  const libraryBooks = await client.evaluate("window.api.library.list()");
  const book = libraryBooks.find((item) => item.format === "pdf") || libraryBooks[0];
  if (!book?.id) throw new Error("Could not find the imported sample book through the app API");
  const savedProgress = await waitFor(
    "saved page 13 progress",
    async () => {
      const state =
        await client.evaluate(`window.api.progress.get({bookId:${JSON.stringify(book.id)}}).then(progress => {
      const locator = typeof progress?.locator === 'string' ? progress.locator : '';
      const prefixIndex = locator.indexOf('{');
      let page = null;
      try { page = prefixIndex >= 0 ? JSON.parse(locator.slice(prefixIndex)).page ?? null : null; } catch {}
      return { hasProgress: Boolean(progress), hasLocator: locator.length > 0, page };
    })`);
      lastProgressState = state;
      return state.page === 13 ? state : null;
    },
    10_000,
    400,
  );
  check("search jump saves page 13 progress", savedProgress.page === 13);

  const addBookmark = await client.evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(element =>
      ['Add bookmark', 'Thêm dấu trang'].includes(element.getAttribute('aria-label') || '')
    );
    button?.click();
    return Boolean(button);
  })()`);
  check("bookmark editor opens", addBookmark);
  const bookmarkForm = await waitFor("required bookmark note field", () =>
    client.evaluate(`(() => {
      const field = document.querySelector('#pdf-bookmark-note');
      const save = field?.closest('form')?.querySelector('button[type="submit"]');
      return field ? { required: field.required, disabledWhenEmpty: Boolean(save?.disabled) } : null;
    })()`),
  );
  check("bookmark requires user note", bookmarkForm.required && bookmarkForm.disabledWhenEmpty);
  const note = `E2E reading note ${Date.now()}`;
  await client.evaluate(`document.querySelector('#pdf-bookmark-note')?.focus()`);
  await client.call("Input.insertText", { text: note });
  await client.evaluate(
    `document.querySelector('#pdf-bookmark-note')?.closest('form')?.querySelector('button[type="submit"]')?.click()`,
  );
  const savedBookmark = await waitFor(
    "saved bookmark note",
    async () => {
      const bookmarks = await client.evaluate(
        `window.api.library.bookmarks.list({bookId:${JSON.stringify(book.id)}})`,
      );
      const match = bookmarks.find((item) => item.title === note);
      return match ? { page: match.page, titleMatches: match.title === note } : null;
    },
    10_000,
    400,
  );
  check(
    "bookmark stores the user's note and page",
    savedBookmark.page === 13 && savedBookmark.titleMatches,
  );

  await client.evaluate(
    `(async () => {
    const bookId = ${JSON.stringify(book.id)};
    await Promise.all([
      window.api.annotations.create({
        bookId,
        style: 'yellow',
        note: 'E2E annotation note',
        selectedText: 'E2E selected passage',
        locatorRange: 'page:1',
      }),
      window.api.vocabulary.savePhrase({
        bookId,
        term: 'runtime behavior sample',
        meaning: 'E2E vocabulary entry',
        context: 'E2E context',
        sourcePage: 1,
      }),
      window.api.bookNotes.create({ bookId, content: 'E2E standalone book note' }),
      window.api.library.bookmarks.create({
        bookId,
        title: 'E2E category bookmark',
        page: 1,
        scrollRatio: 0,
      }),
    ]);
  })()`,
    20_000,
  );
  await client.evaluate(`window.api.preferences.set({ key: "restorePdfTabs", value: false })`);
  await client.call("Page.reload", { ignoreCache: true });
  await sleep(2_500);
  const seededBookCard = await waitFor("seeded PDF book card after app reload", () =>
    client.evaluate(`(() => {
      const title = ${JSON.stringify(book.title ?? book.id)};
      const button = [...document.querySelectorAll('button[aria-label]')].find(element =>
        (element.getAttribute('aria-label') || '').startsWith(title)
      );
      button?.click();
      return Boolean(button);
    })()`),
  );
  check("seeded PDF book reopens from the library after reload", seededBookCard);
  const seededBookStart = await waitFor("seeded PDF reading screen", () =>
    client.evaluate(`(() => {
      const start = [...document.querySelectorAll('button')].find(button =>
        ['Start reading', 'Bắt đầu đọc'].includes(button.innerText.trim())
      );
      if (start) return 'start';
      return document.querySelector('.textLayer[data-page]') ? 'reading' : null;
    })()`),
  );
  if (seededBookStart === "start") {
    await client.evaluate(`(() => {
      const start = [...document.querySelectorAll('button')].find(button =>
        ['Start reading', 'Bắt đầu đọc'].includes(button.innerText.trim())
      );
      start?.click();
      return Boolean(start);
    })()`);
  }
  const seededReaderRendered = await waitFor(
    "seeded PDF reader after reload",
    () => client.evaluate(`Boolean(document.querySelector('.textLayer[data-page]'))`),
    60_000,
  );
  check("seeded PDF reader renders after reload", seededReaderRendered);
  const readCategoryCounts = () =>
    client.evaluate(`(async () => {
      const bookId = ${JSON.stringify(book.id)};
      const [annotations, vocabulary, bookmarks, notes] = await Promise.all([
        window.api.annotations.listByBook({ bookId }),
        window.api.vocabulary.list({ bookId }),
        window.api.library.bookmarks.list({ bookId }),
        window.api.bookNotes.listByBook({ bookId }),
      ]);
      return {
        annotations: annotations.length,
        vocabulary: vocabulary.length,
        bookmarks: bookmarks.length,
        notes: notes.length,
      };
    })()`);
  const initialReaderCategoryCounts = await readCategoryCounts();
  check(
    "reader tools contain seeded category data for reset-flow E2E",
    initialReaderCategoryCounts.annotations === 1 &&
      initialReaderCategoryCounts.vocabulary === 1 &&
      initialReaderCategoryCounts.bookmarks === 2 &&
      initialReaderCategoryCounts.notes === 1,
    JSON.stringify(initialReaderCategoryCounts),
  );

  const openReaderCategory = async (categoryLabels) => {
    const opened = await client.evaluate(`(() => {
      const button = [...document.querySelectorAll('button[aria-label]')].find(element =>
        /^(Reader tools|Công cụ đọc)$/u.test(element.getAttribute('aria-label') || '')
      );
      button?.click();
      return Boolean(button);
    })()`);
    if (!opened) return false;
    const labels = JSON.stringify(categoryLabels);
    const selected = await waitFor(`reader tools menu: ${categoryLabels[0]}`, () =>
      client.evaluate(`(() => {
        const labels = ${labels};
        const item = [...document.querySelectorAll('[role="menuitem"]')].find(element =>
          labels.includes(element.innerText.trim())
        );
        item?.click();
        return Boolean(item);
      })()`),
    );
    return selected;
  };
  const clearCategoryFromReaderTools = async ({
    category,
    toolLabels,
    clearLabels,
    cancelFirst,
  }) => {
    check(`Reader tools opens ${category}`, await openReaderCategory(toolLabels));
    const clearLabelOptions = JSON.stringify(clearLabels);
    const clearButton = await waitFor(`${category} clear-all action`, () =>
      client.evaluate(`(() => {
        const labels = ${clearLabelOptions};
        return Boolean([...document.querySelectorAll('button[aria-label]')].find(button =>
          labels.includes(button.getAttribute('aria-label') || '')
        ));
      })()`),
    );
    check(`${category} section shows its own clear-all button`, clearButton);
    await client.evaluate(`(() => {
      const labels = ${clearLabelOptions};
      [...document.querySelectorAll('button[aria-label]')].find(button =>
        labels.includes(button.getAttribute('aria-label') || '')
      )?.click();
    })()`);
    const count = initialReaderCategoryCounts[category];
    const dialog = await waitFor(`${category} clear confirmation`, () =>
      client.evaluate(`(() => {
        const dialog = document.querySelector('[role="alertdialog"]');
        const description = dialog?.querySelector('[data-slot="alert-dialog-description"]')?.innerText || '';
        const confirm = [...(dialog?.querySelectorAll('button') ?? [])].find(button =>
          /^(Clear all|Xóa tất cả)$/u.test(button.innerText.trim())
        );
        const cancel = [...(dialog?.querySelectorAll('button') ?? [])].find(button =>
          /^(Cancel|Hủy)$/u.test(button.innerText.trim())
        );
        return dialog ? { description, hasConfirm: Boolean(confirm), hasCancel: Boolean(cancel) } : null;
      })()`),
    );
    check(
      `${category} confirmation names its item count and book scope`,
      dialog.description.includes(String(count)) &&
        /this book|sách đang mở/iu.test(dialog.description) &&
        dialog.hasConfirm &&
        dialog.hasCancel,
    );
    if (cancelFirst) {
      await client.evaluate(`(() => {
        const dialog = document.querySelector('[role="alertdialog"]');
        [...(dialog?.querySelectorAll('button') ?? [])].find(button =>
          /^(Cancel|Hủy)$/u.test(button.innerText.trim())
        )?.click();
      })()`);
      await waitFor(`${category} confirmation cancel`, () =>
        client.evaluate(`!document.querySelector('[role="alertdialog"]')`),
      );
      check(
        `${category} cancellation preserves its data`,
        (await readCategoryCounts())[category] === count,
      );
      await client.evaluate(`(() => {
        const labels = ${clearLabelOptions};
        [...document.querySelectorAll('button[aria-label]')].find(button =>
          labels.includes(button.getAttribute('aria-label') || '')
        )?.click();
      })()`);
      await waitFor(`${category} second clear confirmation`, () =>
        client.evaluate(`Boolean(document.querySelector('[role="alertdialog"]'))`),
      );
    }
    await client.evaluate(`(() => {
      const dialog = document.querySelector('[role="alertdialog"]');
      [...(dialog?.querySelectorAll('button') ?? [])].find(button =>
        /^(Clear all|Xóa tất cả)$/u.test(button.innerText.trim())
      )?.click();
    })()`);
    const cleared = await waitFor(`${category} data cleared`, async () => {
      const counts = await readCategoryCounts();
      const dialogClosed = await client.evaluate(`!document.querySelector('[role="alertdialog"]')`);
      return counts[category] === 0 && dialogClosed ? counts : null;
    });
    check(`${category} can be cleared after confirmation`, cleared[category] === 0);
  };

  await clearCategoryFromReaderTools({
    category: "annotations",
    toolLabels: ["Annotations", "Đánh dấu"],
    clearLabels: ["Clear all Annotations", "Xóa tất cả Đánh dấu"],
    cancelFirst: true,
  });
  const otherCategoriesPreserved = await readCategoryCounts();
  check(
    "clearing annotations preserves vocabulary, bookmarks, and book notes",
    otherCategoriesPreserved.vocabulary === 1 &&
      otherCategoriesPreserved.bookmarks === 2 &&
      otherCategoriesPreserved.notes === 1,
  );
  await clearCategoryFromReaderTools({
    category: "vocabulary",
    toolLabels: ["Vocabulary", "Từ vựng"],
    clearLabels: ["Clear all Vocabulary", "Xóa tất cả Từ vựng"],
  });
  await clearCategoryFromReaderTools({
    category: "bookmarks",
    toolLabels: ["Bookmarks", "Dấu trang"],
    clearLabels: ["Clear all Bookmarks", "Xóa tất cả Dấu trang"],
  });
  await clearCategoryFromReaderTools({
    category: "notes",
    toolLabels: ["Notes", "Ghi chú"],
    clearLabels: ["Clear all Notes", "Xóa tất cả Ghi chú"],
  });
  const progressAfterCategoryClear = await client.evaluate(
    `window.api.progress.get({bookId:${JSON.stringify(book.id)}})`,
  );
  check(
    "category clearing preserves the book's reading progress",
    Boolean(progressAfterCategoryClear),
  );

  const pagesTabActivated = await client.evaluate(`(() => {
    const pages = [...document.querySelectorAll('[role="tab"]')]
      .find(tab => ['Pages', 'Trang'].includes(tab.getAttribute('aria-label') || ''));
    pages?.click();
    return Boolean(pages);
  })()`);
  check("Pages tab opens thumbnails inside the navigation sidebar", pagesTabActivated);
  if (capturePages) {
    await sleep(500);
    const screenshot = await client.call("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    const screenshotPath = path.join(profilePath, "pages-view.png");
    await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
    console.log(`SCREENSHOT  ${screenshotPath}`);
  }
  const pagesActive = await waitFor("Pages tab selection", () =>
    client.evaluate(`(() => {
      const pages = [...document.querySelectorAll('[role="tab"]')].find(tab => ['Pages', 'Trang'].includes(tab.getAttribute('aria-label') || ''));
      const pane = [...document.querySelectorAll('button[aria-expanded]')].find(button => /Collapse sidebar|Thu gọn thanh bên/u.test(button.getAttribute('aria-label') || ''));
      const selected = pages?.getAttribute('aria-selected') === 'true' || pages?.getAttribute('data-active') === 'true';
      return pane && pages ? {
        sidebarOpen: pane.getAttribute('aria-expanded') === 'true',
        pagesSelected: selected,
      } : null;
    })()`),
  );
  check(
    "Pages tab is active in the open navigation sidebar",
    pagesActive.sidebarOpen && pagesActive.pagesSelected,
  );
  const page13Thumbnail = await waitFor("page 13 thumbnail is rendered in the Pages pane", () =>
    client.evaluate(`Boolean([...document.querySelectorAll('button[aria-label]')].find(button =>
      ['Go to page 13', 'Đến trang 13'].includes(button.getAttribute('aria-label') || '')
    ))`),
  );
  check("Pages pane shows a clickable page thumbnail", page13Thumbnail);
  await client.evaluate(
    `(() => [...document.querySelectorAll('button[aria-expanded]')].find(button => /Collapse sidebar|Thu gọn thanh bên/u.test(button.getAttribute('aria-label') || ''))?.click())()`,
  );
  const collapsed = await waitFor("sidebar collapsed state", () =>
    client.evaluate(
      `([...document.querySelectorAll('button[aria-expanded]')].find(button => /Expand sidebar|Mở rộng thanh bên/u.test(button.getAttribute('aria-label') || ''))?.getAttribute('aria-expanded')) === 'false'`,
    ),
  );
  check("one sidebar control collapses the navigation pane", collapsed);
  await client.evaluate(
    `(() => [...document.querySelectorAll('button[aria-expanded]')].find(button => /Expand sidebar|Mở rộng thanh bên/u.test(button.getAttribute('aria-label') || ''))?.click())()`,
  );
  const restored = await waitFor("sidebar restored with Pages selection", () =>
    client.evaluate(`(() => {
      const pane = [...document.querySelectorAll('button[aria-expanded]')].find(button => /Collapse sidebar|Thu gọn thanh bên/u.test(button.getAttribute('aria-label') || ''));
      const pages = [...document.querySelectorAll('[role="tab"]')].find(tab => ['Pages', 'Trang'].includes(tab.getAttribute('aria-label') || ''));
      return pane?.getAttribute('aria-expanded') === 'true' && (pages?.getAttribute('aria-selected') === 'true' || pages?.getAttribute('data-active') === 'true');
    })()`),
  );
  check("reopening the sidebar preserves the Pages view", restored);
  const restoredThumbnail = await waitFor("page thumbnail remains after sidebar reopen", () =>
    client.evaluate(`Boolean([...document.querySelectorAll('button[aria-label]')].find(button =>
      ['Go to page 13', 'Đến trang 13'].includes(button.getAttribute('aria-label') || '')
    ))`),
  );
  check("reopened Pages pane still contains the page thumbnail", restoredThumbnail);

  const findSelectionTarget = () =>
    client.evaluate(`(() => {
    const layer = document.querySelector('.textLayer[data-page="13"]');
    const scroller = document.querySelector('.reader-scroll-region');
    if (!layer || !scroller) return null;
    const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
    const bounds = scroller.getBoundingClientRect();
    const candidates = [];
    for (let node = walker.nextNode(), textNodeIndex = 0; node; node = walker.nextNode(), textNodeIndex++) {
      const text = node.textContent || '';
      for (const match of text.matchAll(/[\\p{L}][\\p{L}’'-]{3,}/gu)) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const rect = range.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 3 || rect.top < bounds.top + 12 || rect.bottom > bounds.bottom - 20) continue;
        const y = rect.top + rect.height / 2;
        const inset = Math.min(1, rect.width / 5);
        const x1 = rect.left + inset;
        const x2 = rect.right - inset;
        const topLayerAt = (x) => document.elementFromPoint(x, y)?.closest('.textLayer');
        if (topLayerAt(x1) !== layer || topLayerAt(x2) !== layer) continue;
        const caretAt = (x) => document.caretRangeFromPoint?.(x, y);
        const startCaret = caretAt(x1);
        const endCaret = caretAt(x2);
        const startOffset = match.index;
        const endOffset = match.index + match[0].length;
        if (
          startCaret?.startContainer !== node || startCaret.startOffset !== startOffset ||
          endCaret?.startContainer !== node || endCaret.startOffset !== endOffset
        ) continue;
        const adjacentPunctuation = /[.,;:!?)]/u.test(text[match.index - 1] || '') || /[.,;:!?)]/u.test(text[match.index + match[0].length] || '');
        candidates.push({
          expected: match[0], segmentCount: 1,
          textNodeIndex, startOffset, endOffset,
          x1, x2, y,
          rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
          adjacentPunctuation,
        });
      }
    }
    return candidates.find(item => item.adjacentPunctuation)
      ?? candidates[0]
      ?? null;
  })()`);
  let selection = await findSelectionTarget();
  if (!selection) throw new Error("Could not find a visible word to verify PDF text selection");
  let selectionTargetReady = null;
  let selectionRefreshes = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    selectionTargetReady = await client.evaluate(`((probe) => {
    const layer = document.querySelector('.textLayer[data-page="13"]');
    const scroller = document.querySelector('.reader-scroll-region');
    if (!layer || !scroller) return { valid: false, reason: 'PDF text layer or reader viewport is missing' };
    const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
    let node = null;
    for (let index = 0; index <= probe.textNodeIndex; index++) node = walker.nextNode();
    if (!node || node.textContent?.slice(probe.startOffset, probe.endOffset) !== probe.expected) {
      return { valid: false, reason: 'the target text node or offsets changed before the drag' };
    }
    const range = document.createRange();
    range.setStart(node, probe.startOffset);
    range.setEnd(node, probe.endOffset);
    const rect = range.getBoundingClientRect();
    const viewport = scroller.getBoundingClientRect();
    const startCaret = document.caretRangeFromPoint?.(probe.x1, probe.y);
    const endCaret = document.caretRangeFromPoint?.(probe.x2, probe.y);
    const topLayerAt = (x) => document.elementFromPoint(x, probe.y)?.closest('.textLayer');
    const rectDelta = Math.max(
      Math.abs(rect.left - probe.rect.left), Math.abs(rect.top - probe.rect.top),
      Math.abs(rect.right - probe.rect.right), Math.abs(rect.bottom - probe.rect.bottom),
    );
    const valid = rect.top >= viewport.top + 12 && rect.bottom <= viewport.bottom - 20 &&
      rectDelta <= 1 && startCaret?.startContainer === node && startCaret.startOffset === probe.startOffset &&
      endCaret?.startContainer === node && endCaret.startOffset === probe.endOffset &&
      topLayerAt(probe.x1) === layer && topLayerAt(probe.x2) === layer;
    return { valid, rectDelta, startOffset: startCaret?.startOffset, endOffset: endCaret?.startOffset };
    })(${JSON.stringify(selection)})`);
    if (selectionTargetReady.valid || attempt === 4) break;
    await sleep(150);
    selection = await findSelectionTarget();
    selectionRefreshes++;
    if (!selection) break;
  }
  check(
    "selection target remains visible and maps to the exact word before the drag",
    Boolean(selectionTargetReady?.valid),
    selectionTargetReady?.reason ||
      `caret offsets ${selectionTargetReady?.startOffset}/${selectionTargetReady?.endOffset}; range delta ${(selectionTargetReady?.rectDelta ?? Infinity).toFixed(2)}px after ${selectionRefreshes} refresh(es)`,
  );
  if (!selectionTargetReady?.valid || !selection)
    throw new Error("PDF selection target changed before mouse input");
  for (const event of [
    {
      type: "mousePressed",
      x: selection.x1,
      y: selection.y,
      button: "left",
      buttons: 1,
      clickCount: 1,
    },
    {
      type: "mouseMoved",
      x: (selection.x1 + selection.x2) / 2,
      y: selection.y,
      button: "left",
      buttons: 1,
    },
    { type: "mouseMoved", x: selection.x2, y: selection.y, button: "left", buttons: 1 },
    { type: "mouseReleased", x: selection.x2, y: selection.y, button: "left", buttons: 0 },
  ]) {
    await client.call("Input.dispatchMouseEvent", event);
  }
  const measuredSelection = await waitFor(
    "native PDF text selection",
    async () => {
      const state = await client.evaluate(`(() => {
      const selection = document.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      return {
        text: selection.toString(),
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
        startOffset: selection.getRangeAt(0).startOffset,
        endOffset: selection.getRangeAt(0).endOffset,
        toolbar: [...document.querySelectorAll('button')].some(button => /Look up|Tra từ/u.test(button.getAttribute('aria-label') || button.title)),
      };
    })()`);
      return state;
    },
    5_000,
    150,
  );
  const exactText = measuredSelection.text === selection.expected;
  const exactOffsets =
    measuredSelection.startOffset === selection.startOffset &&
    measuredSelection.endOffset === selection.endOffset;
  const geometryDelta = Math.max(
    Math.abs(measuredSelection.rect.left - selection.rect.left),
    Math.abs(measuredSelection.rect.top - selection.rect.top),
    Math.abs(measuredSelection.rect.right - selection.rect.right),
    Math.abs(measuredSelection.rect.bottom - selection.rect.bottom),
  );
  if (captureSelection) {
    const screenshot = await client.call("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    const screenshotPath = path.join(profilePath, "selection-check.png");
    await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
    console.log(`SCREENSHOT  ${screenshotPath}`);
  }
  check(
    "mouse selection captures the complete PDF word",
    exactText,
    `${JSON.stringify(measuredSelection.text)} / ${JSON.stringify(selection.expected)}; ${measuredSelection.text.length}/${selection.expected.length} characters`,
  );
  check(
    "native PDF selection starts and ends at the exact word offsets",
    exactOffsets,
    `expected ${selection.startOffset}..${selection.endOffset}, received ${measuredSelection.startOffset}..${measuredSelection.endOffset}`,
  );
  check(
    "native selected range stays aligned to the intended word",
    geometryDelta <= 1.5,
    `max edge delta ${geometryDelta.toFixed(2)}px; text nodes ${selection.segmentCount}`,
  );

  await pressCtrlF();
  const searchStateAfterSelection = await waitFor("Ctrl+F find input after PDF selection", () =>
    client.evaluate(`(() => {
      const input = document.querySelector('input[placeholder="Find in PDF"], input[placeholder="Tìm trong PDF"]');
      return input ? { value: input.value, focused: document.activeElement === input } : null;
    })()`),
  );
  check("Ctrl+F opens a focused Find input after PDF selection", searchStateAfterSelection.focused);
  check(
    "Ctrl+F searches the selected PDF text",
    searchStateAfterSelection.value === selection.expected,
    `expected ${JSON.stringify(selection.expected)}, received ${JSON.stringify(searchStateAfterSelection.value)}`,
  );

  await clickFindButton();
  await waitFor("Find panel closes before touchpad zoom", () =>
    client.evaluate(
      `!document.querySelector('input[placeholder="Find in PDF"], input[placeholder="Tìm trong PDF"]')`,
    ),
  );
  await checkPinchZoom();

  console.log(`\n${checks.length} packaged E2E checks passed.`);
}

try {
  await main();
} catch (error) {
  failed = true;
  console.error(`\nFAIL  ${error instanceof Error ? error.message : String(error)}`);
  console.error(`${checks.length} checks passed before failure.`);
  if (lastProgressState)
    console.error(`Last saved-progress state: ${JSON.stringify(lastProgressState)}`);
  if (lastEpubDomState) console.error(`Last EPUB DOM state: ${JSON.stringify(lastEpubDomState)}`);
  if (client && profilePath) {
    try {
      const state = await client.evaluate(`(() => ({
        title: document.title,
        url: location.href,
        visibilityState: document.visibilityState,
        hasFocus: document.hasFocus(),
        textLayerContainers: document.querySelectorAll('.textLayer').length,
        textLayers: document.querySelectorAll('.textLayer[data-page]').length,
        pdfCanvases: document.querySelectorAll('.reader-scroll-region canvas').length,
        allCanvases: document.querySelectorAll('canvas').length,
        firstPageBitmap: (() => {
          const layer = document.querySelector('.textLayer[data-page="1"]');
          const canvas = layer?.parentElement?.querySelector('canvas');
          if (!layer || !canvas) return null;
          let pixel = null;
          let readError = null;
          try {
            pixel = Array.from(canvas.getContext('2d')?.getImageData(0, 0, 1, 1).data ?? []);
          } catch (error) {
            readError = String(error);
          }
          return {
            width: canvas.width,
            height: canvas.height,
            widthAttribute: canvas.getAttribute('width'),
            heightAttribute: canvas.getAttribute('height'),
            className: canvas.className,
            textLength: layer.textContent?.trim().length ?? 0,
            pixel,
            readError,
            renderErrorVisible: Boolean(layer.parentElement?.querySelector('[role="alert"]')),
          };
        })(),
        scrollContainer: (() => {
          const element = document.querySelector('[data-testid="virtuoso-scroller"]');
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          const list = element.querySelector('[data-testid="virtuoso-item-list"]');
          return {
            className: element.className,
            width: rect.width,
            height: rect.height,
            scrollHeight: element.scrollHeight,
            childCount: element.childElementCount,
            firstChild: element.firstElementChild?.outerHTML?.slice(0, 1000) ?? null,
            itemListChildCount: list?.childElementCount ?? null,
            itemListStyle: list?.getAttribute('style') ?? null,
          };
        })(),
        virtuosoFiber: (() => {
          const element = document.querySelector('[data-testid="virtuoso-scroller"]');
          const fiberKey = element && Object.keys(element).find(key => key.startsWith('__reactFiber$'));
          let fiber = fiberKey ? element[fiberKey] : null;
          const chain = [];
          for (let depth = 0; fiber && depth < 30; depth++, fiber = fiber.return) {
            const type = fiber.type;
            const name = type?.displayName || type?.name || type?.render?.displayName || type?.render?.name || (typeof type === 'string' ? type : '');
            const props = fiber.memoizedProps || {};
            const selected = {};
            for (const key of ['totalCount', 'initialScrollTop', 'defaultItemHeight', 'fixedItemHeight', 'increaseViewportBy', 'initialItemCount']) {
              if (key in props) selected[key] = props[key];
            }
            if (name || Object.keys(selected).length) chain.push({ name, key: fiber.key, props: selected });
          }
          return { fiberFound: Boolean(fiberKey), chain };
        })(),
        rootStart: document.querySelector('#root')?.innerHTML?.slice(0, 2500) ?? null,
        mainSummary: (() => {
          const main = document.querySelector('main');
          if (!main) return null;
          return {
            rect: (() => {
              const rect = main.getBoundingClientRect();
              return { width: rect.width, height: rect.height, top: rect.top, left: rect.left };
            })(),
            viewport: {
              width: innerWidth,
              height: innerHeight,
              visibilityState: document.visibilityState,
            },
            text: main.innerText.slice(0, 800),
            children: [...main.children].slice(0, 5).map(element => ({
              tag: element.tagName,
              className: typeof element.className === 'string' ? element.className.slice(0, 160) : '',
              html: element.outerHTML.slice(0, 900),
            })),
            images: [...main.querySelectorAll('img')].slice(0, 5).map(image => ({
              alt: image.alt,
              src: image.currentSrc || image.src,
              width: image.naturalWidth,
              height: image.naturalHeight,
            })),
          };
        })(),
        buttons: document.querySelectorAll('button').length,
        inputs: document.querySelectorAll('input').length,
        mains: document.querySelectorAll('main').length,
        dialogs: document.querySelectorAll('[role="dialog"]').length,
        namedButtons: [...document.querySelectorAll('button')]
          .map(button => button.getAttribute('aria-label') || button.title)
          .filter(Boolean),
      }))()`);
      const screenshot = await client.call("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
      });
      const diagnosticPath = path.join(profilePath, "e2e-failure.png");
      await writeFile(diagnosticPath, Buffer.from(screenshot.data, "base64"));
      console.error(`E2E diagnostic state: ${JSON.stringify(state)}`);
      console.error(`E2E failure screenshot: ${diagnosticPath}`);
      if (client.runtimeEvents.length > 0) {
        console.error(
          `Renderer console/exception events: ${JSON.stringify(client.runtimeEvents.slice(-40))}`,
        );
      }
    } catch (diagnosticError) {
      console.error(
        `E2E diagnostics unavailable: ${diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError)}`,
      );
    }
  }
  process.exitCode = 1;
} finally {
  await closeApp();
  if (profilePath && (failed || keepProfile)) {
    console.log(`E2E profile retained for inspection: ${String(profilePath)}`);
  } else if (profilePath) {
    const removed = await removeProfileSafely();
    if (!removed) console.log(`E2E profile retained for inspection: ${String(profilePath)}`);
  }
}
