import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { MarcaOg } from "@/components/brand/marca-og";

// As imagens dos emails: o logótipo e as ilustrações de cada aviso. Os
// programas de email (Gmail, Outlook) não mostram SVG, por isso os desenhos
// saem daqui em PNG, a dobrar a resolução para ficarem nítidos.

export const dynamic = "force-static";

const MARCA = "#4f46e5";
const CLARO = "#e0e7ff";
const MAIS_CLARO = "#eef2ff";
const TINTA = "#18181b";

const ILUSTRACOES = ["pago", "fatura", "falha", "renovacao", "pedido", "suspenso", "reativado"] as const;
type Ilustracao = (typeof ILUSTRACOES)[number];

export function generateStaticParams() {
  return [{ nome: "logo.png" }, ...ILUSTRACOES.map((n) => ({ nome: `${n}.png` }))];
}

async function fonte() {
  return readFile(path.join(process.cwd(), "public", "fonts", "Geist-600.woff"));
}

// Fundo comum: duas manchas suaves, como as ilustrações de produto.
function Fundo({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", width: 440, height: 260, position: "relative", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", left: 70, top: 30, width: 300, height: 200, borderRadius: 120, backgroundColor: MAIS_CLARO }} />
      <div style={{ position: "absolute", left: 250, top: 18, width: 120, height: 120, borderRadius: 60, backgroundColor: CLARO }} />
      <div style={{ position: "absolute", left: 80, top: 150, width: 70, height: 70, borderRadius: 35, backgroundColor: CLARO }} />
      {children}
    </div>
  );
}

function Selo({ cor, simbolo, x, y }: { cor: string; simbolo: "check" | "x" | "!" | "pausa"; x: number; y: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: cor,
        border: "5px solid #ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {simbolo === "check" ? (
        <div style={{ width: 26, height: 14, borderLeft: "6px solid #fff", borderBottom: "6px solid #fff", transform: "rotate(-45deg) translate(2px,-3px)" }} />
      ) : simbolo === "x" ? (
        <div style={{ display: "flex", position: "relative", width: 28, height: 28 }}>
          <div style={{ position: "absolute", left: 11, top: -2, width: 6, height: 32, backgroundColor: "#fff", borderRadius: 3, transform: "rotate(45deg)" }} />
          <div style={{ position: "absolute", left: 11, top: -2, width: 6, height: 32, backgroundColor: "#fff", borderRadius: 3, transform: "rotate(-45deg)" }} />
        </div>
      ) : simbolo === "pausa" ? (
        <div style={{ display: "flex", gap: 7 }}>
          <div style={{ width: 7, height: 24, backgroundColor: "#fff", borderRadius: 2 }} />
          <div style={{ width: 7, height: 24, backgroundColor: "#fff", borderRadius: 2 }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ width: 7, height: 20, backgroundColor: "#fff", borderRadius: 3 }} />
          <div style={{ width: 7, height: 7, backgroundColor: "#fff", borderRadius: 4 }} />
        </div>
      )}
    </div>
  );
}

// Um cartão de pagamento.
function Cartao({ x, y }: { x: number; y: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 210,
        height: 132,
        borderRadius: 16,
        backgroundColor: MARCA,
        display: "flex",
        flexDirection: "column",
        padding: 18,
        boxShadow: "0 12px 28px rgba(79,70,229,.25)",
      }}
    >
      <div style={{ width: 34, height: 26, borderRadius: 6, backgroundColor: "#c7d2fe" }} />
      <div style={{ display: "flex", gap: 10, marginTop: 26 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ width: 34, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,.55)" }} />
        ))}
      </div>
      <div style={{ width: 90, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,.35)", marginTop: 14 }} />
    </div>
  );
}

// Uma folha (fatura, pedido de pagamento).
function Folha({ x, y, euro }: { x: number; y: number; euro?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 150,
        height: 190,
        borderRadius: 12,
        backgroundColor: "#ffffff",
        border: `2px solid ${CLARO}`,
        display: "flex",
        flexDirection: "column",
        padding: 18,
        boxShadow: "0 12px 28px rgba(24,24,27,.10)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <MarcaOg tamanho={22} cor={TINTA} fundo="#ffffff" />
        {euro ? <div style={{ fontSize: 22, color: MARCA, fontFamily: "Geist" }}>€</div> : null}
      </div>
      {[90, 110, 70, 100].map((w, i) => (
        <div key={i} style={{ width: w, height: 7, borderRadius: 4, backgroundColor: i === 0 ? "#c7d2fe" : "#e4e4e7", marginTop: i === 0 ? 20 : 10 }} />
      ))}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22 }}>
        <div style={{ width: 54, height: 12, borderRadius: 4, backgroundColor: MARCA }} />
      </div>
    </div>
  );
}

function Calendario({ x, y }: { x: number; y: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 170,
        height: 160,
        borderRadius: 14,
        backgroundColor: "#ffffff",
        border: `2px solid ${CLARO}`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 12px 28px rgba(24,24,27,.10)",
      }}
    >
      <div style={{ height: 34, backgroundColor: MARCA, display: "flex" }} />
      <div style={{ display: "flex", flexWrap: "wrap", padding: 14, gap: 9 }}>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} style={{ width: 25, height: 20, borderRadius: 5, backgroundColor: i === 6 ? MARCA : "#eef0f4" }} />
        ))}
      </div>
    </div>
  );
}

function desenho(n: Ilustracao) {
  switch (n) {
    case "pago":
      return (
        <Fundo>
          <Cartao x={115} y={62} />
          <Selo cor="#10b981" simbolo="check" x={290} y={150} />
        </Fundo>
      );
    case "fatura":
      return (
        <Fundo>
          <Folha x={145} y={36} />
          <Selo cor="#10b981" simbolo="check" x={262} y={160} />
        </Fundo>
      );
    case "pedido":
      return (
        <Fundo>
          <Folha x={145} y={36} euro />
          <Selo cor={MARCA} simbolo="!" x={262} y={160} />
        </Fundo>
      );
    case "falha":
      return (
        <Fundo>
          <Cartao x={115} y={62} />
          <Selo cor="#ef4444" simbolo="x" x={290} y={150} />
        </Fundo>
      );
    case "renovacao":
      return (
        <Fundo>
          <Calendario x={135} y={50} />
          <Selo cor={MARCA} simbolo="check" x={270} y={160} />
        </Fundo>
      );
    case "suspenso":
      return (
        <Fundo>
          <Folha x={145} y={36} />
          <Selo cor="#f59e0b" simbolo="pausa" x={262} y={160} />
        </Fundo>
      );
    case "reativado":
      return (
        <Fundo>
          <Calendario x={135} y={50} />
          <Selo cor="#10b981" simbolo="check" x={270} y={160} />
        </Fundo>
      );
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ nome: string }> }) {
  const { nome } = await ctx.params;
  const base = nome.replace(/\.png$/, "");
  const fonts = [{ name: "Geist", data: await fonte(), weight: 600 as const, style: "normal" as const }];
  const cache = { "Cache-Control": "public, max-age=31536000, immutable" };

  if (base === "logo") {
    return new ImageResponse(
      (
        <div style={{ display: "flex", alignItems: "center", gap: 16, width: 360, height: 80, justifyContent: "center", backgroundColor: "#ffffff", fontFamily: "Geist" }}>
          <MarcaOg tamanho={52} cor={TINTA} fundo="#ffffff" />
          <div style={{ fontSize: 44, fontWeight: 600, color: TINTA, letterSpacing: -1 }}>Snaptie</div>
        </div>
      ),
      { width: 360, height: 80, fonts, headers: cache },
    );
  }
  if (!(ILUSTRACOES as readonly string[]).includes(base)) return new Response("Nao encontrado", { status: 404 });
  return new ImageResponse(
    <div style={{ display: "flex", backgroundColor: "#ffffff", fontFamily: "Geist" }}>{desenho(base as Ilustracao)}</div>,
    { width: 440, height: 260, fonts, headers: cache },
  );
}
