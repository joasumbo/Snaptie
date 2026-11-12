import "server-only";

import { randomInt } from "node:crypto";
import QRCode from "qrcode";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { uniqueQrCode, uniqueQrSlug } from "@/lib/qr-identity";
import { CHAVES, lerConfig } from "@/lib/configuracao";
import { emailQrEntregue } from "@/lib/email-pagamentos";
import { appUrl } from "@/lib/stripe";
import { criarPagamentoAvulso } from "@/lib/stripe-pagamentos";

// A loja: QRs desenhados pela Inpulse e postos à venda com um preço. Quem
// compra paga na nossa página e, quando o pagamento entra, recebe por email
// a sua própria cópia do QR: a imagem para imprimir, o link da página e o PIN
// para mudar o conteúdo. Não precisa de conta.

export type ModeloLoja = {
  id: string;
  nome: string;
  descricao: string | null;
  imagem: string | null;
  precoCentimos: number;
  exemplo: string | null;
};

export async function modelosAVenda(): Promise<ModeloLoja[]> {
  const l = await prisma.qrCode.findMany({
    where: { precoVenda: { not: null }, company: { deletedAt: null } },
    orderBy: [{ precoVenda: "asc" }, { nome: "asc" }],
    include: { company: { select: { slug: true } } },
  });
  return l.map((q) => ({
    id: q.id,
    nome: q.nome,
    descricao: q.descricao,
    imagem: q.imagemCapa || q.logo,
    precoCentimos: q.precoVenda!,
    exemplo: q.publicado && q.codigo ? `/${q.company.slug}/${q.codigo}` : null,
  }));
}

// Começa uma compra e devolve o id do pagamento (a página é /pagar/<id>).
export async function comprarModelo(modeloId: string): Promise<string> {
  const modelo = await prisma.qrCode.findUnique({ where: { id: modeloId } });
  if (!modelo || modelo.precoVenda == null) throw new Error("Este produto já não está à venda.");
  // Cada compra cria um pagamento no Stripe: um limite por produto trava quem
  // carregue em Comprar sem parar.
  const recentes = await prisma.pagamento.count({
    where: { tipo: "qr", qrId: modelo.id, estado: "pendente", createdAt: { gte: new Date(Date.now() - 10 * 60_000) } },
  });
  if (recentes >= 30) throw new Error("Demasiados pedidos. Tente de novo dentro de alguns minutos.");
  return criarPagamentoAvulso({
    tipo: "qr",
    valorCentimos: modelo.precoVenda,
    descricao: `Snaptie ${modelo.nome}`,
    qrId: modelo.id,
    qrModeloId: modelo.id,
    retorno: "/loja",
  });
}

function novoPin(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// A cópia do modelo para quem pagou: mesmo conteúdo e aparência, aberta a
// toda a gente, editável com o PIN que segue no email.
async function criarCopia(modeloId: string, dono: string, pinHash: string): Promise<string> {
  const m = await prisma.qrCode.findUniqueOrThrow({ where: { id: modeloId }, include: { blocks: true } });
  const nome = `${m.nome} (${dono})`.slice(0, 120);
  const qr = await prisma.qrCode.create({
    data: {
      nome,
      descricao: m.descricao,
      slug: await uniqueQrSlug(nome),
      codigo: await uniqueQrCode(),
      companyId: m.companyId,
      templateId: m.templateId,
      logo: m.logo,
      imagemCapa: m.imagemCapa,
      logoTamanho: m.logoTamanho,
      logoForma: m.logoForma,
      nomeTamanho: m.nomeTamanho,
      mostrarLogo: m.mostrarLogo,
      mostrarNome: m.mostrarNome,
      edicaoPublica: true,
      edicaoPersonalizacao: true,
      edicaoPin: pinHash,
      acessoModo: "aberto",
      idioma: m.idioma,
      corPrimaria: m.corPrimaria,
      corSecundaria: m.corSecundaria,
      estado: "ativo",
      publicado: true,
      cartaz: m.cartaz === null ? Prisma.JsonNull : (m.cartaz as Prisma.InputJsonValue),
    },
  });
  if (m.blocks.length) {
    await prisma.qrBlock.createMany({
      data: m.blocks.map((b) => ({
        qrId: qr.id,
        tipo: b.tipo,
        titulo: b.titulo,
        icone: b.icone,
        cor: b.cor,
        descricao: b.descricao,
        conteudo: b.conteudo === null ? Prisma.JsonNull : (b.conteudo as Prisma.InputJsonValue),
        ordem: b.ordem,
        ativo: b.ativo,
        // Quem comprou edita tudo o que é conteúdo.
        editavelPublico: true,
      })),
    });
  }
  return qr.id;
}

// Depois de pago: cria a cópia (uma vez) e envia o email com o QR. Com
// "reenviar", gera um PIN novo (o antigo não está guardado em claro) e manda
// outra vez, para o email da compra ou para outro.
export async function entregarQr(pagamentoId: string, opcoes: { reenviar?: boolean; para?: string } = {}): Promise<boolean> {
  const p = await prisma.pagamento.findUnique({ where: { id: pagamentoId } });
  // O modelo: o produto da loja, ou o QR demo escolhido no elemento Pagamento.
  const modeloId = p?.qrModeloId ?? (p?.tipo === "qr" ? p.qrId : null);
  if (!p || p.estado !== "pago" || !modeloId) return false;
  if (p.qrEntregueEm && !opcoes.reenviar) return false;
  const para = opcoes.para || p.email;
  if (!para) return false;

  const pin = novoPin();
  const pinHash = await hashPassword(pin);
  let qrId = p.qrCompradoId;
  if (!qrId) {
    const criado = await criarCopia(modeloId, p.nomeCliente || para, pinHash);
    // Dois avisos ao mesmo tempo (webhook e página) não criam duas cópias.
    const r = await prisma.pagamento.updateMany({ where: { id: p.id, qrCompradoId: null }, data: { qrCompradoId: criado } });
    if (r.count === 0) {
      await prisma.qrCode.delete({ where: { id: criado } });
      return false;
    }
    qrId = criado;
  } else {
    await prisma.qrCode.update({ where: { id: qrId }, data: { edicaoPin: pinHash } });
  }

  const qr = await prisma.qrCode.findUniqueOrThrow({ where: { id: qrId }, include: { company: { select: { slug: true } } } });
  const link = `${appUrl()}/${qr.company.slug}/${qr.codigo}`;
  const cor = qr.corPrimaria && /^#[0-9a-fA-F]{6}$/.test(qr.corPrimaria) ? qr.corPrimaria : "#000000";
  const opts = { errorCorrectionLevel: "M" as const, margin: 2, color: { dark: cor, light: "#ffffff" } };
  const png = await QRCode.toBuffer(link, { ...opts, type: "png", width: 1024 });
  const svg = await QRCode.toString(link, { ...opts, type: "svg", width: 1024 });

  await emailQrEntregue({
    para,
    copia: (await lerConfig(CHAVES.avisoAdmin)) || null,
    nome: p.nomeCliente,
    produto: (p.descricao ?? "").replace(/^Snaptie\s+/, "") || qr.nome,
    link,
    pin,
    png,
    svg,
    ficheiro: qr.codigo ?? "qr",
  });
  await prisma.pagamento.update({ where: { id: p.id }, data: { qrEntregueEm: new Date() } });
  return true;
}

// Para o temporizador: compras pagas há mais de 5 minutos cujo QR não chegou
// a sair (uma falha do email, por exemplo).
export async function entregasEmAtraso(): Promise<number> {
  const l = await prisma.pagamento.findMany({
    where: { qrModeloId: { not: null }, estado: "pago", qrEntregueEm: null, pagoEm: { lt: new Date(Date.now() - 5 * 60_000) } },
    select: { id: true },
    take: 20,
  });
  let n = 0;
  for (const p of l) if (await entregarQr(p.id).catch((e) => (console.error("[loja] entrega", p.id, e), false))) n++;
  return n;
}

// Admin: pôr um QR à venda (preço em cêntimos) ou tirá-lo (null).
export async function precoNaLoja(qrId: string, precoCentimos: number | null) {
  await prisma.qrCode.update({ where: { id: qrId }, data: { precoVenda: precoCentimos } });
}
