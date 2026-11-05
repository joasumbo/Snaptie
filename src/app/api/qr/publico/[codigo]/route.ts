import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { baseUrl, publicUrl } from "@/lib/qr-export";

export const dynamic = "force-dynamic";

/**
 * O QR de uma página publicada, para o elemento "Descarregar o QR".
 *   /api/qr/publico/<codigo>?format=svg            para mostrar na página
 *   /api/qr/publico/<codigo>?format=png&download=1 para guardar
 *
 * Sem login: o QR só contém o endereço da página, que quem a está a ver já
 * tem. Mesmo assim, só para páginas publicadas que tenham este elemento.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await ctx.params;
  const qr = await prisma.qrCode.findFirst({
    where: { codigo, publicado: true, blocks: { some: { tipo: "DESCARREGAR_QR", ativo: true } } },
    select: { slug: true, codigo: true, corPrimaria: true, company: { select: { slug: true } } },
  });
  if (!qr) return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });

  const p = req.nextUrl.searchParams;
  const formato = p.get("format") === "svg" ? "svg" : "png";
  const descarregar = p.get("download") === "1";
  const url = publicUrl(await baseUrl(), qr.company.slug, qr.codigo);
  const dark = qr.corPrimaria && /^#[0-9a-fA-F]{6}$/.test(qr.corPrimaria) ? qr.corPrimaria : "#000000";
  const opts = { errorCorrectionLevel: "M" as const, margin: 2, color: { dark, light: "#ffffff" } };
  const nome = `${qr.slug || qr.codigo || "qr"}.${formato}`;
  const disposicao = descarregar ? `attachment; filename="${nome}"` : "inline";

  if (formato === "svg") {
    const svg = await QRCode.toString(url, { ...opts, type: "svg", width: 512 });
    return new NextResponse(svg, {
      headers: { "Content-Type": "image/svg+xml", "Content-Disposition": disposicao, "Cache-Control": "public, max-age=3600" },
    });
  }
  const png = await QRCode.toBuffer(url, { ...opts, type: "png", width: 1024 });
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Content-Disposition": disposicao, "Cache-Control": "public, max-age=3600" },
  });
}
