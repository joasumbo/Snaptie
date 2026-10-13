// O cartaz para imprimir de um QR: uma folha com imagens, títulos, frases,
// linhas e o próprio QR, empilhados de cima para baixo.
//
// O mesmo componente desenha a pré-visualização no editor e o PNG final no
// servidor (next/og). Por isso os estilos ficam dentro do que o motor do PNG
// entende: flexbox, sem grelhas, e qualquer div com mais de um filho tem de
// ser display:flex. O que se vê no editor é o que sai na impressão.
//
// As medidas estão numa escala própria: a folha tem 1000 unidades de largura,
// seja qual for o tamanho do papel. Ao desenhar multiplica-se pela escala, e
// assim o mesmo desenho serve para A6 ou A4 sem refazer nada.

import type { CSSProperties, ReactElement } from "react";

export const LARGURA_BASE = 1000;

export type Alinhamento = "left" | "center" | "right";

export type ElementoCartaz =
  | {
      id: string;
      tipo: "texto";
      texto: string;
      tamanho: number;
      peso: 400 | 600 | 800;
      cor: string;
      alinhar: Alinhamento;
      maiusculas: boolean;
    }
  | { id: string; tipo: "imagem"; src: string; altura: number; proporcao: number; alinhar: Alinhamento }
  | { id: string; tipo: "linha"; cor: string; espessura: number; largura: number }
  | { id: string; tipo: "qr"; tamanho: number }
  | { id: string; tipo: "espaco"; altura: number; flexivel: boolean };

export type TipoElemento = ElementoCartaz["tipo"];

export type Cartaz = {
  formato: FormatoId;
  // Só contam quando o formato é "personalizado"; nos outros vêm da tabela.
  larguraMm: number;
  alturaMm: number;
  fundo: string;
  margem: number;
  espacamento: number;
  borda: { ativa: boolean; cor: string; espessura: number; raio: number };
  elementos: ElementoCartaz[];
};

export const FORMATOS = {
  A6: { nome: "A6 (10,5 × 14,8 cm)", larguraMm: 105, alturaMm: 148 },
  A5: { nome: "A5 (14,8 × 21 cm)", larguraMm: 148, alturaMm: 210 },
  A4: { nome: "A4 (21 × 29,7 cm)", larguraMm: 210, alturaMm: 297 },
  quadrado: { nome: "Quadrado (10 × 10 cm)", larguraMm: 100, alturaMm: 100 },
  personalizado: { nome: "Personalizado", larguraMm: 0, alturaMm: 0 },
} as const;

export type FormatoId = keyof typeof FORMATOS;

export function medidasMm(c: Cartaz): { larguraMm: number; alturaMm: number } {
  if (c.formato === "personalizado") {
    return { larguraMm: c.larguraMm, alturaMm: c.alturaMm };
  }
  return FORMATOS[c.formato];
}

// Pixéis para imprimir a uma dada resolução (300 dpi é o habitual em gráfica).
export function pixeis(c: Cartaz, dpi: number): { largura: number; altura: number } {
  const { larguraMm, alturaMm } = medidasMm(c);
  return {
    largura: Math.round((larguraMm / 25.4) * dpi),
    altura: Math.round((alturaMm / 25.4) * dpi),
  };
}

export type VariaveisCartaz = { nome: string; empresa: string; link: string; codigo: string };

// {nome}, {empresa}, {link} e {codigo} trocam-se pelos dados de cada QR. É o
// que deixa desenhar um cartaz uma vez e imprimi-lo para 40 lojas, cada uma
// com o seu nome.
export function aplicarVariaveis(texto: string, v: VariaveisCartaz): string {
  return texto
    .replaceAll("{nome}", v.nome)
    .replaceAll("{empresa}", v.empresa)
    .replaceAll("{link}", v.link)
    .replaceAll("{codigo}", v.codigo);
}

export function novoId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function novoElemento(tipo: TipoElemento, cor: string): ElementoCartaz {
  const id = novoId();
  switch (tipo) {
    case "texto":
      return { id, tipo, texto: "Texto", tamanho: 44, peso: 400, cor, alinhar: "center", maiusculas: false };
    case "imagem":
      return { id, tipo, src: "", altura: 160, proporcao: 1, alinhar: "center" };
    case "linha":
      return { id, tipo, cor, espessura: 3, largura: 100 };
    case "qr":
      return { id, tipo, tamanho: 480 };
    case "espaco":
      return { id, tipo, altura: 40, flexivel: false };
  }
}

// O ponto de partida: o formato do cartaz da Quebramar (logótipo, linha,
// título grande, QR, frase e rodapé), já com as cores da empresa.
export function cartazInicial(opts: { cor: string; logo: string | null; logoProporcao?: number }): Cartaz {
  const cor = opts.cor;
  const elementos: ElementoCartaz[] = [];
  if (opts.logo) {
    elementos.push({
      id: novoId(),
      tipo: "imagem",
      src: opts.logo,
      altura: 130,
      proporcao: opts.logoProporcao ?? 1,
      alinhar: "center",
    });
    elementos.push({ id: novoId(), tipo: "linha", cor, espessura: 3, largura: 100 });
  }
  elementos.push(
    { id: novoId(), tipo: "texto", texto: "{nome}", tamanho: 96, peso: 800, cor, alinhar: "center", maiusculas: true },
    { id: novoId(), tipo: "qr", tamanho: 520 },
    {
      id: novoId(),
      tipo: "texto",
      texto: "Aponte a câmara para abrir a página.",
      tamanho: 38,
      peso: 400,
      cor,
      alinhar: "center",
      maiusculas: false,
    },
    { id: novoId(), tipo: "espaco", altura: 20, flexivel: true },
    { id: novoId(), tipo: "linha", cor, espessura: 2, largura: 100 },
    { id: novoId(), tipo: "texto", texto: "{empresa}", tamanho: 26, peso: 600, cor, alinhar: "center", maiusculas: true },
  );
  return {
    formato: "A6",
    larguraMm: 105,
    alturaMm: 148,
    fundo: "#ffffff",
    margem: 60,
    espacamento: 28,
    borda: { ativa: true, cor, espessura: 6, raio: 28 },
    elementos,
  };
}

// --- validação ------------------------------------------------------------
// O cartaz chega do browser; antes de o guardar, tudo é posto dentro de
// limites. Um número absurdo não pode virar um PNG de 50 000 pixéis.

const COR = /^#[0-9a-fA-F]{6}$/;

function num(v: unknown, min: number, max: number, padrao: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(max, Math.max(min, n));
}
function cor(v: unknown, padrao: string): string {
  return typeof v === "string" && COR.test(v) ? v : padrao;
}
function alinhar(v: unknown): Alinhamento {
  return v === "left" || v === "right" ? v : "center";
}
function texto(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

export function validarCartaz(input: unknown, imagemPermitida: (src: string) => boolean): Cartaz | null {
  if (!input || typeof input !== "object") return null;
  const c = input as Record<string, unknown>;
  const formato = (typeof c.formato === "string" && c.formato in FORMATOS ? c.formato : "A6") as FormatoId;
  const b = (c.borda && typeof c.borda === "object" ? c.borda : {}) as Record<string, unknown>;
  const lista = Array.isArray(c.elementos) ? c.elementos.slice(0, 40) : [];

  const elementos: ElementoCartaz[] = [];
  for (const raw of lista) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    const id = typeof e.id === "string" && e.id ? e.id.slice(0, 20) : novoId();
    switch (e.tipo) {
      case "texto": {
        const peso = Number(e.peso);
        elementos.push({
          id,
          tipo: "texto",
          texto: texto(e.texto, 400),
          tamanho: num(e.tamanho, 10, 300, 44),
          peso: peso === 600 || peso === 800 ? peso : 400,
          cor: cor(e.cor, "#18181b"),
          alinhar: alinhar(e.alinhar),
          maiusculas: e.maiusculas === true,
        });
        break;
      }
      case "imagem": {
        const src = texto(e.src, 1000);
        if (src && !imagemPermitida(src)) break;
        elementos.push({
          id,
          tipo: "imagem",
          src,
          altura: num(e.altura, 20, 1400, 160),
          proporcao: num(e.proporcao, 0.05, 20, 1),
          alinhar: alinhar(e.alinhar),
        });
        break;
      }
      case "linha":
        elementos.push({
          id,
          tipo: "linha",
          cor: cor(e.cor, "#18181b"),
          espessura: num(e.espessura, 1, 40, 3),
          largura: num(e.largura, 5, 100, 100),
        });
        break;
      case "qr":
        elementos.push({ id, tipo: "qr", tamanho: num(e.tamanho, 120, 1000, 480) });
        break;
      case "espaco":
        elementos.push({ id, tipo: "espaco", altura: num(e.altura, 0, 800, 40), flexivel: e.flexivel === true });
        break;
    }
  }

  return {
    formato,
    larguraMm: num(c.larguraMm, 30, 600, 105),
    alturaMm: num(c.alturaMm, 30, 900, 148),
    fundo: cor(c.fundo, "#ffffff"),
    margem: num(c.margem, 0, 300, 60),
    espacamento: num(c.espacamento, 0, 200, 28),
    borda: {
      ativa: b.ativa === true,
      cor: cor(b.cor, "#18181b"),
      espessura: num(b.espessura, 1, 60, 6),
      raio: num(b.raio, 0, 300, 28),
    },
    elementos,
  };
}

// --- desenho ----------------------------------------------------------------

const ALINHAR_FLEX: Record<Alinhamento, CSSProperties["alignSelf"]> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
};

export function CartazView({
  cartaz,
  largura,
  qrSrc,
  variaveis,
  fonte,
  selecionado,
  onSelecionar,
}: {
  cartaz: Cartaz;
  // Largura final em pixéis; a altura sai do formato do papel.
  largura: number;
  qrSrc: string;
  variaveis: VariaveisCartaz;
  fonte: string;
  // Só no editor: tocar num elemento abre-o para editar. O PNG não passa
  // nada disto, e o desenho fica igual.
  selecionado?: string | null;
  onSelecionar?: (id: string) => void;
}): ReactElement {
  const { larguraMm, alturaMm } = medidasMm(cartaz);
  const altura = Math.round(largura * (alturaMm / larguraMm));
  const s = largura / LARGURA_BASE;
  const px = (n: number) => Math.max(0, Math.round(n * s * 100) / 100);
  const larguraUtil = LARGURA_BASE - cartaz.margem * 2;
  const tocavel = (id: string): { onClick?: () => void; style: CSSProperties } =>
    onSelecionar
      ? {
          onClick: () => onSelecionar(id),
          style: {
            cursor: "pointer",
            outline: selecionado === id ? "2px dashed #6366f1" : undefined,
            outlineOffset: 2,
          },
        }
      : { style: {} };

  const conteudo = cartaz.elementos.map((e) => {
    switch (e.tipo) {
      case "texto": {
        const t = aplicarVariaveis(e.texto, variaveis);
        return (
          <div
            key={e.id}
            onClick={tocavel(e.id).onClick}
            style={{
              ...tocavel(e.id).style,
              display: "flex",
              width: "100%",
              justifyContent: ALINHAR_FLEX[e.alinhar] as CSSProperties["justifyContent"],
              textAlign: e.alinhar,
              fontSize: px(e.tamanho),
              fontWeight: e.peso,
              color: e.cor,
              lineHeight: 1.15,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {e.maiusculas ? t.toUpperCase() : t}
          </div>
        );
      }
      case "imagem": {
        if (!e.src) return null;
        // A largura sai da proporção da imagem, mas nunca passa da folha.
        const w = Math.min(e.altura * e.proporcao, larguraUtil);
        const h = w / e.proporcao;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={e.id}
            src={e.src}
            alt=""
            width={px(w)}
            height={px(h)}
            onClick={tocavel(e.id).onClick}
            style={{
              ...tocavel(e.id).style,
              alignSelf: ALINHAR_FLEX[e.alinhar],
              width: px(w),
              height: px(h),
              objectFit: "contain",
            }}
          />
        );
      }
      case "linha":
        return (
          <div
            key={e.id}
            onClick={tocavel(e.id).onClick}
            style={{
              ...tocavel(e.id).style,
              display: "flex",
              alignSelf: "center",
              width: `${e.largura}%`,
              height: Math.max(1, px(e.espessura)),
              backgroundColor: e.cor,
              flexShrink: 0,
            }}
          />
        );
      case "qr": {
        const t = px(Math.min(e.tamanho, larguraUtil));
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={e.id}
            src={qrSrc}
            alt=""
            width={t}
            height={t}
            onClick={tocavel(e.id).onClick}
            style={{ ...tocavel(e.id).style, alignSelf: "center", width: t, height: t, flexShrink: 0 }}
          />
        );
      }
      case "espaco":
        return (
          <div
            key={e.id}
            onClick={tocavel(e.id).onClick}
            style={{
              ...tocavel(e.id).style,
              display: "flex",
              height: px(e.altura),
              flexGrow: e.flexivel ? 1 : 0,
              flexShrink: 0,
            }}
          />
        );
    }
  });

  const borda = cartaz.borda;
  return (
    <div
      style={{
        display: "flex",
        width: largura,
        height: altura,
        backgroundColor: cartaz.fundo,
        fontFamily: fonte,
        padding: borda.ativa ? px(Math.min(cartaz.margem, 40) / 2) : 0,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          width: "100%",
          height: "100%",
          gap: px(cartaz.espacamento),
          padding: px(borda.ativa ? cartaz.margem - Math.min(cartaz.margem, 40) / 2 : cartaz.margem),
          border: borda.ativa ? `${px(borda.espessura)}px solid ${borda.cor}` : "none",
          borderRadius: borda.ativa ? px(borda.raio) : 0,
          overflow: "hidden",
        }}
      >
        {conteudo.filter(Boolean)}
      </div>
    </div>
  );
}
