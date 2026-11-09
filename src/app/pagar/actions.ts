"use server";

import { confirmarReferencia, guardarDadosCliente } from "@/lib/stripe-pagamentos";
import { nifValido } from "@/lib/moloni-faturas";

// Chamado pela página depois de o cartão ser aceite. Quem decide se está pago
// é o Stripe, consultado aqui no servidor; o browser só pede para verificar.
export async function verificarPagamento(id: string): Promise<"pago" | "pendente"> {
  if (typeof id !== "string" || id.length > 40) return "pendente";
  try {
    return await confirmarReferencia(id);
  } catch {
    return "pendente";
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Campo = "email" | "nome" | "nif" | "codigoPostal" | "geral";

// Os dados de quem paga, guardados antes do pagamento, para a fatura e para
// os emails saírem com eles.
export async function guardarDadosPagador(
  id: string,
  dados: { email: string; nome: string; nif: string; morada: string; codigoPostal: string; cidade: string },
): Promise<{ ok: true } | { ok: false; campo: Campo }> {
  const limpo = {
    email: String(dados.email ?? "").trim().slice(0, 200),
    nome: String(dados.nome ?? "").trim().slice(0, 120),
    nif: String(dados.nif ?? "").replace(/\D/g, "").slice(0, 9),
    morada: String(dados.morada ?? "").trim().slice(0, 200),
    codigoPostal: String(dados.codigoPostal ?? "").trim().slice(0, 8),
    cidade: String(dados.cidade ?? "").trim().slice(0, 80),
  };
  if (!limpo.nome) return { ok: false, campo: "nome" };
  if (!EMAIL_RE.test(limpo.email)) return { ok: false, campo: "email" };
  if (limpo.nif && !nifValido(limpo.nif)) return { ok: false, campo: "nif" };
  if (limpo.codigoPostal && !/^\d{4}-\d{3}$/.test(limpo.codigoPostal)) return { ok: false, campo: "codigoPostal" };
  try {
    return (await guardarDadosCliente(id, limpo)) ? { ok: true } : { ok: false, campo: "geral" };
  } catch {
    return { ok: false, campo: "geral" };
  }
}
