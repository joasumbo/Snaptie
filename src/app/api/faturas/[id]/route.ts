import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { pdfDaFatura } from "@/lib/stripe-pagamentos";

export const dynamic = "force-dynamic";

// O PDF de uma fatura da empresa de quem pede, descarregado por nós para o
// cliente nunca sair do Snaptie.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const u = await getCurrentUser();
  if (!u?.companyId || u.role !== "GESTOR_EMPRESA") {
    return NextResponse.json({ error: "Sem permissao" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!/^in_[A-Za-z0-9]+$/.test(id)) return NextResponse.json({ error: "Pedido invalido" }, { status: 400 });

  const r = await pdfDaFatura(u.companyId, id).catch(() => null);
  if (!r) return NextResponse.json({ error: "Nao encontrada" }, { status: 404 });
  return new NextResponse(r.pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${r.nome}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
