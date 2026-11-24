"use server";

import { prisma } from "@/lib/prisma";
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

export type Campo = "email" | "nome" | "nif" | "codigoPostal" | "morada" | "cidade" | "telefone" | "geral";

// Os dados de quem paga, guardados antes do pagamento, para a fatura e para
// os emails saírem com eles.
export async function guardarDadosPagador(
  id: string,
  dados: { email: string; nome: string; nif: string; morada: string; codigoPostal: string; cidade: string; telefone?: string },
): Promise<{ ok: true } | { ok: false; campo: Campo }> {
  const limpo = {
    email: String(dados.email ?? "").trim().slice(0, 200),
    nome: String(dados.nome ?? "").trim().slice(0, 120),
    nif: String(dados.nif ?? "").replace(/\D/g, "").slice(0, 9),
    morada: String(dados.morada ?? "").trim().slice(0, 200),
    codigoPostal: String(dados.codigoPostal ?? "").trim().slice(0, 8),
    cidade: String(dados.cidade ?? "").trim().slice(0, 80),
    telefone: String(dados.telefone ?? "").replace(/[^\d+ ]/g, "").trim().slice(0, 20),
  };
  if (!limpo.nome) return { ok: false, campo: "nome" };
  if (!EMAIL_RE.test(limpo.email)) return { ok: false, campo: "email" };
  if (limpo.nif && !nifValido(limpo.nif)) return { ok: false, campo: "nif" };
  if (limpo.codigoPostal && !/^\d{4}-\d{3}$/.test(limpo.codigoPostal)) return { ok: false, campo: "codigoPostal" };
  // Encomendas por correio: sem morada completa e telefone não há entrega.
  if (typeof id === "string" && id.length <= 40) {
    const p = await prisma.pagamento.findUnique({ where: { id }, select: { tipo: true } });
    if (p?.tipo === "envio") {
      if (!limpo.morada) return { ok: false, campo: "morada" };
      if (!limpo.codigoPostal) return { ok: false, campo: "codigoPostal" };
      if (!limpo.cidade) return { ok: false, campo: "cidade" };
      if (limpo.telefone.replace(/\D/g, "").length < 9) return { ok: false, campo: "telefone" };
    }
  }
  try {
    return (await guardarDadosCliente(id, limpo)) ? { ok: true } : { ok: false, campo: "geral" };
  } catch {
    return { ok: false, campo: "geral" };
  }
}
