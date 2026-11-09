import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { accessCookieName, hasAccess } from "@/lib/auth/qr-access";
import { PAGAMENTO_MAX_CENTIMOS, PAGAMENTO_MIN_CENTIMOS, lerPagamento } from "@/lib/pagamentos";
import { appUrl, stripeConfigurado } from "@/lib/stripe";
import { checkoutBotao } from "@/lib/stripe-pagamentos";

export const dynamic = "force-dynamic";

/**
 * O botão do elemento "Pagamento" de uma página: abre o checkout do Stripe.
 *   POST /api/pagamento/bloco/<blockId>  { codigo, valor?, locale? }
 *
 * O valor vem do elemento guardado; o do visitante só conta quando o elemento
 * deixa escolher, e mesmo assim dentro dos limites. As barreiras de acesso são
 * as da página.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!stripeConfigurado()) return NextResponse.json({ error: "Pagamentos indisponiveis" }, { status: 503 });
  const { id } = await ctx.params;
  const corpo = (await req.json().catch(() => ({}))) as { codigo?: string; valor?: number; locale?: string };
  const codigo = typeof corpo.codigo === "string" ? corpo.codigo : "";
  if (!codigo) return NextResponse.json({ error: "Pedido invalido" }, { status: 400 });

  const block = await prisma.qrBlock.findFirst({
    where: { id, tipo: "PAGAMENTO", ativo: true, qr: { codigo, publicado: true } },
    select: {
      titulo: true,
      conteudo: true,
      qr: {
        select: {
          id: true,
          nome: true,
          codigo: true,
          companyId: true,
          acessoModo: true,
          ativadoEm: true,
          company: { select: { slug: true, nome: true, estado: true } },
        },
      },
    },
  });
  if (!block || block.qr.company.estado !== "ATIVA") {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });
  }

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

  const conf = lerPagamento((block.conteudo ?? {}) as Record<string, unknown>);
  const valor = conf.valorLivre ? Math.round(Number(corpo.valor)) : conf.valorCentimos;
  if (!Number.isInteger(valor) || valor < PAGAMENTO_MIN_CENTIMOS || valor > PAGAMENTO_MAX_CENTIMOS) {
    return NextResponse.json({ error: "Valor invalido" }, { status: 400 });
  }

  // Sem login, qualquer um pode carregar no botão em ciclo. Cada clique cria
  // uma linha e uma sessão no Stripe: acima disto, espera-se um pouco.
  const recentes = await prisma.pagamento.count({
    where: { blockId: id, estado: "pendente", createdAt: { gte: new Date(Date.now() - 10 * 60_000) } },
  });
  if (recentes >= 30) return NextResponse.json({ error: "Demasiados pedidos" }, { status: 429 });

  try {
    const url = await checkoutBotao({
      companyId: qr.companyId,
      qrId: qr.id,
      blockId: id,
      nome: block.titulo || "Pagamento",
      pagina: `${qr.company.nome} · ${qr.nome}`,
      valorCentimos: valor,
      urlPagina: `${appUrl()}/${qr.company.slug}/${qr.codigo}`,
      locale: typeof corpo.locale === "string" ? corpo.locale : "pt",
    });
    return NextResponse.json({ url });
  } catch (e) {
    console.error("[pagamento bloco]", id, e);
    return NextResponse.json({ error: "Falhou" }, { status: 502 });
  }
}
