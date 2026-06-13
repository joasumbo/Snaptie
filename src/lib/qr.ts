import type { BlockType } from "@prisma/client";

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  TEXTO: "Texto",
  LINK: "Link",
  IMAGEM: "Imagem",
  VIDEO: "Vídeo",
  PDF: "PDF",
  CHAT: "Chat",
  FEED: "Feed",
  FORMULARIO: "Formulário",
  MAPA: "Mapa",
  GALERIA: "Galeria",
  PLAYLIST: "Playlist",
};

// Block types available to use in this phase.
export const ACTIVE_BLOCK_TYPES: BlockType[] = [
  "TEXTO",
  "LINK",
  "IMAGEM",
  "VIDEO",
  "PDF",
];

export const BLOCK_TYPE_OPTIONS = ACTIVE_BLOCK_TYPES.map((value) => ({
  label: BLOCK_TYPE_LABELS[value],
  value,
}));

// Whether a block type carries a URL (vs. free text).
export function isUrlBlock(tipo: BlockType): boolean {
  return tipo === "LINK" || tipo === "IMAGEM" || tipo === "VIDEO" || tipo === "PDF";
}
