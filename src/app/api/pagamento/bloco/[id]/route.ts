import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { accessCookieName, hasAccess } from "@/lib/auth/qr-access";
import { PAGAMENTO_MAX_CENTIMOS, PAGAMENTO_MIN_CENTIMOS, lerPagamento } from "@/lib/pagamentos";
import { stripeConfigurado } from "@/lib/stripe";
import { criarPagamentoAvulso } from "@/lib/stripe-pagamentos";

export const dynamic = "force-dynamic";

/**
 * O botão do elemento "Pagamento" de uma página: cria o pagamento e devolve
 * o endereço da nossa página de pagamento, /pagar/<id>.
 *   POST /api/pagamento/bloco/<blockId>  { codigo, valor?, locale? }
 *
 * O valor vem do elemento guardado; o do visitante só conta quando o elemento
 * deixa escolher, e mesmo assim dentro dos limites. As barreiras de acesso são
 * as da página.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!stripeConfigurado()) return NextResponse.json({ error: "Pagamentos indisponiveis" }, { status: 503 });
  const { id: blockId } = await ctx.params;
  const corpo = (await req.json().catch(() => ({}))) as { codigo?: string; valor?: number; locale?: string };
  const codigo = typeof corpo.codigo === "string" ? corpo.codigo : "";
  if (!codigo) return NextResponse.json({ error: "Pedido invalido" }, { status: 400 });

  const block = await prisma.qrBlock.findFirst({
    where: { id: blockId, tipo: "PAGAMENTO", ativo: true, qr: { codigo, publicado: true } },
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
    where: { blockId, estado: "pendente", createdAt: { gte: new Date(Date.now() - 10 * 60_000) } },
  });
  if (recentes >= 30) return NextResponse.json({ error: "Demasiados pedidos" }, { status: 429 });

  // Com um QR demo escolhido no elemento, quem paga recebe uma cópia dele.
  // Só vale um QR da mesma empresa da página.
  const modelo = conf.copiaQrId
    ? await prisma.qrCode.findFirst({ where: { id: conf.copiaQrId, companyId: qr.companyId }, select: { id: true } })
    : null;

  try {
    const id = await criarPagamentoAvulso({
      tipo: "botao",
      valorCentimos: valor,
      descricao: block.titulo || "Pagamento",
      companyId: qr.companyId,
      qrId: qr.id,
      qrModeloId: modelo?.id ?? null,
      blockId: blockId,
      retorno: `/${qr.company.slug}/${qr.codigo}`,
    });
    const url = `/pagar/${id}`;
    return NextResponse.json({ url });
  } catch (e) {
    console.error("[pagamento bloco]", blockId, e);
    return NextResponse.json({ error: "Falhou" }, { status: 502 });
  }
}
