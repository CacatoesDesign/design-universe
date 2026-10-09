export type VarValue = number | string | boolean | { alias: string };

export interface Variable {
  id: string;
  name: string;
  type: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  collection: string;
  css: string;
  values: Record<string, VarValue>;
  local: boolean;
}

export interface Collection {
  id: string;
  name: string;
  modes: { id: string; name: string }[];
  orphan: boolean;
}

export interface Paint { c?: string; o?: number; v?: string; img?: 1; g?: string[] }

/** Calque Figma sérialisé par le scan (clés courtes pour tenir dans la sortie MCP). */
export interface FNode {
  t: string;            // Com, Ins, Fra, Tex, Ell, Rec, Vec, Slo…
  n: string;            // nom du calque
  w: number; h: number;
  x?: number; y?: number;
  sh?: 'F' | 'H';       // layoutSizingHorizontal : F = FIXED ou FILL, H = HUG
  sv?: 'F' | 'H';
  f?: Paint[];
  s?: Paint[];
  sw?: number;
  sws?: number[];       // [top, right, bottom, left]
  r?: number | number[];
  op?: number;
  fx?: [string, number, number, number, number, string, number][];
  b?: Record<string, string>;
  tx?: { c: string; fs: number; ff: string; st: string; lh: number | string | null; ls: number; al: string; ar: string };
  lay?: [string, number, number, number, number, number, string, string, number];
  clip?: 1;
  c?: FNode[];
  ref?: string;
  var?: string;
  icon?: string;
  ic?: string;
  icv?: string;
  svg?: string;
}

export interface Variant { id: string; name: string; props: Record<string, string>; tree: FNode }

export interface Use { id: string; name: string; count: number }

export interface Component {
  id: string;
  kind: 'set' | 'component';
  page: string;
  name: string;
  description: string;
  props: Record<string, string | string[]>;
  variantCount: number;
  variants: Variant[];
  uses: Use[];
  /** Section Figma qui regroupe le composant (ex. « Buttons »), pour le filtre de la vue Library. */
  group?: string;
  /** Couche du système (ex. Primitives, Compositions), dans l'ordre de `Library.layers`. */
  layer?: string;
  /** Slots natifs Figma (props SLOT) : le calque du même nom reçoit le contenu. */
  slots?: SlotDef[];
}

/** Prop SLOT d'un composant. `pref` : ids des composants « preferred instances » déclarés dans Figma (souvent vide). */
export interface SlotDef { name: string; pref: string[]; desc?: string }

export interface Screen { id: string; page: string; name: string; w: number; h: number; uses: Use[] }

export interface Library {
  schema: number;
  file: { key: string; name: string; scannedAt: string; via: string };
  collections: Record<string, Collection>;
  variables: Record<string, Variable>;
  components: Record<string, Component>;
  screens: Screen[];
  icons: Record<string, string>;
  iconsPage: { page: string; components: number; groups: Record<string, number> };
  /** Ordre des couches pour la vue Library (colonnes). Absent : colonnes par profondeur d'imbrication. */
  layers?: string[];
}

export type Tier = 'Primitive' | 'Semantic' | 'Component';
export type Modes = Record<string, string>; // collectionId -> modeId
