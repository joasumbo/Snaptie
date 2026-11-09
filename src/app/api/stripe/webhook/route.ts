import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { APP, stripe, stripeConfigurado } from "@/lib/stripe";
import { segredoWebhook } from "@/lib/stripe-pagamentos";

export const dynamic = "force-dynamic";

// O Stripe avisa aqui o que acontece aos pagamentos. É a única fonte do estado
// de uma subscrição: o regresso do checkout ao browser não conta para nada,
// porque qualquer um pode abrir esse endereço.
//
// A conta Stripe é partilhada com outros projetos da Inpulse, por isso chegam
// cá eventos que não são nossos. Tudo o que não tem a marca do Snaptie ou não
// corresponde a uma empresa nossa é ignorado com 200, para o Stripe não
// insistir.

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
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return sessaoConcluida(evento.data.object);
    case "checkout.session.async_payment_failed":
      return marcarSessao(evento.data.object, "falhou");
    case "checkout.session.expired":
      return marcarSessao(evento.data.object, "expirado");
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return subscricaoMudou(evento.data.object, evento.type === "customer.subscription.deleted");
    case "invoice.paid":
      return faturaPaga(evento.data.object);
    case "invoice.payment_failed":
      return faturaFalhou(evento.data.object);
  }
}

function eNossa(meta: Stripe.Metadata | null | undefined): boolean {
  return meta?.app === APP;
}

function idDe(v: string | { id: string } | null | undefined): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.id;
}

async function marcarSessao(sessao: Stripe.Checkout.Session, estado: string) {
  if (!eNossa(sessao.metadata)) return;
  await prisma.pagamento.updateMany({
    where: { stripeSessionId: sessao.id, estado: { not: "pago" } },
    data: { estado },
  });
}

async function sessaoConcluida(sessao: Stripe.Checkout.Session) {
  if (!eNossa(sessao.metadata)) return;
  // Multibanco e afins concluem o checkout antes de o dinheiro chegar; nesses
  // casos espera-se pelo async_payment_succeeded.
  const pago = sessao.payment_status === "paid" || sessao.payment_status === "no_payment_required";
  if (!pago) return;

  const valor = sessao.amount_total;
  await prisma.pagamento.updateMany({
    where: { stripeSessionId: sessao.id },
    data: {
      estado: "pago",
      email: sessao.customer_details?.email ?? undefined,
      ...(valor != null ? { valorCentimos: valor } : {}),
    },
  });

  const meta = sessao.metadata ?? {};
  if (meta.tipo !== "pacote" || !meta.companyId || !meta.pacoteId) return;
  const pacote = await prisma.pacote.findUnique({ where: { id: meta.pacoteId } });
  if (!pacote) return;

  const subscricaoId = idDe(sessao.subscription);
  let fim: Date | null = null;
  if (subscricaoId) {
    const sub = await stripe().subscriptions.retrieve(subscricaoId);
    fim = fimDoPeriodo(sub);
  }
  await prisma.company.updateMany({
    where: { id: meta.companyId },
    data: {
      plano: pacote.plano,
      pacoteId: pacote.id,
      stripeCustomerId: idDe(sessao.customer) ?? undefined,
      subscricaoId: subscricaoId,
      subscricaoEstado: subscricaoId ? "ativa" : "unico",
      subscricaoFim: fim,
    },
  });
}

function fimDoPeriodo(sub: Stripe.Subscription): Date | null {
  const fim = sub.cancel_at ?? sub.items.data[0]?.current_period_end ?? null;
  return fim ? new Date(fim * 1000) : null;
}

function estadoDe(sub: Stripe.Subscription): string {
  switch (sub.status) {
    case "active":
    case "trialing":
      return "ativa";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "em_falta";
    default:
      return "cancelada";
  }
}

async function subscricaoMudou(sub: Stripe.Subscription, apagada: boolean) {
  const company = await prisma.company.findFirst({ where: { subscricaoId: sub.id } });
  if (!company) return;

  if (apagada || sub.status === "canceled" || sub.status === "incomplete_expired") {
    // Acabou: a empresa volta ao Free. Os QRs que tem ficam; só deixa de poder
    // criar além do limite, se os limites estiverem ligados.
    await prisma.company.update({
      where: { id: company.id },
      data: { plano: "FREE", pacoteId: null, subscricaoEstado: "cancelada", subscricaoFim: fimDoPeriodo(sub) },
    });
    return;
  }

  // Mudança de pacote feita no Stripe: segue o preço novo, se for de um pacote nosso.
  const priceId = sub.items.data[0]?.price.id;
  const pacote = priceId ? await prisma.pacote.findFirst({ where: { stripePriceId: priceId } }) : null;
  await prisma.company.update({
    where: { id: company.id },
    data: {
      subscricaoEstado: estadoDe(sub),
      subscricaoFim: fimDoPeriodo(sub),
      ...(pacote ? { pacoteId: pacote.id, plano: pacote.plano } : {}),
    },
  });
}

async function faturaPaga(fatura: Stripe.Invoice) {
  // A primeira fatura já ficou registada pelo checkout; aqui só entram as
  // renovações, para o histórico mostrar cada mês pago.
  if (fatura.billing_reason !== "subscription_cycle") return;
  const customer = idDe(fatura.customer);
  if (!customer) return;
  const company = await prisma.company.findFirst({ where: { stripeCustomerId: customer } });
  if (!company) return;
  // O Stripe pode mandar o mesmo evento mais de uma vez: o id da fatura fica
  // na coluna única para a renovação só entrar uma vez.
  if (!fatura.id) return;
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
  const customer = idDe(fatura.customer);
  if (!customer) return;
  await prisma.company.updateMany({
    where: { stripeCustomerId: customer, subscricaoId: { not: null } },
    data: { subscricaoEstado: "em_falta" },
  });
}
