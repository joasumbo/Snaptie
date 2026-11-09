import "server-only";

import type Stripe from "stripe";
import type { Pacote } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CHAVES, apagarConfig, gravarConfig, lerConfig } from "@/lib/configuracao";
import { EVENTOS_WEBHOOK, MARCA, URL_WEBHOOK, appUrl, stripe } from "@/lib/stripe";
import type { Intervalo } from "@/lib/pagamentos";

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

// ---------------------------------------------------------------- portal

// O portal do cliente (cartão, faturas, cancelar) precisa de uma configuração.
// Cria-se uma só do Snaptie, para não depender da predefinida da conta, que é
// partilhada com os outros projetos.
async function configuracaoPortal(): Promise<string> {
  const guardada = await lerConfig(CHAVES.portalConfig);
  if (guardada) return guardada;
  const conf = await stripe().billingPortal.configurations.create({
    business_profile: { headline: "Snaptie: o seu plano" },
    default_return_url: `${appUrl()}/dashboard/plano`,
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ["email", "address", "tax_id", "name"] },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
    },
    metadata: MARCA,
  });
  await gravarConfig(CHAVES.portalConfig, conf.id);
  return conf.id;
}

export async function abrirPortal(companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company?.stripeCustomerId) throw new Error("Esta empresa ainda não tem pagamentos.");
  const sessao = await stripe().billingPortal.sessions.create({
    customer: company.stripeCustomerId,
    configuration: await configuracaoPortal(),
    return_url: `${appUrl()}/dashboard/plano`,
  });
  return sessao.url;
}

// ---------------------------------------------------------------- checkout

async function clienteDaEmpresa(companyId: string): Promise<string> {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  if (company.stripeCustomerId) return company.stripeCustomerId;
  const cliente = await stripe().customers.create({
    name: company.nome,
    email: company.email,
    metadata: { ...MARCA, companyId },
  });
  await prisma.company.update({ where: { id: companyId }, data: { stripeCustomerId: cliente.id } });
  return cliente.id;
}

export async function checkoutPacote(companyId: string, pacoteId: string): Promise<string> {
  const pacote = await prisma.pacote.findUnique({ where: { id: pacoteId } });
  if (!pacote || !pacote.ativo || !pacote.stripePriceId) throw new Error("Este pacote não está disponível.");

  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  const recorrente = pacote.intervalo !== "unico";
  if (recorrente && company.subscricaoId && company.subscricaoEstado !== "cancelada") {
    throw new Error("A empresa já tem uma subscrição. Para mudar de pacote, use Gerir subscrição ou cancele a atual.");
  }

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
    },
  });
  const metadata = { ...MARCA, tipo: "pacote", pagamentoId: pagamento.id, companyId, pacoteId };

  const sessao = await stripe().checkout.sessions.create({
    mode: recorrente ? "subscription" : "payment",
    customer,
    line_items: [{ price: pacote.stripePriceId, quantity: 1 }],
    metadata,
    client_reference_id: companyId,
    ...(recorrente
      ? { subscription_data: { metadata } }
      : { payment_intent_data: { metadata }, invoice_creation: { enabled: true, invoice_data: { metadata } } }),
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    tax_id_collection: { enabled: true },
    customer_update: { name: "auto", address: "auto" },
    locale: "pt",
    success_url: `${appUrl()}/dashboard/plano?pagamento=ok`,
    cancel_url: `${appUrl()}/dashboard/plano?pagamento=cancelado`,
  });
  await prisma.pagamento.update({ where: { id: pagamento.id }, data: { stripeSessionId: sessao.id } });
  if (!sessao.url) throw new Error("O Stripe não devolveu o endereço do pagamento.");
  return sessao.url;
}

export async function checkoutBotao(opcoes: {
  companyId: string;
  qrId: string;
  blockId: string;
  nome: string;
  pagina: string;
  valorCentimos: number;
  urlPagina: string;
  locale: string;
}): Promise<string> {
  const pagamento = await prisma.pagamento.create({
    data: {
      tipo: "botao",
      valorCentimos: opcoes.valorCentimos,
      descricao: opcoes.nome,
      companyId: opcoes.companyId,
      qrId: opcoes.qrId,
      blockId: opcoes.blockId,
    },
  });
  const metadata = {
    ...MARCA,
    tipo: "botao",
    pagamentoId: pagamento.id,
    companyId: opcoes.companyId,
    qrId: opcoes.qrId,
    blockId: opcoes.blockId,
  };
  const locais = ["pt", "en", "es", "fr", "de"] as const;
  const locale = locais.find((l) => l === opcoes.locale) ?? "auto";
  const sessao = await stripe().checkout.sessions.create({
    mode: "payment",
    submit_type: "pay",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: opcoes.valorCentimos,
          product_data: { name: opcoes.nome, description: opcoes.pagina || undefined, metadata: MARCA },
        },
      },
    ],
    metadata,
    payment_intent_data: { metadata, description: `${opcoes.nome} (${opcoes.pagina})` },
    locale,
    success_url: `${opcoes.urlPagina}?pagamento=ok`,
    cancel_url: `${opcoes.urlPagina}?pagamento=cancelado`,
  });
  await prisma.pagamento.update({ where: { id: pagamento.id }, data: { stripeSessionId: sessao.id } });
  if (!sessao.url) throw new Error("O Stripe não devolveu o endereço do pagamento.");
  return sessao.url;
}

export type { Intervalo };
