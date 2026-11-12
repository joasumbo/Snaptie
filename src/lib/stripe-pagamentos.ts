import "server-only";

import type Stripe from "stripe";
import type { Pacote } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CHAVES, apagarConfig, gravarConfig, lerConfig } from "@/lib/configuracao";
import { EVENTOS_WEBHOOK, MARCA, URL_WEBHOOK, stripe } from "@/lib/stripe";
import { aposPagamento } from "@/lib/cobrancas";
import { emailSubscricaoCancelada } from "@/lib/email-pagamentos";

// ---------------------------------------------------------------- pacotes

function recorrencia(intervalo: string): Stripe.PriceCreateParams.Recurring | undefined {
  if (intervalo === "mes") return { interval: "month" };
  if (intervalo === "ano") return { interval: "year" };
  return undefined;
}

async function criarPreco(pacote: Pacote, productId: string): Promise<string> {
  const preco = await stripe().prices.create({
    product: productId,
    unit_amount: pacote.precoCentimos,
    currency: pacote.moeda,
    recurring: recorrencia(pacote.intervalo),
    metadata: { ...MARCA, pacoteId: pacote.id },
  });
  return preco.id;
}

// Põe o produto e o preço do Stripe iguais ao pacote. Um preço no Stripe não
// se muda: quando o valor ou o intervalo mudam cria-se um novo e arquiva-se o
// antigo. Quem já subscreveu continua no preço antigo até cancelar.
export async function sincronizarPacote(
  pacote: Pacote,
  anterior?: Pick<Pacote, "precoCentimos" | "intervalo" | "moeda"> | null,
): Promise<Pacote> {
  const s = stripe();
  let productId = pacote.stripeProductId;
  if (!productId) {
    const produto = await s.products.create({
      name: `Snaptie ${pacote.nome}`,
      description: pacote.descricao || undefined,
      active: pacote.ativo,
      metadata: { ...MARCA, pacoteId: pacote.id },
    });
    productId = produto.id;
  } else {
    await s.products.update(productId, {
      name: `Snaptie ${pacote.nome}`,
      description: pacote.descricao || "",
      active: pacote.ativo,
    });
  }

  let priceId = pacote.stripePriceId;
  const mudouPreco =
    !priceId ||
    !anterior ||
    anterior.precoCentimos !== pacote.precoCentimos ||
    anterior.intervalo !== pacote.intervalo ||
    anterior.moeda !== pacote.moeda;
  if (mudouPreco) {
    const antigo = priceId;
    priceId = await criarPreco(pacote, productId);
    await s.products.update(productId, { default_price: priceId });
    if (antigo) await s.prices.update(antigo, { active: false });
  }

  return prisma.pacote.update({
    where: { id: pacote.id },
    data: { stripeProductId: productId, stripePriceId: priceId },
  });
}

export async function arquivarProduto(pacote: Pacote): Promise<void> {
  if (!pacote.stripeProductId) return;
  await stripe().products.update(pacote.stripeProductId, { active: false });
}

// ---------------------------------------------------------------- webhook

// Cria o endpoint do Snaptie no Stripe e guarda o segredo. Só toca no
// endpoint com o endereço do Snaptie: os dos outros projetos ficam como estão.
export async function ligarWebhook(): Promise<{ id: string; url: string }> {
  const s = stripe();
  const url = URL_WEBHOOK();
  const existentes = await s.webhookEndpoints.list({ limit: 100 });
  for (const w of existentes.data) {
    if (w.url === url) await s.webhookEndpoints.del(w.id);
  }
  const novo = await s.webhookEndpoints.create({
    url,
    enabled_events: EVENTOS_WEBHOOK,
    description: "Snaptie: pacotes e pagamentos",
    metadata: MARCA,
  });
  if (!novo.secret) throw new Error("O Stripe não devolveu o segredo do webhook.");
  await gravarConfig(CHAVES.webhookId, novo.id);
  await gravarConfig(CHAVES.webhookSegredo, novo.secret);
  return { id: novo.id, url };
}

export async function estadoWebhook(): Promise<
  { ligado: false } | { ligado: true; url: string; estado: string }
> {
  const id = await lerConfig(CHAVES.webhookId);
  const segredo = await segredoWebhook();
  if (!id || !segredo) return { ligado: false };
  try {
    const w = await stripe().webhookEndpoints.retrieve(id);
    return { ligado: true, url: w.url, estado: w.status };
  } catch {
    await apagarConfig(CHAVES.webhookId);
    return { ligado: false };
  }
}

export async function segredoWebhook(): Promise<string | null> {
  return (await lerConfig(CHAVES.webhookSegredo)) ?? process.env.STRIPE_WEBHOOK_SECRET ?? null;
}

// ---------------------------------------------------------------- pagamentos
//
// Tudo se paga numa página nossa, /pagar/<id>. O Stripe só fornece os campos
// do cartão (obrigatório, para os dados do cartão nunca passarem pelo nosso
// servidor) e processa o pagamento por trás.
//
// Cada pagamento guarda em stripeSessionId a referência do Stripe que o paga:
//   pi_... um PaymentIntent (botão na página, link, pacote de pagamento único)
//   in_... a primeira fatura de uma subscrição

async function clienteDaEmpresa(companyId: string): Promise<string> {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  if (company.stripeCustomerId) return company.stripeCustomerId;
  // Sem email de propósito: o Stripe não tem para onde mandar recibos nem
  // faturas. Os emails são todos nossos.
  const cliente = await stripe().customers.create({
    name: company.nome,
    metadata: { ...MARCA, companyId },
  });
  await prisma.company.update({ where: { id: companyId }, data: { stripeCustomerId: cliente.id } });
  return cliente.id;
}

// Um pagamento avulso: botão numa página ou link criado no admin.
export async function criarPagamentoAvulso(opcoes: {
  tipo: "botao" | "link" | "qr";
  valorCentimos: number;
  descricao: string;
  companyId?: string | null;
  qrId?: string | null;
  qrModeloId?: string | null;
  blockId?: string | null;
  email?: string | null;
  retorno?: string | null;
}): Promise<string> {
  const pagamento = await prisma.pagamento.create({
    data: {
      tipo: opcoes.tipo,
      valorCentimos: opcoes.valorCentimos,
      descricao: opcoes.descricao,
      email: opcoes.email || null,
      companyId: opcoes.companyId ?? null,
      qrId: opcoes.qrId ?? null,
      qrModeloId: opcoes.qrModeloId ?? null,
      blockId: opcoes.blockId ?? null,
      retorno: opcoes.retorno ?? null,
    },
  });
  const intent = await stripe().paymentIntents.create({
    amount: opcoes.valorCentimos,
    currency: "eur",
    description: `Snaptie: ${opcoes.descricao}`,
    automatic_payment_methods: { enabled: true },
    metadata: { ...MARCA, tipo: opcoes.tipo, pagamentoId: pagamento.id },
  });
  await prisma.pagamento.update({ where: { id: pagamento.id }, data: { stripeSessionId: intent.id } });
  return pagamento.id;
}

// Um pacote: subscrição (mensal ou anual) ou pagamento único. A subscrição
// nasce por pagar; só fica ativa quando a primeira fatura é paga.
export async function iniciarPacote(companyId: string, pacoteId: string): Promise<string> {
  const pacote = await prisma.pacote.findUnique({ where: { id: pacoteId } });
  if (!pacote || !pacote.ativo || !pacote.stripePriceId) throw new Error("Este pacote não está disponível.");
  if (pacote.companyId && pacote.companyId !== companyId) throw new Error("Este pacote não está disponível.");

  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  const recorrente = pacote.intervalo !== "unico";
  if (recorrente && company.subscricaoId && company.subscricaoEstado !== "cancelada") {
    throw new Error("A empresa já tem uma subscrição. Cancele a atual antes de mudar de pacote.");
  }

  // Quem carrega duas vezes em Subscrever volta ao mesmo pagamento, em vez de
  // deixar subscrições por pagar penduradas no Stripe.
  const aberto = await prisma.pagamento.findFirst({
    where: {
      companyId,
      pacoteId,
      tipo: "pacote",
      estado: { in: ["pendente", "falhou"] },
      createdAt: { gte: new Date(Date.now() - 60 * 60_000) },
      valorCentimos: pacote.precoCentimos,
    },
    orderBy: { createdAt: "desc" },
  });
  if (aberto?.stripeSessionId) return aberto.id;

  const customer = await clienteDaEmpresa(companyId);
  const pagamento = await prisma.pagamento.create({
    data: {
      tipo: "pacote",
      valorCentimos: pacote.precoCentimos,
      moeda: pacote.moeda,
      descricao: pacote.nome,
      email: company.email,
      companyId,
      pacoteId,
      retorno: "/dashboard/plano",
    },
  });
  const metadata = { ...MARCA, tipo: "pacote", pagamentoId: pagamento.id, companyId, pacoteId };

  let ref: string;
  if (recorrente) {
    const sub = await stripe().subscriptions.create({
      customer,
      items: [{ price: pacote.stripePriceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      metadata,
    });
    const fatura = idDe(sub.latest_invoice);
    if (!fatura) throw new Error("O Stripe não criou a fatura da subscrição.");
    ref = fatura;
  } else {
    const intent = await stripe().paymentIntents.create({
      amount: pacote.precoCentimos,
      currency: pacote.moeda,
      customer,
      description: `Snaptie: ${pacote.nome}`,
      automatic_payment_methods: { enabled: true },
      metadata,
    });
    ref = intent.id;
  }
  await prisma.pagamento.update({ where: { id: pagamento.id }, data: { stripeSessionId: ref } });
  return pagamento.id;
}

function idDe(v: string | { id?: string } | null | undefined): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : (v.id ?? null);
}

export function fimDoPeriodo(sub: Stripe.Subscription): Date | null {
  const fim = sub.cancel_at ?? sub.items.data[0]?.current_period_end ?? null;
  return fim ? new Date(fim * 1000) : null;
}

// Dá à empresa o plano do pacote pago. Chamado pelo webhook e pela página de
// pagamento (o que chegar primeiro); repetir não estraga nada.
export async function ativarPacote(pagamentoId: string, subscricaoId: string | null): Promise<void> {
  const pagamento = await prisma.pagamento.findUnique({ where: { id: pagamentoId }, include: { pacote: true } });
  if (!pagamento?.companyId || !pagamento.pacote) return;
  let fim: Date | null = null;
  if (subscricaoId) fim = fimDoPeriodo(await stripe().subscriptions.retrieve(subscricaoId));
  await prisma.company.update({
    where: { id: pagamento.companyId },
    data: {
      plano: pagamento.pacote.plano,
      pacoteId: pagamento.pacote.id,
      subscricaoId,
      subscricaoEstado: subscricaoId ? "ativa" : "unico",
      subscricaoFim: fim,
      subscricaoCancela: false,
    },
  });
}

export async function marcarPago(pagamentoId: string): Promise<boolean> {
  const r = await prisma.pagamento.updateMany({
    where: { id: pagamentoId, estado: { not: "pago" } },
    data: { estado: "pago", pagoEm: new Date() },
  });
  return r.count > 0;
}

// Depois de marcar como pago: comprovativo e email. Uma falha no email não
// pode desfazer o pagamento, por isso fica só registada.
export async function depoisDePago(pagamentoId: string): Promise<void> {
  await aposPagamento(pagamentoId).catch((e) => console.error("[pagamentos] email", pagamentoId, e));
  // Uma compra na loja: o QR segue logo num email à parte. Se falhar, o
  // temporizador tenta de novo. (Importado aqui: a loja usa este ficheiro.)
  const { entregarQr } = await import("@/lib/loja");
  await entregarQr(pagamentoId).catch((e) => console.error("[loja] entrega", pagamentoId, e));
}

// Confirma junto do Stripe se uma referência já está paga e, se estiver,
// regista-o. Nunca confia no que o browser diz.
export async function confirmarReferencia(pagamentoId: string): Promise<"pago" | "pendente"> {
  const p = await prisma.pagamento.findUnique({ where: { id: pagamentoId } });
  if (!p?.stripeSessionId) return "pendente";
  if (p.estado === "pago") return "pago";
  const ref = p.stripeSessionId;
  if (ref.startsWith("pi_")) {
    const intent = await stripe().paymentIntents.retrieve(ref);
    if (intent.status !== "succeeded") return "pendente";
    if (await marcarPago(p.id)) {
      if (p.tipo === "pacote") await ativarPacote(p.id, null);
      await depoisDePago(p.id);
    }
    return "pago";
  }
  if (ref.startsWith("in_")) {
    const fatura = await stripe().invoices.retrieve(ref);
    if (fatura.status !== "paid") return "pendente";
    if (await marcarPago(p.id)) {
      if (p.tipo === "pacote") await ativarPacote(p.id, idDe(fatura.parent?.subscription_details?.subscription));
      await depoisDePago(p.id);
    }
    return "pago";
  }
  return "pendente";
}

export type DadosPagamento = {
  id: string;
  tipo: string;
  estado: string;
  valorCentimos: number;
  moeda: string;
  descricao: string;
  email: string | null;
  nomeCliente: string | null;
  nifCliente: string | null;
  moradaCliente: string | null;
  cpCliente: string | null;
  cidadeCliente: string | null;
  retorno: string | null;
  empresa: string | null;
  intervalo: string | null;
  clientSecret: string | null;
  fatura: boolean;
  // Quem paga recebe a cópia de um QR por email.
  entregaQr: boolean;
};

export async function lerPagamentoParaPagar(id: string): Promise<DadosPagamento | null> {
  const p = await prisma.pagamento.findUnique({
    where: { id },
    include: { company: { select: { nome: true } }, pacote: { select: { intervalo: true } } },
  });
  if (!p || !p.stripeSessionId) return null;

  let estado = p.estado;
  let clientSecret: string | null = null;
  if (estado !== "pago" && estado !== "expirado") {
    if ((await confirmarReferencia(p.id)) === "pago") estado = "pago";
  }
  if (estado !== "pago" && estado !== "expirado") {
    const ref = p.stripeSessionId;
    if (ref.startsWith("pi_")) {
      const intent = await stripe().paymentIntents.retrieve(ref);
      if (intent.status === "canceled") estado = "expirado";
      else clientSecret = intent.client_secret;
    } else if (ref.startsWith("in_")) {
      const fatura = await stripe().invoices.retrieve(ref, { expand: ["confirmation_secret"] });
      if (fatura.status === "void" || fatura.status === "uncollectible") estado = "expirado";
      else clientSecret = fatura.confirmation_secret?.client_secret ?? null;
    }
  }
  return {
    id: p.id,
    tipo: p.tipo,
    estado,
    valorCentimos: p.valorCentimos,
    moeda: p.moeda,
    descricao: p.descricao ?? "",
    email: p.email,
    nomeCliente: p.nomeCliente,
    nifCliente: p.nifCliente,
    moradaCliente: p.moradaCliente,
    cpCliente: p.cpCliente,
    cidadeCliente: p.cidadeCliente,
    retorno: p.retorno,
    empresa: p.company?.nome ?? null,
    intervalo: p.pacote?.intervalo ?? null,
    clientSecret,
    fatura: Boolean(p.moloniFaturaPdf),
    entregaQr: Boolean(p.qrModeloId),
  };
}

// ---------------------------------------------------------------- subscrição

// Cancela no fim do período pago, ou desfaz o cancelamento.
export async function cancelarSubscricao(companyId: string, cancelar: boolean): Promise<void> {
  const c = await prisma.company.findUnique({ where: { id: companyId } });
  if (!c?.subscricaoId) throw new Error("A empresa não tem subscrição.");
  const sub = await stripe().subscriptions.update(c.subscricaoId, { cancel_at_period_end: cancelar });
  const fim = fimDoPeriodo(sub);
  await prisma.company.update({
    where: { id: companyId },
    data: { subscricaoFim: fim, subscricaoCancela: cancelar },
  });
  if (cancelar && fim) {
    const pacote = c.pacoteId ? await prisma.pacote.findUnique({ where: { id: c.pacoteId } }) : null;
    await emailSubscricaoCancelada({
      para: c.email,
      nome: c.nome,
      pacote: pacote?.nome ?? "Snaptie",
      data: fim.toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" }),
    }).catch((e) => console.error("[pagamentos] email cancelamento", companyId, e));
  }
}

export type Fatura = { id: string; numero: string; data: string; valorCentimos: number; moeda: string; estado: string };

export async function faturasDaEmpresa(companyId: string): Promise<Fatura[]> {
  const c = await prisma.company.findUnique({ where: { id: companyId } });
  if (!c?.stripeCustomerId) return [];
  const lista = await stripe().invoices.list({ customer: c.stripeCustomerId, limit: 24 });
  return lista.data
    .filter((f) => f.status === "paid")
    .map((f) => ({
      id: f.id!,
      numero: f.number ?? "",
      data: new Date(f.created * 1000).toISOString(),
      valorCentimos: f.amount_paid,
      moeda: f.currency,
      estado: f.status ?? "",
    }));
}

// O PDF da fatura, servido por nós: o browser nunca sai do Snaptie.
export async function pdfDaFatura(
  companyId: string,
  faturaId: string,
): Promise<{ pdf: ArrayBuffer; nome: string } | null> {
  const c = await prisma.company.findUnique({ where: { id: companyId } });
  if (!c?.stripeCustomerId) return null;
  const f = await stripe().invoices.retrieve(faturaId);
  if (idDe(f.customer) !== c.stripeCustomerId || !f.invoice_pdf) return null;
  const r = await fetch(f.invoice_pdf);
  if (!r.ok) return null;
  return { pdf: await r.arrayBuffer(), nome: `fatura-${f.number ?? f.id}.pdf` };
}

// Trocar o cartão: os dados entram na nossa página; ao voltar, o cartão novo
// passa a ser o da subscrição.
export async function iniciarTrocaCartao(companyId: string): Promise<string> {
  const customer = await clienteDaEmpresa(companyId);
  const setup = await stripe().setupIntents.create({
    customer,
    automatic_payment_methods: { enabled: true },
    usage: "off_session",
    metadata: { ...MARCA, companyId },
  });
  return setup.client_secret!;
}

export async function concluirTrocaCartao(companyId: string, setupIntentId: string): Promise<boolean> {
  const c = await prisma.company.findUnique({ where: { id: companyId } });
  if (!c?.stripeCustomerId) return false;
  const setup = await stripe().setupIntents.retrieve(setupIntentId);
  if (setup.status !== "succeeded" || idDe(setup.customer) !== c.stripeCustomerId) return false;
  const metodo = idDe(setup.payment_method);
  if (!metodo) return false;
  await stripe().customers.update(c.stripeCustomerId, { invoice_settings: { default_payment_method: metodo } });
  if (c.subscricaoId) await stripe().subscriptions.update(c.subscricaoId, { default_payment_method: metodo });
  return true;
}

export async function cartaoAtual(companyId: string): Promise<string | null> {
  const c = await prisma.company.findUnique({ where: { id: companyId } });
  if (!c?.stripeCustomerId) return null;
  const cliente = await stripe().customers.retrieve(c.stripeCustomerId, {
    expand: ["invoice_settings.default_payment_method"],
  });
  if (cliente.deleted) return null;
  const pm = cliente.invoice_settings?.default_payment_method;
  if (!pm || typeof pm === "string") return null;
  if (pm.card) return `${pm.card.brand.toUpperCase()} terminado em ${pm.card.last4}`;
  return pm.type;
}

// O que quem paga escreve na nossa página: para o comprovativo e para o
// email. Só antes de pagar; depois disso o comprovativo já não muda.
export async function guardarDadosCliente(
  pagamentoId: string,
  dados: { email: string; nome: string; nif: string; morada: string; codigoPostal: string; cidade: string },
): Promise<boolean> {
  const r = await prisma.pagamento.updateMany({
    where: { id: pagamentoId, estado: { not: "pago" } },
    data: {
      email: dados.email || undefined,
      nomeCliente: dados.nome || null,
      nifCliente: dados.nif || null,
      moradaCliente: dados.morada || null,
      cpCliente: dados.codigoPostal || null,
      cidadeCliente: dados.cidade || null,
    },
  });
  return r.count > 0;
}
