import type { BlockType } from "@prisma/client";

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  TEXTO: "Texto",
  LINK: "Link",
  WHATSAPP: "WhatsApp",
  TELEFONE: "Telefone",
  EMAIL: "Email",
  MAPA: "Google Maps",
  WIFI: "Wi-Fi",
  PDF: "PDF",
  IMAGEM: "Imagem",
  CARROSSEL: "Carrossel",
  VIDEO: "Vídeo",
  CHAT: "Chat",
  FEED: "Feed",
  FORMULARIO: "Formulário",
  GALERIA: "Galeria",
  PLAYLIST: "Playlist",
};

// Action elements render as buttons; content elements render inline on the page.
export const ACTION_TYPES: BlockType[] = [
  "LINK",
  "WHATSAPP",
  "TELEFONE",
  "EMAIL",
  "MAPA",
  "WIFI",
  "PDF",
  "TEXTO",
];

export const CONTENT_TYPES: BlockType[] = ["IMAGEM", "CARROSSEL", "VIDEO"];

export function isContentBlock(tipo: BlockType): boolean {
  return CONTENT_TYPES.includes(tipo);
}

// Default lucide icon name per action type (used when no custom icon is set).
export const DEFAULT_ICON: Partial<Record<BlockType, string>> = {
  LINK: "Globe",
  WHATSAPP: "MessageCircle",
  TELEFONE: "Phone",
  EMAIL: "Mail",
  MAPA: "MapPin",
  WIFI: "Wifi",
  PDF: "FileText",
  TEXTO: "Type",
};

// What the editor form should ask for each type.
export type FieldKind =
  | "url"
  | "texto"
  | "telefone"
  | "email"
  | "whatsapp"
  | "wifi"
  | "imagem"
  | "video"
  | "pdf"
  | "carrossel";

export const TYPE_FIELD: Record<BlockType, FieldKind> = {
  LINK: "url",
  TEXTO: "texto",
  TELEFONE: "telefone",
  EMAIL: "email",
  WHATSAPP: "whatsapp",
  MAPA: "url",
  WIFI: "wifi",
  PDF: "pdf",
  IMAGEM: "imagem",
  VIDEO: "video",
  CARROSSEL: "carrossel",
  // unused future types fall back to a URL field
  CHAT: "url",
  FEED: "url",
  FORMULARIO: "url",
  GALERIA: "carrossel",
  PLAYLIST: "url",
};

// Builds the public href for an action element from its stored content.
export function actionHref(tipo: BlockType, conteudo: Record<string, unknown>): string | null {
  const str = (k: string) => (typeof conteudo[k] === "string" ? (conteudo[k] as string) : "");
  switch (tipo) {
    case "LINK":
    case "MAPA":
    case "PDF":
      return str("url") || null;
    case "TELEFONE":
      return str("numero") ? `tel:${str("numero").replace(/\s+/g, "")}` : null;
    case "EMAIL":
      return str("email") ? `mailto:${str("email")}` : null;
    case "WHATSAPP": {
      const num = str("numero").replace(/[^\d]/g, "");
      if (!num) return null;
      const msg = str("mensagem");
      return `https://wa.me/${num}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
    }
    default:
      return null;
  }
}
