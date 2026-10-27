import "./styles.css";
import { parseObml } from "./parser/parse";
import type { Page } from "./parser/types";
import { exportHtml, renderPage, setTextScale } from "./render/render";

const THEME_KEY = "obml-theme";

const isTauri =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window ||
    Boolean(import.meta.env.TAURI_ENV_PLATFORM));

let currentPage: Page | null = null;
let currentFileName = "page.obml";
let dragDepth = 0;

const ICON_FOLDER = `<svg class="icon" width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M245,110.64A16,16,0,0,0,232,104H216V88a16,16,0,0,0-16-16H130.67L122.4,51.2A16,16,0,0,0,108,40H40A16,16,0,0,0,24,56V208.53A15.74,15.74,0,0,0,39.38,224l.18,0H211.09a15.75,15.75,0,0,0,15.63-13.21l14.27-78.48A16,16,0,0,0,245,110.64ZM40,56h68l8.27,20.8A16,16,0,0,0,131.33,88H200v16H69.26a16,16,0,0,0-15.63,13.21L40,182.4Zm171.09,152H47.56L61,120H232Z"/></svg>`;

const ICON_DOWNLOAD = `<svg class="icon" width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z"/></svg>`;

const ICON_FILE = `<svg class="dropzone-icon" width="40" height="40" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z"/></svg>`;

const ICON_BRAND = `<svg class="brand-mark" width="22" height="22" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="currentColor" opacity="0.15"/><rect x="12" y="12" width="40" height="40" rx="6" fill="none" stroke="currentColor" stroke-width="2.5"/><rect x="12" y="12" width="40" height="12" rx="6" fill="currentColor"/><rect x="12" y="20" width="40" height="4" fill="currentColor"/><rect x="18" y="30" width="22" height="2.5" rx="1" fill="currentColor" opacity="0.55"/><rect x="18" y="36" width="18" height="2.5" rx="1" fill="currentColor" opacity="0.55"/><rect x="18" y="42" width="14" height="2.5" rx="1" fill="currentColor" opacity="0.55"/></svg>`;

const ICON_MOON = `<svg class="icon icon-moon" width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,184.72A88,88,0,0,1,65.28,67.1a88.08,88.08,0,0,1,105.84,105.84A89.52,89.52,0,0,1,188.9,184.72Z"/></svg>`;

const ICON_SUN = `<svg class="icon icon-sun" width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z"/></svg>`;

initTheme();

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <header class="toolbar">
    <div class="brand">
      ${ICON_BRAND}
      <h1>OBML Viewer</h1>
    </div>
    <label class="file-btn btn btn-primary" id="open-label">
      ${ICON_FOLDER}
      <span>Open file</span>
      <input id="file-input" type="file" accept=".obml,.obml15,.obml16,application/octet-stream" />
    </label>
    <button type="button" class="btn btn-primary" id="btn-open" hidden>
      ${ICON_FOLDER}
      <span>Open file</span>
    </button>
    <button type="button" class="btn btn-secondary" id="btn-export" disabled>
      ${ICON_DOWNLOAD}
      <span>Export HTML</span>
    </button>
    <div class="font-controls" title="Adjust if text overlaps due to font metrics">
      <span>Text scale</span>
      <input id="text-scale" type="range" min="80" max="130" value="100" aria-label="Text scale" />
      <span class="scale-badge" id="text-scale-label">100%</span>
    </div>
    <div class="spacer"></div>
    <button type="button" class="btn-icon" id="btn-theme" aria-label="Switch to light theme">
      ${ICON_MOON}
      ${ICON_SUN}
    </button>
    <span class="dev-credit" title="Developer">Yohan Tabrez</span>
  </header>
  <div class="meta" id="meta" role="status">
    <span class="status">Open or drop an OBML file (v<strong>6</strong> / <strong>12</strong> / <strong>13</strong> / <strong>15</strong> / <strong>16</strong>) to view a saved Opera Mini page.</span>
  </div>
  <main class="viewport" id="viewport">
    <div class="drop-overlay" id="drop-overlay" aria-hidden="true">Drop OBML file to open</div>
    <div class="dropzone" id="dropzone">
      ${ICON_FILE}
      <h2>Drop OBML file here</h2>
      <p class="hint" id="drop-hint">Supports .obml / .obml15 / .obml16 · versions 6, 12, 13, 15, 16</p>
      <button type="button" class="btn btn-primary" id="btn-drop-open">
        ${ICON_FOLDER}
        <span>Open file</span>
      </button>
    </div>
    <div id="stage-host" hidden></div>
  </main>
`;

const fileInput = document.querySelector<HTMLInputElement>("#file-input")!;
const openLabel = document.querySelector<HTMLLabelElement>("#open-label")!;
const btnOpen = document.querySelector<HTMLButtonElement>("#btn-open")!;
const btnExport = document.querySelector<HTMLButtonElement>("#btn-export")!;
const btnTheme = document.querySelector<HTMLButtonElement>("#btn-theme")!;
const btnDropOpen = document.querySelector<HTMLButtonElement>("#btn-drop-open")!;
const meta = document.querySelector<HTMLDivElement>("#meta")!;
const dropzone = document.querySelector<HTMLDivElement>("#dropzone")!;
const dropHint = document.querySelector<HTMLParagraphElement>("#drop-hint")!;
const stageHost = document.querySelector<HTMLDivElement>("#stage-host")!;
const viewport = document.querySelector<HTMLElement>("#viewport")!;
const textScale = document.querySelector<HTMLInputElement>("#text-scale")!;
const textScaleLabel = document.querySelector<HTMLSpanElement>("#text-scale-label")!;

syncThemeButton();

if (isTauri) {
  openLabel.hidden = true;
  btnOpen.hidden = false;
  dropHint.textContent =
    "Supports OBML v6 / v12 / v13 / v15 / v16 · drop a file anywhere on the window";
  void setupTauriDragDrop();
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) void loadBrowserFile(file);
  fileInput.value = "";
});

btnOpen.addEventListener("click", () => {
  void openWithTauri();
});

btnDropOpen.addEventListener("click", () => {
  if (isTauri) {
    void openWithTauri();
  } else {
    fileInput.click();
  }
});

btnExport.addEventListener("click", () => {
  void exportCurrent();
});

btnTheme.addEventListener("click", () => {
  const next = getTheme() === "light" ? "dark" : "light";
  setTheme(next);
  syncThemeButton();
});

textScale.addEventListener("input", () => {
  const pct = Number(textScale.value);
  textScaleLabel.textContent = `${pct}%`;
  setTextScale(stageHost, pct / 100);
});

// HTML5 drag-drop (browser / when Tauri native DnD is disabled)
;["dragenter", "dragover"].forEach((ev) => {
  viewport.addEventListener(ev, (e) => {
    e.preventDefault();
    if (ev === "dragenter") {
      dragDepth += 1;
      setDragging(true);
    }
  });
});

viewport.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) setDragging(false);
});

viewport.addEventListener("drop", (e) => {
  e.preventDefault();
  dragDepth = 0;
  setDragging(false);
  const file = (e as DragEvent).dataTransfer?.files?.[0];
  if (file) void loadBrowserFile(file);
});

async function setupTauriDragDrop(): Promise<void> {
  try {
    const { getCurrentWebviewWindow } = await import(
      "@tauri-apps/api/webviewWindow"
    );
    const webview = getCurrentWebviewWindow();
    await webview.onDragDropEvent((event) => {
      const payload = event.payload;
      if (payload.type === "enter" || payload.type === "over") {
        setDragging(true);
        return;
      }
      if (payload.type === "leave") {
        setDragging(false);
        return;
      }
      if (payload.type === "drop") {
        setDragging(false);
        const path = payload.paths[0];
        if (path) void loadFromPath(path);
      }
    });
  } catch (err) {
    console.error("Failed to set up Tauri drag-drop:", err);
  }
}

async function openWithTauri(): Promise<void> {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: false,
      title: "Open OBML file",
      filters: [
        {
          name: "Opera Mini saved pages",
          extensions: ["obml", "obml15", "obml16"],
        },
        { name: "All files", extensions: ["*"] },
      ],
    });
    if (selected === null) return;
    const path = Array.isArray(selected) ? selected[0] : selected;
    if (!path) return;
    await loadFromPath(path);
  } catch (err) {
    showError(err);
  }
}

async function loadFromPath(path: string): Promise<void> {
  const name = path.replace(/^.*[/\\]/, "") || "page.obml";
  currentFileName = name;
  showLoading(name);
  try {
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const bytes = await readFile(path);
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    // Yield so the "Loading…" paint can flush before heavy parse/render
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    applyParsed(parseObml(buffer));
  } catch (err) {
    showError(err);
  }
}

async function loadBrowserFile(file: File): Promise<void> {
  currentFileName = file.name;
  showLoading(file.name);
  try {
    const buffer = await file.arrayBuffer();
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    applyParsed(parseObml(buffer));
  } catch (err) {
    showError(err);
  }
}

async function exportCurrent(): Promise<void> {
  if (!currentPage) return;
  const defaultName = currentFileName.replace(/\.obml\d*$/i, "") + ".html";

  // Build HTML off the critical path after dialog selection when possible
  if (isTauri) {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({
        title: "Export HTML",
        defaultPath: defaultName,
        filters: [{ name: "HTML", extensions: ["html"] }],
      });
      if (!path) return;
      appendMetaStatus("Exporting…");
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      const html = exportHtml(currentPage);
      await writeTextFile(path, html);
      appendMetaStatus("Exported.", "ok");
    } catch (err) {
      showError(err);
    }
    return;
  }

  const html = exportHtml(currentPage);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = defaultName;
  a.click();
  URL.revokeObjectURL(a.href);
}

function applyParsed(page: Page): void {
  currentPage = page;
  showPage(page);
}

function showLoading(name: string): void {
  viewport.setAttribute("aria-busy", "true");
  meta.innerHTML = `<span class="status">Loading <strong>${escapeHtml(name)}</strong>…</span>`;
}

function showError(err: unknown): void {
  currentPage = null;
  btnExport.disabled = true;
  dropzone.hidden = false;
  stageHost.hidden = true;
  stageHost.replaceChildren();
  viewport.removeAttribute("aria-busy");
  const msg = err instanceof Error ? err.message : String(err);
  meta.innerHTML = `<span class="err">Failed: ${escapeHtml(msg)}</span>`;
}

function showPage(page: Page): void {
  dropzone.hidden = true;
  stageHost.hidden = false;
  renderPage(stageHost, page);
  setTextScale(stageHost, Number(textScale.value) / 100);
  viewport.removeAttribute("aria-busy");

  btnExport.disabled = false;
  meta.innerHTML = `
    <span class="chip chip-title" title="${escapeAttr(page.title || "(untitled)")}">${escapeHtml(page.title || "(untitled)")}</span>
    <span class="chip chip-mono">OBML v${page.version}</span>
    <span class="chip chip-mono">${page.width}×${page.height}px</span>
    <span class="chip">${page.texts.length} text · ${page.images.length} img · ${page.links.length} links</span>
    <span class="chip"><a href="${escapeAttr(page.url)}" target="_blank" rel="noopener">${escapeHtml(page.url)}</a></span>
  `;
  viewport.scrollTop = 0;
  viewport.scrollLeft = 0;
}

function appendMetaStatus(text: string, kind?: "ok"): void {
  const span = document.createElement("span");
  span.className = kind === "ok" ? "ok" : "status";
  span.textContent = text;
  meta.appendChild(span);
}

function setDragging(on: boolean): void {
  viewport.classList.toggle("dragging", on);
}

function initTheme(): void {
  const saved = localStorage.getItem(THEME_KEY);
  const theme = saved === "light" || saved === "dark" ? saved : "dark";
  setTheme(theme, false);
}

function getTheme(): "dark" | "light" {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function setTheme(theme: "dark" | "light", persist = true): void {
  if (theme === "light") {
    document.documentElement.dataset.theme = "light";
  } else {
    delete document.documentElement.dataset.theme;
  }
  if (persist) localStorage.setItem(THEME_KEY, theme);
}

function syncThemeButton(): void {
  const light = getTheme() === "light";
  btnTheme.setAttribute(
    "aria-label",
    light ? "Switch to dark theme" : "Switch to light theme",
  );
  btnTheme.setAttribute("aria-pressed", light ? "true" : "false");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
