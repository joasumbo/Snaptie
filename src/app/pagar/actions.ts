"use server";

import { confirmarReferencia } from "@/lib/stripe-pagamentos";

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
