import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { ImageResponse } from "next/og";
import {
  CartazView,
  LARGURA_BASE,
  cartazInicial,
  pixeis,
  validarCartaz,
  type Cartaz,
  type VariaveisCartaz,
} from "@/lib/cartaz";

// Desenha o cartaz de um QR como PNG, à resolução de impressão.

type Fonte = { name: string; data: Buffer; weight: 400 | 600 | 800; style: "normal" };

// As fontes vivem em public/fonts: é a pasta que segue para o contentor.
let fontes: Promise<Fonte[]> | null = null;
function carregarFontes(): Promise<Fonte[]> {
  fontes ??= Promise.all(
    ([400, 600, 800] as const).map(async (weight) => ({
      name: "Geist",
      data: await readFile(path.join(process.cwd(), "public", "fonts", `Geist-${weight}.woff`)),
      weight,
      style: "normal" as const,
    })),
  );
  return fontes;
}

// Só se desenham imagens do nosso armazenamento: o servidor vai buscá-las, e
// aceitar qualquer endereço punha-o a fazer pedidos a sítios arbitrários.
export function imagemPermitida(src: string): boolean {
  const base = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
  return Boolean(base) && src.startsWith(`${base}/`);
}

export function lerCartaz(guardado: unknown, fallback: { cor: string; logo: string | null }): Cartaz {
  return validarCartaz(guardado, imagemPermitida) ?? cartazInicial(fallback);
}

export class ErroCartaz extends Error {}

// O motor do PNG lê PNG, JPG e SVG. WebP não: em vez de um quadrado vazio na
// impressão, avisa-se quem está a gerar.
async function embutir(src: string, cache: Map<string, string>): Promise<string> {
  const guardada = cache.get(src);
  if (guardada) return guardada;
  if (!imagemPermitida(src)) throw new ErroCartaz("Há uma imagem que não vem do armazenamento do Snaptie.");
  const res = await fetch(src);
  if (!res.ok) throw new ErroCartaz(`Não foi possível carregar uma imagem (${res.status}).`);
  const tipo = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!["image/png", "image/jpeg", "image/svg+xml"].includes(tipo)) {
    throw new ErroCartaz("Uma das imagens está num formato que não dá para imprimir (use PNG ou JPG).");
  }
  const dataUri = `data:${tipo};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  cache.set(src, dataUri);
  return dataUri;
}

export async function renderCartazPng(
  cartaz: Cartaz,
  opts: { link: string; cor: string; variaveis: VariaveisCartaz; dpi?: number; cache?: Map<string, string> },
): Promise<Buffer> {
  const { largura, altura } = pixeis(cartaz, opts.dpi ?? 300);
  const cache = opts.cache ?? new Map<string, string>();

  // O QR é gerado já ao tamanho em que vai ser impresso, para sair nítido.
  const maiorQr = Math.max(0, ...cartaz.elementos.map((e) => (e.tipo === "qr" ? e.tamanho : 0)));
  const qrPx = Math.max(256, Math.round((maiorQr / LARGURA_BASE) * largura));
  const qrSrc = await QRCode.toDataURL(opts.link, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: qrPx,
    color: { dark: opts.cor, light: "#ffffff" },
  });

  const elementos = await Promise.all(
    cartaz.elementos.map(async (e) =>
      e.tipo === "imagem" && e.src ? { ...e, src: await embutir(e.src, cache) } : e,
    ),
  );

  const resposta = new ImageResponse(
    (
      <CartazView
        cartaz={{ ...cartaz, elementos }}
        largura={largura}
        qrSrc={qrSrc}
        variaveis={opts.variaveis}
        fonte="Geist"
      />
    ),
    { width: largura, height: altura, fonts: await carregarFontes() },
  );
  return Buffer.from(await resposta.arrayBuffer());
}

// Nome de ficheiro seguro a partir do nome do QR.
export function nomeFicheiro(nome: string, codigo: string | null): string {
  const base = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
  return `${base || "cartaz"}${codigo ? `-${codigo}` : ""}.png`;
}
