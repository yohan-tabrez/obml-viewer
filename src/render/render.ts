import type { Color, Page } from "../parser/types";
import { DEFAULT_LINE_HEIGHT, fontSizeCss, isBold } from "./fonts";

export function rgba(c: Color): string {
  if (c.a === 0 || c.a === 255) {
    return `rgb(${c.r}, ${c.g}, ${c.b})`;
  }
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${(c.a / 255).toFixed(3)})`;
}

function mimeOf(data: Uint8Array): string {
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  ) {
    return "image/png";
  }
  if (data.length >= 2 && data[0] === 0xff && data[1] === 0xd8) {
    return "image/jpeg";
  }
  if (
    data.length >= 12 &&
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  ) {
    return "image/webp";
  }
  return "application/octet-stream";
}

/** Fast blob: URLs for live viewing (no base64). */
function buildBlobUrls(page: Page): { urls: Map<number, string>; revoke: () => void } {
  const urls = new Map<number, string>();
  const objectUrls: string[] = [];
  for (const file of page.files) {
    // Copy into a fresh ArrayBuffer-backed view so Blob always gets ArrayBuffer, not SharedArrayBuffer.
    const copy = new Uint8Array(file.data);
    const url = URL.createObjectURL(new Blob([copy], { type: mimeOf(file.data) }));
    objectUrls.push(url);
    urls.set(file.addr, url);
  }
  return {
    urls,
    revoke: () => {
      for (const u of objectUrls) URL.revokeObjectURL(u);
    },
  };
}

function toDataUrl(data: Uint8Array): string {
  const mime = mimeOf(data);
  // Chunked binary→base64 without spreading huge arrays onto the call stack
  const chunk = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < data.length; i += chunk) {
    const slice = data.subarray(i, i + chunk);
    let s = "";
    for (let j = 0; j < slice.length; j++) s += String.fromCharCode(slice[j]!);
    parts.push(s);
  }
  return `data:${mime};base64,${btoa(parts.join(""))}`;
}

function buildDataUrls(page: Page): Map<number, string> {
  const map = new Map<number, string>();
  for (const file of page.files) {
    map.set(file.addr, toDataUrl(file.data));
  }
  return map;
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

const VIEWER_CSS = `
.obml-stage {
  position: relative;
  background: white;
  margin: 0 auto;
  overflow: hidden;
  box-shadow: 0 0 0 1px #ccc;
  --obml-text-scale: 1;
}
.obml-item { position: absolute; }
.obml-box { z-index: 1; }
.obml-img {
  z-index: 2;
  background-size: contain;
  background-repeat: no-repeat;
}
.obml-text {
  z-index: 3;
  font-family: var(--obml-font-family, sans-serif);
  line-height: var(--obml-line-height, ${DEFAULT_LINE_HEIGHT});
  white-space: pre;
  overflow: hidden;
  font-size: calc(var(--base-fs) * var(--obml-text-scale, 1));
}
.obml-field { z-index: 4; font-family: var(--obml-font-family, sans-serif); }
.obml-link {
  display: block;
  text-decoration: none;
  z-index: 10;
}
.obml-link:hover { outline: 1px solid #06c; }
.obml-imglink {
  color: gray;
  z-index: 11;
  font-size: 12px;
  line-height: 1;
}
`;

let lastRevoke: (() => void) | null = null;

/**
 * Render a parsed Page into `host`, replacing previous content.
 * Returns the stage element.
 */
export function renderPage(host: HTMLElement, page: Page): HTMLElement {
  lastRevoke?.();
  lastRevoke = null;
  host.replaceChildren();

  const style = document.createElement("style");
  style.textContent = VIEWER_CSS;
  host.appendChild(style);

  const stage = document.createElement("div");
  stage.className = "obml-stage";
  stage.style.width = `${page.width}px`;
  stage.style.height = `${page.height}px`;

  const { urls: images, revoke } = buildBlobUrls(page);
  lastRevoke = revoke;

  const frag = document.createDocumentFragment();

  for (const box of page.boxes) {
    const el = document.createElement("div");
    el.className = "obml-item obml-box";
    el.style.cssText = `left:${box.pos.x}px;top:${box.pos.y}px;width:${box.size.x}px;height:${box.size.y}px;background-color:${rgba(box.fill)}`;
    frag.appendChild(el);
  }

  for (const img of page.images) {
    const el = document.createElement("div");
    el.className = "obml-item obml-img";
    const url = images.get(img.fileAddr);
    el.style.cssText = url
      ? `left:${img.pos.x}px;top:${img.pos.y}px;width:${img.size.x}px;height:${img.size.y}px;background-image:url("${url}")`
      : `left:${img.pos.x}px;top:${img.pos.y}px;width:${img.size.x}px;height:${img.size.y}px;background-color:${rgba(img.fill)}`;
    frag.appendChild(el);
  }

  for (const t of page.texts) {
    const el = document.createElement("div");
    el.className = "obml-item obml-text";
    el.style.cssText = `left:${t.pos.x}px;top:${t.pos.y}px;width:${t.size.x}px;height:${t.size.y}px;color:${rgba(t.color)};font-weight:${isBold(t.font) ? "bold" : "normal"}`;
    el.style.setProperty("--base-fs", fontSizeCss(t.font));
    el.textContent = t.text;
    frag.appendChild(el);
  }

  for (const form of page.forms) {
    const wrap = document.createElement("div");
    wrap.className = "obml-item obml-field";
    wrap.style.cssText = `left:${form.pos.x}px;top:${form.pos.y}px;width:${form.size.x}px;height:${form.size.y}px;color:${rgba(form.color)}`;

    if (form.kind === "textarea") {
      const ta = document.createElement("textarea");
      ta.className = "obml-form";
      ta.value = form.value;
      ta.readOnly = true;
      ta.style.cssText = "width:100%;height:100%;border:none;padding:0;resize:none";
      wrap.appendChild(ta);
    } else if (form.kind === "text") {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "obml-form";
      input.value = form.value;
      input.readOnly = true;
      input.style.cssText = "width:100%;height:100%;border:none;padding:0";
      wrap.appendChild(input);
    } else if (form.kind === "checkbox" || form.kind === "radio") {
      const input = document.createElement("input");
      input.type = form.kind;
      input.className = "obml-form";
      input.value = form.value;
      input.disabled = true;
      wrap.appendChild(input);
    } else if (form.kind === "select") {
      const select = document.createElement("select");
      select.className = "obml-form";
      select.disabled = true;
      select.style.cssText = "width:100%;height:100%";
      const list =
        form.optionListIndex !== undefined
          ? page.optionLists[form.optionListIndex]
          : undefined;
      if (list) {
        for (const opt of list) {
          const o = document.createElement("option");
          o.value = opt.id;
          o.textContent = opt.label;
          select.appendChild(o);
        }
      }
      wrap.appendChild(select);
    }

    frag.appendChild(wrap);
  }

  for (const link of page.links) {
    const a = document.createElement("a");
    a.className =
      link.kind === "image" ? "obml-item obml-link obml-imglink" : "obml-item obml-link";
    a.href = link.href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    if (link.kind === "image") {
      a.style.cssText = `left:${link.pos.x}px;top:${link.pos.y}px`;
      a.textContent = "↖";
    } else {
      a.style.cssText = `left:${link.pos.x}px;top:${link.pos.y}px;width:${link.size.x}px;height:${link.size.y}px`;
    }
    if (link.kind === "anchor") {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const m = /scroll\((\d+),(\d+)\)/.exec(link.href);
        if (m) {
          const viewport = host.closest(".viewport") ?? host.parentElement;
          viewport?.scrollTo({
            left: Number(m[1]),
            top: Number(m[2]),
            behavior: "smooth",
          });
        }
      });
    }
    frag.appendChild(a);
  }

  stage.appendChild(frag);
  host.appendChild(stage);
  return stage;
}

/** Apply text scale via one CSS variable (no per-node walk). */
export function setTextScale(host: HTMLElement, scale: number): void {
  const stage = host.querySelector<HTMLElement>(".obml-stage");
  stage?.style.setProperty("--obml-text-scale", String(scale));
}

/** Serialize the page to a standalone HTML document string. */
export function exportHtml(page: Page): string {
  const images = buildDataUrls(page);
  const parts: string[] = [];

  parts.push(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(page.title)}</title>
<style>
html { background: #ddd; }
${VIEWER_CSS}
</style>
</head>
<body>
<div class="obml-stage" style="width:${page.width}px;height:${page.height}px">`);

  for (const box of page.boxes) {
    parts.push(
      `<div class="obml-item obml-box" style="left:${box.pos.x}px;top:${box.pos.y}px;width:${box.size.x}px;height:${box.size.y}px;background-color:${rgba(box.fill)}"></div>`,
    );
  }

  for (const img of page.images) {
    const url = images.get(img.fileAddr);
    const bg = url
      ? `background-image:url('${url}')`
      : `background-color:${rgba(img.fill)}`;
    parts.push(
      `<div class="obml-item obml-img" style="left:${img.pos.x}px;top:${img.pos.y}px;width:${img.size.x}px;height:${img.size.y}px;${bg}"></div>`,
    );
  }

  for (const t of page.texts) {
    parts.push(
      `<div class="obml-item obml-text" style="left:${t.pos.x}px;top:${t.pos.y}px;width:${t.size.x}px;height:${t.size.y}px;color:${rgba(t.color)};--base-fs:${fontSizeCss(t.font)};font-weight:${isBold(t.font) ? "bold" : "normal"}">${escapeHtml(t.text)}</div>`,
    );
  }

  for (const form of page.forms) {
    const style = `left:${form.pos.x}px;top:${form.pos.y}px;width:${form.size.x}px;height:${form.size.y}px;color:${rgba(form.color)}`;
    if (form.kind === "textarea") {
      parts.push(
        `<div class="obml-item obml-field" style="${style}"><textarea class="obml-form" readonly style="width:100%;height:100%;border:none;padding:0">${escapeHtml(form.value)}</textarea></div>`,
      );
    } else if (form.kind === "text") {
      parts.push(
        `<div class="obml-item obml-field" style="${style}"><input class="obml-form" type="text" readonly value="${escapeAttr(form.value)}" style="width:100%;height:100%;border:none;padding:0"></div>`,
      );
    } else if (form.kind === "checkbox" || form.kind === "radio") {
      parts.push(
        `<div class="obml-item obml-field" style="${style}"><input class="obml-form" type="${form.kind}" disabled value="${escapeAttr(form.value)}"></div>`,
      );
    } else if (form.kind === "select") {
      const list =
        form.optionListIndex !== undefined
          ? page.optionLists[form.optionListIndex]
          : undefined;
      const opts = (list ?? [])
        .map(
          (o) =>
            `<option value="${escapeAttr(o.id)}">${escapeHtml(o.label)}</option>`,
        )
        .join("");
      parts.push(
        `<div class="obml-item obml-field" style="${style}"><select class="obml-form" disabled style="width:100%;height:100%">${opts}</select></div>`,
      );
    }
  }

  for (const link of page.links) {
    if (link.kind === "image") {
      parts.push(
        `<a class="obml-item obml-link obml-imglink" href="${escapeAttr(link.href)}" target="_blank" rel="noopener" style="left:${link.pos.x}px;top:${link.pos.y}px">↖</a>`,
      );
    } else {
      parts.push(
        `<a class="obml-item obml-link" href="${escapeAttr(link.href)}" target="_blank" rel="noopener" style="left:${link.pos.x}px;top:${link.pos.y}px;width:${link.size.x}px;height:${link.size.y}px"></a>`,
      );
    }
  }

  parts.push(`</div>
<p style="font:12px sans-serif;color:#666;text-align:center;margin:1em">
Exported from OBML v${page.version} · ${escapeHtml(page.url)}
</p>
</body>
</html>`);

  return parts.join("\n");
}
