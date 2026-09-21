import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requireQrManager, baseUrl, publicUrl } from "@/lib/qr-export";

export const dynamic = "force-dynamic";

/**
 * Descarrega a imagem do QR gerada no servidor, em alta resolucao.
 *   /api/qr/<id>?format=png&size=1024   (por omissao)
 *   /api/qr/<id>?format=svg
 *
 * Gerar no servidor resolve a descarga que falhava no browser (o <a download>
 * de um canvas de 150px era pouco fiavel e a imagem ficava pequena de mais
 * para imprimir).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await requireQrManager();
  if (!actor) return NextResponse.json({ error: "Sem permissao" }, { status: 401 });

  const { id } = await ctx.params;
  const qr = await prisma.qrCode.findUnique({
    where: { id },
    select: { slug: true, codigo: true, companyId: true, corPrimaria: true, company: { select: { slug: true } } },
  });
  if (!qr) return NextResponse.json({ error: "QR nao encontrado" }, { status: 404 });
  if (actor.role !== "ADMIN" && qr.companyId !== actor.companyId) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const p = req.nextUrl.searchParams;
  const format = p.get("format") === "svg" ? "svg" : "png";
  const size = Math.min(2048, Math.max(256, Number(p.get("size")) || 1024));
  const url = publicUrl(await baseUrl(), qr.company.slug, qr.codigo);
  const dark = qr.corPrimaria && /^#[0-9a-fA-F]{6}$/.test(qr.corPrimaria) ? qr.corPrimaria : "#000000";

  const opts = { errorCorrectionLevel: "M" as const, margin: 2, color: { dark, light: "#ffffff" } };
  const nomeFicheiro = `${qr.slug || qr.codigo || "qr"}.${format}`;

  if (format === "svg") {
    const svg = await QRCode.toString(url, { ...opts, type: "svg", width: size });
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `attachment; filename="${nomeFicheiro}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const buffer = await QRCode.toBuffer(url, { ...opts, type: "png", width: size });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${nomeFicheiro}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
