"use server";

import { confirmarReferencia, guardarDadosCliente } from "@/lib/stripe-pagamentos";

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

// Os dados de quem paga, guardados antes de o cartão ser enviado, para o
// comprovativo e o email saírem com eles.
export async function guardarDadosPagador(
  id: string,
  dados: { email: string; nome: string; nif: string; morada: string },
): Promise<{ ok: true } | { ok: false; campo: "email" | "geral" }> {
  const limpo = {
    email: String(dados.email ?? "").trim().slice(0, 200),
    nome: String(dados.nome ?? "").trim().slice(0, 120),
    nif: String(dados.nif ?? "").replace(/\s+/g, "").slice(0, 20),
    morada: String(dados.morada ?? "").trim().slice(0, 200),
  };
  if (!EMAIL_RE.test(limpo.email)) return { ok: false, campo: "email" };
  try {
    return (await guardarDadosCliente(id, limpo)) ? { ok: true } : { ok: false, campo: "geral" };
  } catch {
    return { ok: false, campo: "geral" };
  }
}
