import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireQrManager, baseUrl, publicUrl } from "@/lib/qr-export";
import { ErroCartaz, lerCartaz, nomeFicheiro, renderCartazPng } from "@/lib/cartaz-render";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * O cartaz de um QR em PNG, pronto a imprimir.
 *   /api/qr/<id>/cartaz            300 dpi
 *   /api/qr/<id>/cartaz?dpi=150    mais leve, para ver no ecrã
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await requireQrManager();
  if (!actor) return NextResponse.json({ error: "Sem permissao" }, { status: 401 });

  const { id } = await ctx.params;
  const qr = await prisma.qrCode.findUnique({
    where: { id },
    select: {
      nome: true,
      codigo: true,
      companyId: true,
      corPrimaria: true,
      cartaz: true,
      company: { select: { nome: true, slug: true, logo: true } },
    },
  });
  if (!qr) return NextResponse.json({ error: "QR nao encontrado" }, { status: 404 });
  if (actor.role !== "ADMIN" && qr.companyId !== actor.companyId) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const dpi = req.nextUrl.searchParams.get("dpi") === "150" ? 150 : 300;
  const cor = qr.corPrimaria && /^#[0-9a-fA-F]{6}$/.test(qr.corPrimaria) ? qr.corPrimaria : "#000000";
  const link = publicUrl(await baseUrl(), qr.company.slug, qr.codigo);

  try {
    const png = await renderCartazPng(lerCartaz(qr.cartaz, { cor, logo: qr.company.logo }), {
      link,
      cor,
      dpi,
      variaveis: { nome: qr.nome, empresa: qr.company.nome, link, codigo: qr.codigo ?? "" },
    });
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${nomeFicheiro(qr.nome, qr.codigo)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof ErroCartaz) return NextResponse.json({ error: e.message }, { status: 422 });
    console.error("[cartaz]", e);
    return NextResponse.json({ error: "Nao foi possivel gerar o cartaz." }, { status: 500 });
  }
}
