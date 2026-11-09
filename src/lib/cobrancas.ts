import "server-only";

import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { CHAVES, diasTolerancia, lerConfig, lerEmissor, numeroComprovativo } from "@/lib/configuracao";
import { gerarComprovativo, type DadosComprovativo } from "@/lib/comprovativo-pdf";
import {
  emailPagamentoFalhou,
  emailPagamentoRecebido,
  emailRenovacaoFalhou,
  emailRenovacaoProxima,
  emailServicoReativado,
  emailServicoSuspenso,
} from "@/lib/email-pagamentos";
import { appUrl, stripe } from "@/lib/stripe";
import { euros } from "@/lib/pagamentos";

// O que acontece à volta de cada pagamento: o comprovativo e o email, os
// avisos quando falha, a renovação que se aproxima e a suspensão quando o
// dinheiro não chega. Tudo pode correr mais de uma vez sem mandar emails
// repetidos: cada passo deixa marca na base.

function dia(d: Date): string {
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Lisbon" });
}

async function copiaAdmin(): Promise<string | null> {
  return (await lerConfig(CHAVES.avisoAdmin)) || null;
}

const NOMES_METODO: Record<string, string> = {
  card: "Cartão",
  mb_way: "MB WAY",
  multibanco: "Multibanco",
  sepa_debit: "Débito direto SEPA",
  paypal: "PayPal",
  klarna: "Klarna",
};

async function metodoDoIntent(intentId: string): Promise<string | null> {
  const intent = await stripe().paymentIntents.retrieve(intentId, { expand: ["latest_charge"] });
  const carga = intent.latest_charge as Stripe.Charge | null;
  const det = carga?.payment_method_details;
  if (!det) return null;
  if (det.card) return `${det.card.brand ? det.card.brand.toUpperCase() : "Cartão"} terminado em ${det.card.last4}`;
  return NOMES_METODO[det.type] ?? det.type;
}

// Método e período a partir da referência guardada no pagamento.
async function detalhesStripe(ref: string): Promise<{ metodo: string | null; periodo: string | null }> {
  try {
    if (ref.startsWith("pi_")) return { metodo: await metodoDoIntent(ref), periodo: null };
    if (ref.startsWith("in_")) {
      const fatura = await stripe().invoices.retrieve(ref, { expand: ["payments"] });
      const linha = fatura.lines.data[0];
      const periodo = linha?.period
        ? `Período de ${dia(new Date(linha.period.start * 1000))} a ${dia(new Date(linha.period.end * 1000))}`
        : null;
      const pag = fatura.payments?.data?.[0]?.payment;
      const intent = pag && "payment_intent" in pag ? pag.payment_intent : null;
      const intentId = typeof intent === "string" ? intent : (intent?.id ?? null);
      return { metodo: intentId ? await metodoDoIntent(intentId) : null, periodo };
    }
  } catch (e) {
    console.error("[cobrancas] detalhes", ref, e);
  }
  return { metodo: null, periodo: null };
}

// Monta os dados do comprovativo de um pagamento pago. Dá-lhe número na
// primeira vez; as seguintes reaproveitam-no.
export async function dadosComprovativo(pagamentoId: string): Promise<DadosComprovativo | null> {
  let p = await prisma.pagamento.findUnique({
    where: { id: pagamentoId },
    include: { company: true, pacote: { select: { intervalo: true } } },
  });
  if (!p || p.estado !== "pago") return null;
  if (!p.numero) {
    const numero = await numeroComprovativo(p.pagoEm ?? new Date());
    await prisma.pagamento.updateMany({ where: { id: p.id, numero: null }, data: { numero } });
    p = await prisma.pagamento.findUniqueOrThrow({
      where: { id: pagamentoId },
      include: { company: true, pacote: { select: { intervalo: true } } },
    });
  }

  const { metodo, periodo } = p.stripeSessionId ? await detalhesStripe(p.stripeSessionId) : { metodo: null, periodo: null };
  let detalhe = periodo;
  if (!detalhe && p.tipo === "botao" && p.qrId) {
    const qr = await prisma.qrCode.findUnique({ where: { id: p.qrId }, select: { nome: true } });
    detalhe = qr ? `Pagamento na página ${qr.nome}` : null;
  }
  if (!detalhe && p.tipo === "pacote" && p.pacote?.intervalo === "unico") detalhe = "Pagamento único";

  // Pagamentos de uma empresa (pacotes, renovações) levam os dados dela; os
  // avulsos levam o que a pessoa escreveu na página de pagamento.
  const daEmpresa = (p.tipo === "pacote" || p.tipo === "renovacao") && p.company;
  return {
    numero: p.numero!,
    pagoEm: p.pagoEm ?? p.updatedAt,
    descricao: p.tipo === "renovacao" || p.tipo === "pacote" ? `Snaptie ${p.descricao ?? ""}`.trim() : p.descricao || "Pagamento",
    detalhe,
    valorCentimos: p.valorCentimos,
    moeda: p.moeda,
    metodo,
    referencia: p.id.slice(-10).toUpperCase(),
    cliente: {
      nome: p.nomeCliente || (daEmpresa ? p.company!.nome : null),
      nif: p.nifCliente || (daEmpresa ? p.company!.nif : null),
      morada: p.moradaCliente || (daEmpresa ? p.company!.morada : null),
      email: p.email || (daEmpresa ? p.company!.email : null),
    },
    emissor: await lerEmissor(),
  };
}

export async function pdfComprovativo(pagamentoId: string): Promise<{ pdf: Buffer; numero: string } | null> {
  const d = await dadosComprovativo(pagamentoId);
  if (!d) return null;
  return { pdf: await gerarComprovativo(d), numero: d.numero };
}

// Depois de um pagamento confirmado: comprovativo por email e, se a empresa
// estava em falta ou suspensa, volta tudo ao normal.
export async function aposPagamento(pagamentoId: string, reenviar = false): Promise<void> {
  const p = await prisma.pagamento.findUnique({ where: { id: pagamentoId }, include: { company: true } });
  if (!p || p.estado !== "pago") return;

  if (p.company && (p.tipo === "pacote" || p.tipo === "renovacao")) {
    const estavaSuspensa = p.company.suspensaPagamento;
    if (estavaSuspensa || p.company.emFaltaDesde) {
      await prisma.company.update({
        where: { id: p.company.id },
        data: { suspensaPagamento: false, emFaltaDesde: null },
      });
      if (estavaSuspensa) {
        await emailServicoReativado({ para: p.company.email, nome: p.company.nome }).catch((e) =>
          console.error("[cobrancas] reativado", p.company!.id, e),
        );
      }
    }
  }

  if (p.emailEnviadoEm && !reenviar) return;
  const para = p.email || p.company?.email;
  if (!para) return;

  // Marca antes de enviar: dois avisos ao mesmo tempo (webhook e página)
  // não mandam dois emails. Se o envio falhar, desmarca para tentar de novo.
  if (!reenviar) {
    const r = await prisma.pagamento.updateMany({
      where: { id: p.id, emailEnviadoEm: null },
      data: { emailEnviadoEm: new Date() },
    });
    if (r.count === 0) return;
  }
  try {
    const d = await dadosComprovativo(p.id);
    if (!d) return;
    await emailPagamentoRecebido({
      para,
      copia: await copiaAdmin(),
      nome: d.cliente.nome,
      descricao: d.descricao,
      valor: euros(d.valorCentimos, d.moeda),
      numero: d.numero,
      data: dia(d.pagoEm),
      pdf: await gerarComprovativo(d),
    });
  } catch (e) {
    console.error("[cobrancas] email pagamento", p.id, e);
    await prisma.pagamento.update({ where: { id: p.id }, data: { emailEnviadoEm: null } });
    throw e;
  }
}

// Um pagamento recusado na nossa página. Avisa quem pagou, uma vez por hora
// no máximo, com o link para tentar de novo.
export async function aposFalha(pagamentoId: string, motivo: string | null): Promise<void> {
  const p = await prisma.pagamento.findUnique({ where: { id: pagamentoId }, include: { company: true } });
  if (!p || p.estado === "pago") return;
  const para = p.email || (p.tipo === "pacote" ? p.company?.email : null);
  if (!para) return;
  const hora = new Date(Date.now() - 60 * 60_000);
  const r = await prisma.pagamento.updateMany({
    where: { id: p.id, OR: [{ avisoFalhaEm: null }, { avisoFalhaEm: { lt: hora } }] },
    data: { avisoFalhaEm: new Date() },
  });
  if (r.count === 0) return;
  await emailPagamentoFalhou({
    para,
    nome: p.nomeCliente || (p.tipo === "pacote" ? (p.company?.nome ?? null) : null),
    descricao: p.descricao || "Pagamento",
    valor: euros(p.valorCentimos, p.moeda),
    motivo,
    link: `${appUrl()}/pagar/${p.id}`,
  });
}

// A renovação automática falhou: fica um pagamento por fazer na nossa página,
// a empresa entra em falta e recebe o link. Ao fim da tolerância é suspensa.
export async function renovacaoFalhou(fatura: Stripe.Invoice, companyId: string): Promise<void> {
  if (!fatura.id) return;
  const company = await prisma.company.findUnique({ where: { id: companyId }, include: { pacote: true } });
  if (!company) return;

  const p = await prisma.pagamento.upsert({
    where: { stripeSessionId: fatura.id },
    update: {},
    create: {
      stripeSessionId: fatura.id,
      tipo: "renovacao",
      estado: "falhou",
      valorCentimos: fatura.amount_due,
      moeda: fatura.currency,
      descricao: company.pacote?.nome ?? "Renovação",
      email: company.email,
      companyId,
      pacoteId: company.pacoteId,
      retorno: "/dashboard/plano",
    },
  });
  const desde = company.emFaltaDesde ?? new Date();
  await prisma.company.update({
    where: { id: companyId },
    data: { subscricaoEstado: "em_falta", emFaltaDesde: desde },
  });

  // Um aviso por fatura: o Stripe volta a tentar e manda o evento outra vez.
  const r = await prisma.pagamento.updateMany({
    where: { id: p.id, avisoFalhaEm: null },
    data: { avisoFalhaEm: new Date() },
  });
  if (r.count === 0) return;
  const limite = new Date(desde.getTime() + (await diasTolerancia()) * 86_400_000);
  await emailRenovacaoFalhou({
      para: company.email,
      copia: await copiaAdmin(),
      nome: company.nome,
      pacote: company.pacote?.nome ?? "Snaptie",
      valor: euros(p.valorCentimos, p.moeda),
      limite: dia(limite),
      link: `${appUrl()}/pagar/${p.id}`,
    });
}

// Corre a cada 15 minutos, com os lembretes: avisos de renovação e suspensões.
export async function corridaCobrancas(): Promise<{ avisos: number; suspensas: number }> {
  let avisos = 0;
  let suspensas = 0;
  const agora = new Date();

  // Três dias antes da renovação, um aviso por período.
  const aRenovar = await prisma.company.findMany({
    where: {
      deletedAt: null,
      subscricaoEstado: "ativa",
      subscricaoCancela: false,
      subscricaoFim: { gt: agora, lte: new Date(agora.getTime() + 3 * 86_400_000) },
    },
    include: { pacote: true },
  });
  for (const c of aRenovar) {
    if (!c.subscricaoFim || (c.avisoRenovacao && c.avisoRenovacao.getTime() === c.subscricaoFim.getTime())) continue;
    if (!c.pacote) continue;
    try {
      await prisma.company.update({ where: { id: c.id }, data: { avisoRenovacao: c.subscricaoFim } });
      await emailRenovacaoProxima({
        para: c.email,
        nome: c.nome,
        pacote: c.pacote.nome,
        valor: euros(c.pacote.precoCentimos, c.pacote.moeda),
        data: dia(c.subscricaoFim),
        link: `${appUrl()}/dashboard/plano`,
      });
      avisos++;
    } catch (e) {
      console.error("[cobrancas] aviso renovacao", c.id, e);
    }
  }

  // Passada a tolerância, as páginas fecham até ao pagamento.
  const tolerancia = await diasTolerancia();
  const emFalta = await prisma.company.findMany({
    where: {
      deletedAt: null,
      suspensaPagamento: false,
      emFaltaDesde: { lte: new Date(agora.getTime() - tolerancia * 86_400_000) },
    },
  });
  for (const c of emFalta) {
    const porPagar = await prisma.pagamento.findFirst({
      where: { companyId: c.id, tipo: "renovacao", estado: { not: "pago" } },
      orderBy: { createdAt: "desc" },
    });
    try {
      await prisma.company.update({ where: { id: c.id }, data: { suspensaPagamento: true } });
      await emailServicoSuspenso({
        para: c.email,
        copia: await copiaAdmin(),
        nome: c.nome,
        valor: porPagar ? euros(porPagar.valorCentimos, porPagar.moeda) : "",
        link: porPagar ? `${appUrl()}/pagar/${porPagar.id}` : `${appUrl()}/dashboard/plano`,
      });
      suspensas++;
    } catch (e) {
      console.error("[cobrancas] suspensao", c.id, e);
    }
  }
  return { avisos, suspensas };
}
