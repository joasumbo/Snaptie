import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { APP, stripe, stripeConfigurado } from "@/lib/stripe";
import { ativarPacote, fimDoPeriodo, marcarPago, segredoWebhook } from "@/lib/stripe-pagamentos";

export const dynamic = "force-dynamic";

// O Stripe avisa aqui o que acontece aos pagamentos. A página de pagamento
// também confirma junto do Stripe quando o cliente volta; o que chegar
// primeiro regista, e repetir não estraga nada.
//
// A conta Stripe é partilhada com outros projetos da Inpulse, por isso chegam
// cá eventos que não são nossos. Tudo o que não tem a marca do Snaptie ou não
// corresponde a um pagamento ou empresa nossa é ignorado com 200, para o
// Stripe não insistir.

export async function POST(req: NextRequest) {
  if (!stripeConfigurado()) return NextResponse.json({ error: "Stripe sem chave" }, { status: 503 });
  const segredo = await segredoWebhook();
  if (!segredo) return NextResponse.json({ error: "Webhook por ligar" }, { status: 503 });

  const corpo = await req.text();
  const assinatura = req.headers.get("stripe-signature") ?? "";
  let evento: Stripe.Event;
  try {
    evento = stripe().webhooks.constructEvent(corpo, assinatura, segredo);
  } catch {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 });
  }

  try {
    await tratar(evento);
  } catch (e) {
    console.error("[stripe webhook]", evento.type, evento.id, e);
    return NextResponse.json({ error: "Falhou" }, { status: 500 });
  }
  return NextResponse.json({ recebido: true });
}

async function tratar(evento: Stripe.Event) {
  switch (evento.type) {
    case "payment_intent.succeeded":
      return intentPago(evento.data.object);
    case "payment_intent.payment_failed":
      return intentFalhou(evento.data.object);
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return subscricaoMudou(evento.data.object, evento.type === "customer.subscription.deleted");
    case "invoice.paid":
      return faturaPaga(evento.data.object);
    case "invoice.payment_failed":
      return faturaFalhou(evento.data.object);
  }
}

function idDe(v: string | { id?: string } | null | undefined): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : (v.id ?? null);
}

async function pagamentoDoIntent(intent: Stripe.PaymentIntent) {
  if (intent.metadata?.app !== APP) return null;
  return prisma.pagamento.findFirst({ where: { stripeSessionId: intent.id } });
}

async function intentPago(intent: Stripe.PaymentIntent) {
  const p = await pagamentoDoIntent(intent);
  if (!p) return;
  await marcarPago(p.id, intent.receipt_email);
  if (p.tipo === "pacote") await ativarPacote(p.id, null);
}

async function intentFalhou(intent: Stripe.PaymentIntent) {
  const p = await pagamentoDoIntent(intent);
  if (!p) return;
  // O cliente pode tentar outra vez com outro cartão na mesma página.
  await prisma.pagamento.updateMany({ where: { id: p.id, estado: "pendente" }, data: { estado: "falhou" } });
}

async function faturaPaga(fatura: Stripe.Invoice) {
  if (!fatura.id) return;

  // Primeira fatura de uma subscrição criada na nossa página.
  if (fatura.billing_reason === "subscription_create") {
    const p = await prisma.pagamento.findFirst({ where: { stripeSessionId: fatura.id } });
    if (!p) return;
    await marcarPago(p.id, fatura.customer_email);
    await ativarPacote(p.id, idDe(fatura.parent?.subscription_details?.subscription));
    return;
  }

  // Renovações: entram no histórico, uma vez por fatura.
  if (fatura.billing_reason !== "subscription_cycle") return;
  const customer = idDe(fatura.customer);
  if (!customer) return;
  const company = await prisma.company.findFirst({ where: { stripeCustomerId: customer } });
  if (!company) return;
  await prisma.pagamento.upsert({
    where: { stripeSessionId: fatura.id },
    update: {},
    create: {
      stripeSessionId: fatura.id,
      tipo: "renovacao",
      estado: "pago",
      valorCentimos: fatura.amount_paid,
      moeda: fatura.currency,
      descricao: fatura.lines.data[0]?.description ?? "Renovação",
      email: fatura.customer_email,
      companyId: company.id,
      pacoteId: company.pacoteId,
    },
  });
  if (company.subscricaoEstado === "em_falta") {
    await prisma.company.update({ where: { id: company.id }, data: { subscricaoEstado: "ativa" } });
  }
}

async function faturaFalhou(fatura: Stripe.Invoice) {
  // A primeira fatura falhada não conta: a empresa ainda não tinha o plano e
  // pode tentar outra vez na página de pagamento.
  if (fatura.billing_reason === "subscription_create") return;
  const customer = idDe(fatura.customer);
  if (!customer) return;
  await prisma.company.updateMany({
    where: { stripeCustomerId: customer, subscricaoId: { not: null } },
    data: { subscricaoEstado: "em_falta" },
  });
}

function estadoDe(sub: Stripe.Subscription): string {
  switch (sub.status) {
    case "active":
    case "trialing":
      return "ativa";
    case "past_due":
    case "unpaid":
      return "em_falta";
    default:
      return "cancelada";
  }
}

async function subscricaoMudou(sub: Stripe.Subscription, apagada: boolean) {
  // Só interessa a subscrição em vigor de uma empresa nossa. As que ficaram
  // por pagar e o Stripe deixa expirar não chegaram a ser de ninguém.
  const company = await prisma.company.findFirst({ where: { subscricaoId: sub.id } });
  if (!company) return;

  if (apagada || sub.status === "canceled" || sub.status === "incomplete_expired") {
    // Acabou: a empresa volta ao Free. Os QRs que tem ficam; só deixa de poder
    // criar além do limite, se os limites estiverem ligados.
    await prisma.company.update({
      where: { id: company.id },
      data: {
        plano: "FREE",
        pacoteId: null,
        subscricaoEstado: "cancelada",
        subscricaoCancela: false,
        subscricaoFim: fimDoPeriodo(sub),
      },
    });
    return;
  }

  await prisma.company.update({
    where: { id: company.id },
    data: {
      subscricaoEstado: estadoDe(sub),
      subscricaoFim: fimDoPeriodo(sub),
      subscricaoCancela: sub.cancel_at_period_end || Boolean(sub.cancel_at),
    },
  });
}
