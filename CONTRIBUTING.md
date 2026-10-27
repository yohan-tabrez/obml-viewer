# Contributing

Thanks for helping improve **OBML Viewer**.

## Development setup

### Browser UI

```bash
npm install
npm run dev
```

### Desktop (Tauri)

1. Install [Node.js](https://nodejs.org/), [Rust](https://rustup.rs/), and Windows [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (C++ / MSVC).
2. Open a **Developer Command Prompt** (or run `vcvars64.bat`) so `link.exe` is available.
3. Run:

```bash
npm install
npm run tauri:dev
```

## Project layout

| Path | Role |
|------|------|
| `src/parser/` | OBML binary reader (v6 / 12 / 13 / 15 / 16) |
| `src/render/` | Absolute-positioned HTML renderer + HTML export |
| `src/main.ts` | UI (open, drop, export, text scale) |
| `src-tauri/` | Tauri 2 shell, icons, native dialogs |

## Guidelines

- Prefer small, focused pull requests.
- Keep parser changes aligned with [grawity’s format notes](https://github.com/grawity/obml-parser/blob/master/obml-format.md) when possible; document unknowns.
- If you have sample `.obml` / `.obml15` / `.obml16` files that reproduce a bug, describe them in the issue (do not commit copyrighted page dumps unless you own them).
- Run `npm run build` before submitting; for desktop changes also run `npm run tauri:build` when you can.

## License

By contributing, you agree that your contributions are licensed under the MIT License (see [LICENSE](LICENSE)).
