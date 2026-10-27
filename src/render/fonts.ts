/** Font size mapping from OBML font flags (bold bit masked out). */
export const FONT_SIZES: Record<number, string> = {
  0: "11px", // medium (default)
  2: "12px", // large
  4: "13px", // extra large
  6: "10px", // small
};

export const DEFAULT_LINE_HEIGHT = "1.1";

export function fontSizeCss(font: number): string {
  const size = font & ~1;
  return FONT_SIZES[size] ?? FONT_SIZES[0]!;
}

export function isBold(font: number): boolean {
  return (font & 1) !== 0;
}
