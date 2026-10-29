import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { accessCookieName, hasAccess } from "@/lib/auth/qr-access";
import { lerOcorrencias, ocorrenciasXlsx, respostaXlsx } from "@/lib/ocorrencias";

export const dynamic = "force-dynamic";

/**
 * O Excel do elemento "Lista de ocorrências" de uma página: as ocorrências de
 * todas as lojas da empresa dona da página.
 *   /api/ocorrencias/bloco/<blockId>?codigo=<código do QR>
 *
 * Sem login, porque é para quem abre a página. As barreiras são as da própria
 * página: o elemento tem de existir, estar ativo e numa página publicada com
 * esse código; se a página pede PIN, só descarrega quem já o introduziu. E só
 * sai a empresa dessa página, nunca outra.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const codigo = req.nextUrl.searchParams.get("codigo") ?? "";
  if (!codigo) return NextResponse.json({ error: "Pedido invalido" }, { status: 400 });

  const block = await prisma.qrBlock.findFirst({
    where: { id, tipo: "OCORRENCIAS", ativo: true, qr: { codigo, publicado: true } },
    select: {
      qr: {
        select: {
          id: true,
          companyId: true,
          acessoModo: true,
          ativadoEm: true,
          company: { select: { slug: true } },
        },
      },
    },
  });
  if (!block) return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });

  const qr = block.qr;
  if (qr.acessoModo === "ativacao" && !qr.ativadoEm) {
    return NextResponse.json({ error: "Pagina por ativar" }, { status: 403 });
  }
  if (qr.acessoModo === "privado") {
    const token = (await cookies()).get(accessCookieName(qr.id))?.value;
    if (!(await hasAccess(token, qr.id))) {
      return NextResponse.json({ error: "Introduza o PIN da pagina" }, { status: 403 });
    }
  }

  return respostaXlsx(ocorrenciasXlsx(await lerOcorrencias(qr.companyId), false), qr.company.slug);
}
