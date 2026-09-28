# Read-Anything

[Tiếng Việt](README.vi.md)

Read-Anything is an offline-first desktop reader for PDF and EPUB books. Look up English words in the bundled English–Vietnamese dictionary, mark passages, keep notes and bookmarks, and resume where you left off. AI is optional: connect a provider with your own API key when you want to ask about a selected passage.

## What it does

- Read PDF and EPUB files on your computer. PDF text selection and dictionary lookup require a text layer; scanned pages remain readable as images.
- Look up words offline, including common inflected forms, and hear pronunciation through voices installed on your system.
- Search inside a PDF; save highlights, notes, bookmarks, vocabulary, and reading position locally.
- Choose annotation colors and page or surrounding colors. PDF page appearance and EPUB page colors are separate settings.
- Track daily reading and a streak after ten distinct pages. The statistics screen shows a calendar.
- Ask AI about selected text with OpenAI, Anthropic, Google, or an OpenAI-compatible endpoint you configure. Provider charges, if any, are determined by that provider.
- Use the interface in English or Vietnamese. No account is required for offline reading.

## Run on Windows from source

You need **Windows 10 or later (64-bit)**, **Node.js 24 with Corepack**, and **Git** for cloning. The first install downloads the app's npm dependencies, Electron, and the pinned pnpm version. Later runs reuse the local installation. The offline dictionary is included in the repository; no API key is needed for lookup.

```powershell
git clone https://github.com/takumi612/Read-Anything.git
cd Read-Anything
.\scripts\windows.ps1 setup
.\scripts\windows.ps1 dev
```

If PowerShell restricts local scripts, run the equivalent commands directly:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

`install` builds the workspace packages and rebuilds `better-sqlite3` for Electron through `postinstall`. Keep the terminal open while developing. If the native module cannot compile on your Windows machine, install the Microsoft C++ build tools, then repeat `corepack pnpm install`.

## Build and run the Windows EXE

Close any running Read-Anything EXE before rebuilding. The `package` action creates an app folder that must stay together:

```powershell
.\scripts\windows.ps1 package
.\out\Read-Anything-win32-x64\Read-Anything.exe
```

To create a Windows installer instead, run `.\scripts\windows.ps1 installer`. Electron Forge writes the Squirrel installer under `out\make\squirrel.windows\x64\`. A build from source is not code signed. Building the installer does not publish a GitHub release.

The same actions are available as `corepack pnpm package` and `corepack pnpm make:win`. On macOS or Linux, install the same Node.js version and use `corepack pnpm install --frozen-lockfile`, `corepack pnpm dev`, and `corepack pnpm package`. Packaging for a platform must run on that platform; this repository does not include a signed or notarized release workflow.

## First use

1. Import a PDF or EPUB from the library.
2. Select an English word and choose **Look up** for the offline dictionary. Select a passage and choose **Ask AI** only if you have configured a provider.
3. Open **Settings** to choose a provider and enter your own API key if you want AI responses. Keys are not part of backups.
4. To offer Read-Anything as a PDF app in Windows, open the app's advanced settings. Windows Default Apps controls the final `.pdf` choice.

Existing Marginalia data is reused on the same machine when Read-Anything has no data directory yet. The database and saved keys keep their legacy internal names for compatibility. Back up your library before uninstalling an older version.

## Documentation

- [Set up from source](docs/run-from-source.html)
- [Build a Windows EXE](docs/build-windows-exe.html)
- [Project architecture](docs/architecture.html)
- [Code map](docs/code-map.html)
- [Runtime flows](docs/runtime-flows.html)

## License and data

Application code is distributed under [GPL-3.0-or-later](LICENSE). This project builds on [Marginalia by EurFelux](https://github.com/EurFelux/marginalia); its copyright and history are retained. The bundled dictionary has a separate [CC BY-SA 4.0 attribution](assets/dictionary/ATTRIBUTION.md) and [source note](assets/dictionary/README.md). Books and API credentials are never included in this repository.
