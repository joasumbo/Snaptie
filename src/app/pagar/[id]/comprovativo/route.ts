import { NextRequest, NextResponse } from "next/server";
import { pdfComprovativo } from "@/lib/cobrancas";

export const dynamic = "force-dynamic";

// O comprovativo de um pagamento feito. O endereço do pagamento é o que dá
// acesso, tal como à página de pagar: só o tem quem recebeu o link.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{10,40}$/.test(id)) return NextResponse.json({ error: "Pedido invalido" }, { status: 400 });
  const r = await pdfComprovativo(id).catch((e) => {
    console.error("[comprovativo]", id, e);
    return null;
  });
  if (!r) return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });
  return new NextResponse(new Uint8Array(r.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="comprovativo-${r.numero}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
