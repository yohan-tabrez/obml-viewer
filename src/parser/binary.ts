import type { Color, Coords } from "./types";

/** Binary cursor over OBML big-endian fields. Ported from grawity/obml-parser. */
export class BinaryReader {
  private view: DataView;
  private offset = 0;
  urlBase = "\0";
  lastX = 0;
  lastY = 0;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  get length(): number {
    return this.view.byteLength;
  }

  tell(): number {
    return this.offset;
  }

  seek(offset: number): void {
    if (offset < 0 || offset > this.view.byteLength) {
      throw new Error(`Seek out of range: ${offset}`);
    }
    this.offset = offset;
  }

  private ensure(n: number): void {
    if (this.offset + n > this.view.byteLength) {
      throw new Error(
        `Hit EOF after ${this.view.byteLength - this.offset}/${n} bytes at offset ${this.offset}`,
      );
    }
  }

  read(length: number): Uint8Array {
    this.ensure(length);
    const slice = new Uint8Array(this.view.buffer, this.offset, length);
    this.offset += length;
    return slice;
  }

  readByte(): number {
    this.ensure(1);
    const v = this.view.getUint8(this.offset);
    this.offset += 1;
    return v;
  }

  /** Unsigned 16-bit big-endian (matches grawity's `>H`). */
  readShort(): number {
    this.ensure(2);
    const v = this.view.getUint16(this.offset, false);
    this.offset += 2;
    return v;
  }

  /** Unsigned 24-bit big-endian. */
  readMedium(): number {
    this.ensure(3);
    const hi = this.view.getUint8(this.offset);
    const lo = this.view.getUint16(this.offset + 1, false);
    this.offset += 3;
    return (hi << 16) | lo;
  }

  readBlob(): Uint8Array {
    const length = this.readShort();
    return this.read(length);
  }

  readString(): string {
    const buf = this.readBlob();
    return new TextDecoder("utf-8").decode(buf);
  }

  readUrl(base?: string): string {
    let buf = this.readString();
    if (buf.length > 0 && buf.charCodeAt(0) === 0) {
      const prefix = base ?? this.urlBase;
      buf = prefix + buf.slice(1);
    }
    return buf;
  }

  readColor(): Color {
    return {
      a: this.readByte(),
      r: this.readByte(),
      g: this.readByte(),
      b: this.readByte(),
    };
  }

  readCoords(relToAbs = false): Coords {
    let x = this.readShort();
    let y = this.readMedium();
    if (relToAbs) {
      this.lastX = x = (this.lastX + x) & 0xffff;
      this.lastY = y = (this.lastY + y) & 0xffffff;
    }
    return { x, y };
  }
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function charCode(buf: Uint8Array): number {
  if (buf.length !== 1) throw new Error(`Expected 1 byte, got ${buf.length}`);
  return buf[0]!;
}
