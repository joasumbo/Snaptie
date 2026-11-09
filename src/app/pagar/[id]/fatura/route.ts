import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lerPdfGuardado } from "@/lib/moloni-faturas";

export const dynamic = "force-dynamic";

// O PDF da Moloni guardado no nosso R2. O endereço do pagamento é o que dá
// acesso, tal como à página de pagar.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{10,40}$/.test(id)) return NextResponse.json({ error: "Pedido invalido" }, { status: 400 });
  const p = await prisma.pagamento.findUnique({ where: { id }, select: { moloniFaturaPdf: true, moloniFatura: true } });
  if (!p?.moloniFaturaPdf) return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });
  try {
    const pdf = await lerPdfGuardado(p.moloniFaturaPdf);
    const nome = `fatura-recibo-${(p.moloniFatura ?? id).replace(/[^\w.-]+/g, "-")}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${nome}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[fatura]", id, e);
    return NextResponse.json({ error: "Indisponivel" }, { status: 502 });
  }
}
