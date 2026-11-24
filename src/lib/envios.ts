import "server-only";

import { prisma } from "@/lib/prisma";
import { CHAVES, lerConfig } from "@/lib/configuracao";
import { emailEncomendaEnviada, emailEncomendaNova } from "@/lib/email-pagamentos";
import { appUrl } from "@/lib/stripe";
import { criarPagamentoAvulso } from "@/lib/stripe-pagamentos";

// Produtos enviados por correio. Quem compra escolhe a quantidade, paga o
// produto mais os portes e dá a morada de entrega. Depois de pago, a Inpulse
// recebe um aviso, prepara a encomenda (e, se o produto tiver QR modelo,
// imprime o QR do cliente, que é criado e enviado por email como na loja) e
// marca-a como enviada com o código dos CTT, o que avisa o cliente.

export const MAX_QUANTIDADE = 10;

export type ProdutoLoja = {
  id: string;
  nome: string;
  descricao: string | null;
  imagem: string | null;
  precoCentimos: number;
  portesCentimos: number;
  comQr: boolean;
  esgotado: boolean;
};

export async function produtosAVenda(): Promise<ProdutoLoja[]> {
  const l = await prisma.produtoEnvio.findMany({ where: { ativo: true }, orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
  return l.map((p) => ({
    id: p.id,
    nome: p.nome,
    descricao: p.descricao,
    imagem: p.imagem,
    precoCentimos: p.precoCentimos,
    portesCentimos: p.portesCentimos,
    comQr: Boolean(p.qrModeloId),
    esgotado: p.stock != null && p.stock <= 0,
  }));
}

// Começa uma compra e devolve o id do pagamento (a página é /pagar/<id>).
export async function comprarProduto(produtoId: string, quantidade: number): Promise<string> {
  const p = await prisma.produtoEnvio.findUnique({ where: { id: produtoId } });
  if (!p || !p.ativo) throw new Error("Este produto já não está à venda.");
  const qtd = Math.min(MAX_QUANTIDADE, Math.max(1, Math.floor(quantidade) || 1));
  if (p.stock != null && p.stock < qtd) throw new Error(p.stock > 0 ? `Só há ${p.stock} em stock.` : "Este produto está esgotado.");
  // Cada compra cria um pagamento no Stripe: um limite por produto trava quem
  // carregue em Comprar sem parar.
  const recentes = await prisma.pagamento.count({
    where: { tipo: "envio", produtoId: p.id, estado: "pendente", createdAt: { gte: new Date(Date.now() - 10 * 60_000) } },
  });
  if (recentes >= 30) throw new Error("Demasiados pedidos. Tente de novo dentro de alguns minutos.");
  const id = await criarPagamentoAvulso({
    tipo: "envio",
    valorCentimos: p.precoCentimos * qtd + p.portesCentimos,
    descricao: `Snaptie ${p.nome}${qtd > 1 ? ` (${qtd} unidades)` : ""}`,
    qrModeloId: p.qrModeloId,
    retorno: "/loja",
  });
  await prisma.pagamento.update({ where: { id }, data: { produtoId: p.id, quantidade: qtd } });
  return id;
}

// Depois de pago: a encomenda fica por enviar, o stock desce e a Inpulse é
// avisada. Só corre uma vez por encomenda.
export async function registarEncomenda(pagamentoId: string): Promise<void> {
  const r = await prisma.pagamento.updateMany({
    where: { id: pagamentoId, tipo: "envio", estado: "pago", envioEstado: null },
    data: { envioEstado: "por_enviar" },
  });
  if (r.count === 0) return;
  const p = await prisma.pagamento.findUniqueOrThrow({ where: { id: pagamentoId } });
  if (p.produtoId)
    await prisma.produtoEnvio.updateMany({
      where: { id: p.produtoId, stock: { not: null } },
      data: { stock: { decrement: p.quantidade ?? 1 } },
    });
  const aviso = await lerConfig(CHAVES.avisoAdmin);
  if (aviso)
    await emailEncomendaNova({
      para: aviso,
      produto: (p.descricao ?? "").replace(/^Snaptie\s+/, ""),
      quantidade: p.quantidade ?? 1,
      nome: p.nomeCliente ?? "",
      morada: [p.moradaCliente, [p.cpCliente, p.cidadeCliente].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      telefone: p.telefoneCliente ?? "",
      email: p.email ?? "",
      link: `${appUrl()}/dashboard/pagamentos#encomendas`,
    }).catch((e) => console.error("[envios] aviso", pagamentoId, e));
}

export function linkSeguimento(codigo: string): string {
  return `https://www.ctt.pt/feapl_2/app/open/objectSearch/objectSearch.jspx?objects=${encodeURIComponent(codigo)}`;
}

// A Inpulse marca a encomenda como enviada; o cliente recebe o código para a
// seguir.
export async function marcarEnviada(pagamentoId: string, codigo: string): Promise<void> {
  const cod = codigo.trim().toUpperCase().slice(0, 40);
  const p = await prisma.pagamento.findUnique({ where: { id: pagamentoId } });
  if (!p || p.tipo !== "envio" || p.estado !== "pago") throw new Error("Encomenda não encontrada.");
  await prisma.pagamento.update({
    where: { id: p.id },
    data: { envioEstado: "enviado", envioCodigo: cod || null, enviadoEm: new Date() },
  });
  if (p.email)
    await emailEncomendaEnviada({
      para: p.email,
      nome: p.nomeCliente,
      produto: (p.descricao ?? "").replace(/^Snaptie\s+/, ""),
      codigo: cod || null,
      link: cod ? linkSeguimento(cod) : null,
    });
}

export async function encomendas() {
  const l = await prisma.pagamento.findMany({
    where: { tipo: "envio", estado: "pago" },
    orderBy: { pagoEm: "desc" },
    take: 100,
  });
  const qrs = await prisma.qrCode.findMany({
    where: { id: { in: l.map((p) => p.qrCompradoId).filter((x): x is string => Boolean(x)) } },
    select: { id: true, codigo: true, company: { select: { slug: true } } },
  });
  const linkQr = new Map(qrs.map((q) => [q.id, `/${q.company.slug}/${q.codigo}`]));
  return l.map((p) => ({
    id: p.id,
    produto: (p.descricao ?? "").replace(/^Snaptie\s+/, ""),
    quantidade: p.quantidade ?? 1,
    valorCentimos: p.valorCentimos,
    pagoEm: p.pagoEm?.toISOString() ?? null,
    nome: p.nomeCliente ?? "",
    email: p.email ?? "",
    telefone: p.telefoneCliente ?? "",
    morada: p.moradaCliente ?? "",
    codigoPostal: p.cpCliente ?? "",
    cidade: p.cidadeCliente ?? "",
    estado: p.envioEstado ?? "por_enviar",
    codigo: p.envioCodigo,
    enviadoEm: p.enviadoEm?.toISOString() ?? null,
    qr: p.qrCompradoId ? (linkQr.get(p.qrCompradoId) ?? null) : null,
    temQr: Boolean(p.qrModeloId),
  }));
}
