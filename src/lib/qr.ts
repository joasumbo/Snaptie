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
  BOTAO_IMAGEM: "Botão com imagem",
  PAR_BOTOES: "Dois botões lado a lado",
  MANUTENCAO: "Manutenção",
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
  "BOTAO_IMAGEM",
  "PAR_BOTOES",
  "FEED",
  "MANUTENCAO",
  "CHAT",
];

// Os dois botões lado a lado são sempre dois e ocupam metade da largura cada —
// não há forma nem tamanho a escolher, é essa a razão de ser do elemento.
export const PAR_BOTOES_N = 2;

export type ParBotao = { imagem: string; url: string; texto: string };

export function parBotoes(conteudo: Record<string, unknown>): ParBotao[] {
  const lista = Array.isArray(conteudo.botoes) ? conteudo.botoes : [];
  return Array.from({ length: PAR_BOTOES_N }, (_, i) => {
    const b = lista[i];
    const r = b && typeof b === "object" ? (b as Record<string, unknown>) : {};
    const s = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : "");
    return { imagem: s("imagem"), url: s("url"), texto: s("texto") };
  });
}

// O botão com imagem tem forma e tamanho próprios, ao contrário dos restantes
// elementos, que ocupam sempre a largura da coluna.
export const BUTTON_SHAPES = [
  { valor: "horizontal", nome: "Retangular horizontal" },
  { valor: "vertical", nome: "Retangular vertical" },
  { valor: "quadrado", nome: "Quadrado" },
  { valor: "redondo", nome: "Redondo" },
] as const;

export type ButtonShape = (typeof BUTTON_SHAPES)[number]["valor"];

// A proporção é a da forma; o tamanho decide a largura. Só o 5 enche a coluna —
// nos restantes o botão fica centrado, senão um "redondo pequeno" esticava e
// deixava de ser redondo.
export const BUTTON_ASPECT: Record<ButtonShape, string> = {
  horizontal: "aspect-[16/9]",
  vertical: "aspect-[3/4]",
  quadrado: "aspect-square",
  redondo: "aspect-square",
};

export const BUTTON_WIDTH: Record<string, string> = {
  "1": "35%",
  "2": "50%",
  "3": "65%",
  "4": "80%",
  "5": "100%",
};

export function buttonShape(valor: unknown): ButtonShape {
  return BUTTON_SHAPES.some((f) => f.valor === valor)
    ? (valor as ButtonShape)
    : "horizontal";
}

export function buttonWidth(valor: unknown): string {
  return BUTTON_WIDTH[String(valor)] ?? BUTTON_WIDTH["5"];
}

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
  | "registo"
  | "botaoImagem"
  | "parBotoes"
  | "manutencao";

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
  BOTAO_IMAGEM: "botaoImagem",
  PAR_BOTOES: "parBotoes",
  MANUTENCAO: "manutencao",
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

// O mural de manutenção e o mural de mensagens são a mesma coisa por baixo:
// mesma tabela, mesmo componente, mesmas barreiras. O que os separa é o aviso
// por email e o estado de cada participação.
export function isMural(tipo: BlockType): boolean {
  return tipo === "FEED" || tipo === "MANUTENCAO";
}

// Guarda-se o estado, não a cor. Assim a paleta pode mudar, e mais tarde dá
// para filtrar ou contar o que está por resolver — coisas que guardar "verde"
// tornava impossíveis.
export const ESTADOS_MANUTENCAO = [
  { valor: "para_fazer", rotulo: "Para fazer", cor: "#fed7aa", texto: "#7c2d12" },
  { valor: "em_resolucao", rotulo: "Em resolução", cor: "#fef08a", texto: "#713f12" },
  { valor: "resolvido", rotulo: "Resolvido", cor: "#bbf7d0", texto: "#14532d" },
] as const;

export type EstadoManutencao = (typeof ESTADOS_MANUTENCAO)[number]["valor"];

// Toda a participação nova entra como "para fazer": uma avaria acabada de
// comunicar está, por definição, por resolver.
export const ESTADO_INICIAL: EstadoManutencao = "para_fazer";

export function estadoManutencao(valor: unknown) {
  return (
    ESTADOS_MANUTENCAO.find((e) => e.valor === valor) ??
    ESTADOS_MANUTENCAO.find((e) => e.valor === ESTADO_INICIAL)!
  );
}

// Os dois endereços que recebem aviso. O primeiro é obrigatório, o segundo não.
export function emailsManutencao(conteudo: Record<string, unknown>): string[] {
  const lista = Array.isArray(conteudo.emails) ? conteudo.emails : [];
  return lista
    .filter((e): e is string => typeof e === "string")
    .map((e) => e.trim())
    .filter(Boolean);
}
