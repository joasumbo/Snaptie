"use server";

import { getCurrentUser } from "@/lib/auth/dal";
import { abrirPortal, checkoutPacote } from "@/lib/stripe-pagamentos";

export type ResultadoUrl = { ok: true; url: string } | { ok: false; message: string };

// Só o gestor da empresa paga o plano dela. O administrador do Snaptie não
// subscreve em nome de ninguém: muda o plano à mão na ficha da empresa.
async function empresaDoGestor() {
  const u = await getCurrentUser();
  if (!u || u.role !== "GESTOR_EMPRESA" || !u.companyId) return null;
  return u.companyId;
}

function falhou(e: unknown): ResultadoUrl {
  return { ok: false, message: e instanceof Error ? e.message : "Não foi possível abrir o pagamento." };
}

export async function subscreverPacote(pacoteId: string): Promise<ResultadoUrl> {
  const companyId = await empresaDoGestor();
  if (!companyId) return { ok: false, message: "Só o gestor da empresa pode mudar o plano." };
  try {
    return { ok: true, url: await checkoutPacote(companyId, pacoteId) };
  } catch (e) {
    return falhou(e);
  }
}

export async function gerirSubscricao(): Promise<ResultadoUrl> {
  const companyId = await empresaDoGestor();
  if (!companyId) return { ok: false, message: "Só o gestor da empresa pode gerir o plano." };
  try {
    return { ok: true, url: await abrirPortal(companyId) };
  } catch (e) {
    return falhou(e);
  }
}
