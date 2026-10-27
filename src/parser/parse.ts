import { BinaryReader, bytesEqual, charCode } from "./binary";
import type {
  FormItem,
  OptionList,
  Page,
} from "./types";

const SUPPORTED = new Set([6, 12, 13, 15, 16]);

function ascii(type: number): string {
  return type >= 32 && type < 127 ? String.fromCharCode(type) : `\\x${type.toString(16).padStart(2, "0")}`;
}

/**
 * Parse an OBML / OBML16 ArrayBuffer into a Page model.
 * Logic ported from grawity/obml-parser (MIT).
 */
export function parseObml(buffer: ArrayBuffer): Page {
  const f = new BinaryReader(buffer);

  let expectedSize = f.readMedium();
  const totalStart = f.tell();
  let version = f.readByte();

  let expTotalBytes: number;

  if (version === 16) {
    if (expectedSize !== 0x02d355) {
      throw new Error(
        `Bad OBML16 fake header size: 0x${expectedSize.toString(16)} (expected 0x02d355)`,
      );
    }
    expectedSize = f.readMedium();
    version = f.readByte();
    expTotalBytes = expectedSize + 7;
  } else if (version === 15) {
    throw new Error("Bad header for version 15 (expected fake version 16 prefix)");
  } else {
    expTotalBytes = expectedSize + 3;
  }

  if (!SUPPORTED.has(version)) {
    throw new Error(`Unsupported OBML version ${version}`);
  }

  const pageSize = f.readCoords();
  if (version === 16) {
    const pad = f.read(2);
    if (
      !bytesEqual(pad, new Uint8Array([0x00, 0x00])) &&
      !bytesEqual(pad, new Uint8Array([0xff, 0xff]))
    ) {
      throw new Error(`Unexpected v16 header padding: ${Array.from(pad).map((b) => b.toString(16)).join(" ")}`);
    }
  } else {
    const pad = f.read(5);
    if (!bytesEqual(pad, new Uint8Array([0x53, 0x00, 0x00, 0xff, 0xff]))) {
      throw new Error(
        `Unexpected header padding: ${Array.from(pad).map((b) => b.toString(16)).join(" ")}`,
      );
    }
  }

  const pageTitle = f.readString();
  f.readBlob(); // unknown header blob
  f.urlBase = f.readString();
  const pageUrl = f.readUrl();

  if (version >= 15) {
    f.read(6);
  } else if (version === 6) {
    f.read(1);
  } else {
    f.readShort();
    f.readMedium();
  }

  const page: Page = {
    version,
    title: pageTitle,
    url: pageUrl,
    width: pageSize.x,
    height: pageSize.y,
    boxes: [],
    images: [],
    texts: [],
    links: [],
    forms: [],
    optionLists: [],
    files: [],
  };

  // --- metadata ---
  let expLinksBytes = 0;
  while (true) {
    const type = charCode(f.read(1));
    if (type === 0x43 /* C */) {
      if (version >= 15) {
        f.read(23);
      } else {
        throw new Error(`Unhandled metadata chunk C/v${version}`);
      }
    } else if (type === 0x4d /* M */) {
      f.read(2);
      f.readBlob();
    } else if (type === 0x53 /* S */) {
      expLinksBytes = f.readMedium();
      break;
    } else {
      throw new Error(`Unknown metadata chunk '${ascii(type)}'`);
    }
  }

  // --- links sub-section ---
  const linksEnd = f.tell() + expLinksBytes;
  while (f.tell() < linksEnd) {
    const type = charCode(f.read(1));

    if (type === 0x00) {
      f.read(1);
      const n = f.readByte();
      const options: OptionList = [];
      for (let j = 0; j < n; j++) {
        const id = f.readString();
        const label = f.readString();
        options.push({ id, label });
      }
      page.optionLists.push(options);
      continue;
    }

    const regionTypes = new Set([0x69, 0x4c, 0x50, 0x77, 0x57]); // i L P w W
    const unknownRegionV15 = new Set([0x43, 0x49, 0x4e, 0x53]); // C I N S
    const unknownRegionV13 = new Set([0x53]); // S
    const unknownRegionV12 = new Set([0x43, 0x49, 0x4e, 0x53]); // C I N S

    if (regionTypes.has(type)) {
      const n = f.readByte();
      const boxes: Array<{ pos: { x: number; y: number }; size: { x: number; y: number } }> = [];
      // grawity's parser reads link rect positions without rel_to_abs
      for (let j = 0; j < n; j++) {
        const pos = f.readCoords();
        const size = f.readCoords();
        boxes.push({ pos, size });
      }

      let linkUrl: string;
      let linkType: string;
      if (version >= 15 || version === 13) {
        linkUrl = f.readUrl();
        f.read(2);
        linkType = f.readString();
      } else {
        linkType = f.readString();
        linkUrl = f.readUrl();
      }

      if (type === 0x69 /* i */) {
        for (const { pos, size } of boxes) {
          if (size.x > 16 && size.y > 16) {
            page.links.push({
              kind: "image",
              href: linkUrl,
              mimeType: linkType,
              pos,
              size,
            });
          }
        }
      } else if (!linkUrl.startsWith("b:")) {
        for (const { pos, size } of boxes) {
          page.links.push({
            kind: "normal",
            href: linkUrl,
            mimeType: linkType,
            pos,
            size,
          });
        }
      }
    } else if (unknownRegionV15.has(type) && version >= 15) {
      skipRegion(f, version, true);
    } else if (unknownRegionV13.has(type) && version === 13) {
      skipRegion(f, version, true);
    } else if (type === 0x4e /* N */ && version === 12) {
      const n = f.readByte();
      const boxes: Array<{ pos: { x: number; y: number }; size: { x: number; y: number } }> = [];
      for (let j = 0; j < n; j++) {
        boxes.push({ pos: f.readCoords(), size: f.readCoords() });
      }
      f.readBlob(); // link_type
      const linkTarget = f.readBlob();
      const g = new BinaryReader(linkTarget.slice().buffer as ArrayBuffer);
      const targetCoords = g.readCoords();
      g.readString(); // anchor name
      for (const { pos, size } of boxes) {
        page.links.push({
          kind: "anchor",
          href: `javascript:window.scroll(${targetCoords.x},${targetCoords.y})`,
          mimeType: "",
          pos,
          size,
        });
      }
    } else if (unknownRegionV12.has(type) && (version === 12 || version === 6)) {
      skipRegion(f, version, false);
    } else {
      throw new Error(`Unknown link chunk '${ascii(type)}'/v${version}`);
    }
  }

  if (f.tell() !== linksEnd) {
    throw new Error(`Link section ended at ${f.tell()}, expected ${linksEnd}`);
  }

  // --- content ---
  const contentEnd = expTotalBytes;
  let optionListCursor = 0;

  while (f.tell() < contentEnd) {
    const type = charCode(f.read(1));

    if (type === 0x42 /* B */) {
      const pos = version >= 15 ? f.readCoords(true) : f.readCoords();
      const size = f.readCoords();
      const fill = f.readColor();
      page.boxes.push({ pos, size, fill });
    } else if (type === 0x46 /* F */) {
      let pos = version >= 15 ? f.readCoords(true) : f.readCoords();
      let size = f.readCoords();
      const color = f.readColor();
      const fieldType = charCode(f.read(1));
      f.read(1);
      f.readString(); // field_id
      const fieldValue = f.readString();
      if (version >= 15) f.read(5);
      else f.read(3);

      if (fieldType === 0x63 /* c */ || fieldType === 0x72 /* r */) {
        pos = { x: pos.x - 8, y: pos.y - 8 };
        size = { x: size.x + 8, y: size.y + 8 };
      }

      const kindMap: Record<number, FormItem["kind"]> = {
        0x61: "textarea",
        0x63: "checkbox",
        0x72: "radio",
        0x73: "select",
        0x78: "text",
      };
      const kind = kindMap[fieldType] ?? "unknown";
      const form: FormItem = { kind, value: fieldValue, pos, size, color };
      if (kind === "select") {
        form.optionListIndex = optionListCursor++;
      }
      page.forms.push(form);
    } else if (type === 0x49 /* I */) {
      if (version === 16) {
        const pos = f.readCoords(true);
        const size = f.readCoords();
        const fill = f.readColor();
        const addr = f.readMedium();
        const n = f.readByte();
        for (let j = 0; j < n; j++) {
          f.read(1);
          f.readBlob();
        }
        page.images.push({ pos, size, fill, fileAddr: addr });
      } else if (version === 15) {
        // Mirror v16 layout (grawity speculated they match). Fall back to the
        // historical fixed 14-byte skip + color placeholder if that fails.
        const pos = f.readCoords(true);
        const size = f.readCoords();
        const fill = f.readColor();
        const mark = f.tell();
        try {
          const addr = f.readMedium();
          const n = f.readByte();
          if (n > 8) throw new Error("implausible v15 image trailer count");
          for (let j = 0; j < n; j++) {
            f.read(1);
            f.readBlob();
          }
          page.images.push({ pos, size, fill, fileAddr: addr });
        } catch {
          f.seek(mark);
          f.read(14);
          page.boxes.push({ pos, size, fill });
        }
      } else {
        const pos = f.readCoords();
        const size = f.readCoords();
        const fill = f.readColor();
        f.read(3);
        const addr = f.readMedium();
        page.images.push({ pos, size, fill, fileAddr: addr });
      }
    } else if (type === 0x4c /* L */) {
      f.readMedium();
      f.readMedium();
      f.readMedium();
    } else if (type === 0x4d /* M */) {
      f.read(2);
      f.readBlob();
    } else if (type === 0x53 /* S */) {
      const expFilesBytes = f.readMedium();
      const filesStart = f.tell();
      const filesEnd = filesStart + expFilesBytes;
      while (f.tell() < filesEnd) {
        const addr =
          version === 6 ? f.tell() - totalStart : f.tell() - filesStart;
        const data = f.readBlob();
        page.files.push({ addr, data });
      }
      if (f.tell() !== filesEnd) {
        throw new Error(
          `Content files section ended at ${f.tell()}, expected ${filesEnd}`,
        );
      }
      break;
    } else if (type === 0x54 /* T */) {
      if (version === 16) {
        const pos = f.readCoords(true);
        const size = f.readCoords();
        const color = f.readColor();
        f.read(1);
        const font = 4 | (f.readByte() & 1);
        const n = f.readByte();
        for (let j = 0; j < n; j++) {
          f.read(1);
          f.readBlob();
        }
        const text = f.readString();
        page.texts.push({ pos, size, color, font, text });
      } else if (version === 15) {
        const pos = f.readCoords(true);
        const size = f.readCoords();
        const color = f.readColor();
        const font = f.readByte();
        const text = f.readString();
        page.texts.push({ pos, size, color, font, text });
      } else {
        const pos = f.readCoords();
        const size = f.readCoords();
        const color = f.readColor();
        const font = f.readByte();
        const text = f.readString();
        page.texts.push({ pos, size, color, font, text });
      }
    } else if (type === 0x7a /* z */) {
      if (version === 16) {
        f.read(6);
      } else {
        throw new Error(`Unhandled content chunk z/v${version}`);
      }
    } else {
      throw new Error(`Unknown content chunk '${ascii(type)}'/v${version}`);
    }
  }

  if (f.tell() !== contentEnd) {
    throw new Error(`Content section ended at ${f.tell()}, expected ${contentEnd}`);
  }

  return page;
}

function skipRegion(f: BinaryReader, _version: number, withMidPad: boolean): void {
  const n = f.readByte();
  for (let j = 0; j < n; j++) {
    f.readCoords();
    f.readCoords();
  }
  f.readBlob();
  if (withMidPad) {
    f.read(2);
  }
  f.readBlob();
}
