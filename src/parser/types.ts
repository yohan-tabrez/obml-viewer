export type Color = { a: number; r: number; g: number; b: number };
export type Coords = { x: number; y: number };

export type BoxItem = {
  pos: Coords;
  size: Coords;
  fill: Color;
};

export type ImageItem = {
  pos: Coords;
  size: Coords;
  fill: Color;
  fileAddr: number;
};

export type TextItem = {
  pos: Coords;
  size: Coords;
  color: Color;
  font: number;
  text: string;
};

export type LinkItem = {
  kind: "normal" | "image" | "anchor";
  href: string;
  mimeType: string;
  pos: Coords;
  size: Coords;
};

export type FormItem = {
  kind: "textarea" | "checkbox" | "radio" | "select" | "text" | "unknown";
  value: string;
  pos: Coords;
  size: Coords;
  color: Color;
  /** Index into optionLists for select fields */
  optionListIndex?: number;
};

export type OptionList = Array<{ id: string; label: string }>;

export type EmbeddedFile = {
  addr: number;
  data: Uint8Array;
};

export type Page = {
  version: number;
  title: string;
  url: string;
  width: number;
  height: number;
  boxes: BoxItem[];
  images: ImageItem[];
  texts: TextItem[];
  links: LinkItem[];
  forms: FormItem[];
  optionLists: OptionList[];
  files: EmbeddedFile[];
};
