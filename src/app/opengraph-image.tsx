import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { MarcaOg } from "@/components/brand/marca-og";

// A imagem que aparece ao partilhar um link do Snaptie sem imagem própria.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Snaptie";

export default async function OpenGraphImage() {
  const negrito = await readFile(path.join(process.cwd(), "public", "fonts", "Geist-800.woff"));
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: 1200,
          height: 630,
          alignItems: "center",
          justifyContent: "center",
          gap: 48,
          backgroundColor: "#18181b",
          fontFamily: "Geist",
        }}
      >
        <MarcaOg tamanho={220} cor="#ffffff" fundo="#18181b" />
        <div style={{ display: "flex", fontSize: 140, fontWeight: 800, color: "#ffffff", letterSpacing: -4 }}>
          Snaptie
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Geist", data: negrito, weight: 800, style: "normal" }] },
  );
}
