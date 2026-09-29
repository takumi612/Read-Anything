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

## Run Read-Anything on Windows

### Requirements

- Windows 10 or later, 64-bit.
- [Node.js 24.x for Windows x64](https://nodejs.org/en/download/archive/v24/). It includes npm and Corepack. This repository pins pnpm 11.5.0.
- [Git for Windows](https://git-scm.com/download/win) to clone the repository.
- An internet connection for cloning the repository and downloading dependencies on the first setup.

The app and bundled dictionary work offline after setup. AI questions need an internet connection and an API key from the provider you choose. You do not need an API key to read books or look up words.

Check that the tools are available in PowerShell:

```powershell
node --version
git --version
corepack --version
```

`node --version` must show `v24.x.x`. If `corepack --version` reports that the command was not found, run `npm install --global corepack`, close PowerShell, then open it again. See the [Corepack guide](https://github.com/nodejs/corepack#readme) for details.

### Install and start the app

Run these commands in PowerShell:

```powershell
git clone https://github.com/takumi612/Read-Anything.git
cd Read-Anything
.\scripts\windows.ps1 setup
.\scripts\windows.ps1 dev
```

The first command downloads the source and bundled dictionary. `setup` downloads the locked pnpm version and app dependencies, builds the EPUB parser, and prepares SQLite for Electron. Keep the PowerShell window open while the app runs. Press **Ctrl+C** in that window to stop development mode.

If PowerShell blocks the setup script, run the project commands directly:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

If setup stops with a `node-gyp` or `better-sqlite3` compiler error, install Python 3 and [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the **Desktop development with C++** workload. Then run `corepack pnpm install --frozen-lockfile` again. The native module may use a prebuilt binary and not need these build tools.

### Open your first book

1. In the library, choose **Import books** and select a PDF or EPUB.
2. Open the book. Select an English word and choose **Look up** to see its offline dictionary entry.
3. To ask AI about a passage, open **Settings**, add your provider and API key, then select the passage and choose **Ask AI**. The provider may charge for API use.

### Build a Windows EXE

To create and run a portable build, use:

```powershell
.\scripts\windows.ps1 package
.\out\Read-Anything-win32-x64\Read-Anything.exe
```

To create a Windows installer, run `.\scripts\windows.ps1 installer`. Find it in `out\make\squirrel.windows\x64\`.

See [the source setup guide](docs/run-from-source.md) for development details, or [the Windows packaging guide](docs/build-windows-exe.md) for the EXE and installer steps.

## Documentation

- [Set up from source](docs/run-from-source.md)
- [Build a Windows EXE](docs/build-windows-exe.md)
- [Project architecture](docs/architecture.md)
- [Code map](docs/code-map.md)
- [Runtime flows](docs/runtime-flows.md)

## License and data

Application code is distributed under [GPL-3.0-or-later](LICENSE). This project builds on [Marginalia by EurFelux](https://github.com/EurFelux/marginalia); its copyright and history are retained. The bundled dictionary has a separate [CC BY-SA 4.0 attribution](assets/dictionary/ATTRIBUTION.md) and [source note](assets/dictionary/README.md). Books and API credentials are never included in this repository.
