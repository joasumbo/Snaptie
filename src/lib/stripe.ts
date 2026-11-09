import "server-only";

import Stripe from "stripe";

// A conta Stripe é partilhada com outros projetos da Inpulse. Tudo o que o
// Snaptie cria lá leva esta marca, e o webhook ignora o que não a tiver.
export const APP = "snaptie";
export const MARCA = { app: APP } as const;

// Criado só quando é preciso: no build a chave não existe.
let cliente: Stripe | null = null;

export function stripeConfigurado(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripe(): Stripe {
  const chave = process.env.STRIPE_SECRET_KEY;
  if (!chave) throw new Error("O Stripe não está configurado (falta STRIPE_SECRET_KEY).");
  cliente ??= new Stripe(chave);
  return cliente;
}

export function modoStripe(): "live" | "teste" | null {
  const chave = process.env.STRIPE_SECRET_KEY;
  if (!chave) return null;
  return chave.startsWith("sk_live_") ? "live" : "teste";
}

export function appUrl(): string {
  return (process.env.APP_URL || "https://mysnaptie.com").replace(/\/+$/, "");
}

export const URL_WEBHOOK = () => `${appUrl()}/api/stripe/webhook`;

export const EVENTOS_WEBHOOK: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
];
