import type { BlockType } from "@prisma/client";

// How a visitor reaches the page.
//   aberto   — anyone who scans sees it (the hotel plaque)
//   ativacao — the first visitor holding the PIN activates the QR; from then on
//              it behaves like "aberto" (the souvenir)
//   privado  — the PIN is asked on every visit
export const ACCESS_MODES = ["aberto", "ativacao", "privado"] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];

export function isAccessMode(value: string): value is AccessMode {
  return (ACCESS_MODES as readonly string[]).includes(value);
}

// Whether the mode needs a PIN to be set at all.
export function accessNeedsPin(modo: string): boolean {
  return modo === "ativacao" || modo === "privado";
}

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
  TITULO: "Título",
  LOGO: "Logótipo",
  CHAT: "Registo / Histórico",
  FEED: "Mural de mensagens",
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

export const CONTENT_TYPES: BlockType[] = [
  "TITULO",
  "LOGO",
  "IMAGEM",
  "CARROSSEL",
  "VIDEO",
  "FEED",
  "CHAT",
];

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
  | "titulo"
  | "telefone"
  | "email"
  | "whatsapp"
  | "wifi"
  | "imagem"
  | "video"
  | "pdf"
  | "carrossel"
  | "mural"
  | "registo";

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
  TITULO: "titulo",
  LOGO: "imagem",
  // The wall has no content to fill in: the visitors write it.
  FEED: "mural",
  // Botões que marcam acontecimentos com a hora, mais o histórico do que já
  // foi marcado. Guarda em qr_messages, tal como o mural.
  CHAT: "registo",
  // unused future types fall back to a URL field
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
