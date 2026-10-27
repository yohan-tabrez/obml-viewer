# OBML Viewer

**OBML Viewer** opens Opera Mini saved pages (`.obml`, `.obml15`, `.obml16`) in a browser or as a lightweight Windows desktop app. Parsing and rendering happen entirely on your machine — nothing is uploaded.

**Developer:** [Yohan Tabrez](https://github.com/djxriman)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Features

- Open / drag-and-drop OBML files
- Render text, boxes, images, link hit-rects, and display-only forms
- Export a standalone HTML file (images inlined)
- Text scale control for font-metric mismatches
- Desktop app built with [Tauri 2](https://tauri.app/) (native open/save dialogs)

## Supported OBML versions

| Version | Typical extension | Notes |
|--------:|-------------------|-------|
| 6 | `.obml` | Early / modded Mini |
| 12, 13 | `.obml` | Absolute coordinates |
| 15 | `.obml15` | Relative positions; images use v16-like layout with fallback |
| 16 | `.obml16` | Relative positions; richest text/image trailers |

Undocumented pre-v6 or exotic modded formats are out of scope.

## Quick start (browser)

```bash
npm install
npm run dev
```

Open the URL Vite prints, then open or drop an OBML file.

```bash
npm run build      # production assets in dist/
npm run preview
```

## Desktop app (Windows)

### Requirements

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (stable)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the **Desktop development with C++** / MSVC workload

Build from a **Developer Command Prompt**, or after running `vcvars64.bat`, so `link.exe` is on `PATH`.

### Develop & build

```bash
npm install
npm run tauri:dev      # live reload window
npm run tauri:build    # release binary + installers
```

Artifacts after `tauri:build`:

| Artifact | Path |
|----------|------|
| Portable exe | `src-tauri/target/release/obml-viewer.exe` |
| NSIS setup | `src-tauri/target/release/bundle/nsis/OBML Viewer_1.0.0_x64-setup.exe` |
| MSI | `src-tauri/target/release/bundle/msi/OBML Viewer_1.0.0_x64_en-US.msi` |

### Desktop usage

- **Open file…** — native file dialog  
- **Export HTML** — native save dialog  
- **Drop** a file anywhere on the window (Tauri drag-drop events)

## Project structure

```
src/
  parser/     # Binary OBML reader → Page model
  render/     # Absolute-positioned DOM + HTML export
  main.ts     # App chrome (open / drop / export / scale)
src-tauri/    # Tauri shell, icons, capabilities
public/       # Favicon
```

## Notes on fidelity

OBML is a **pixel-positioned** snapshot for a specific device’s screen and fonts. On desktop:

- Text may overlap or look slightly off — use **Text scale**
- Links are a separate overlay layer from text, so hit targets can shift when fonts differ from the original phone

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite browser UI |
| `npm run build` | Typecheck + Vite production build |
| `npm run preview` | Serve `dist/` |
| `npm run tauri:dev` | Tauri development window |
| `npm run tauri:build` | Tauri release + installers |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License & credits

MIT — see [LICENSE](LICENSE) and [NOTICE](NOTICE).

Developed by **Yohan Tabrez**.

Binary format understanding and parsing logic adapted from [grawity/obml-parser](https://github.com/grawity/obml-parser) (MIT), including [obml-format.md](https://github.com/grawity/obml-parser/blob/master/obml-format.md).
