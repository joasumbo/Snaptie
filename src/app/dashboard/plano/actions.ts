"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import {
  cancelarSubscricao,
  concluirTrocaCartao,
  iniciarPacote,
  iniciarTrocaCartao,
} from "@/lib/stripe-pagamentos";

type Erro = { ok: false; message: string };
export type ResultadoUrl = { ok: true; url: string } | Erro;
export type Resultado = { ok: true } | Erro;

// Só o gestor da empresa paga o plano dela. O administrador do Snaptie não
// subscreve em nome de ninguém: muda o plano à mão na ficha da empresa.
async function empresaDoGestor() {
  const u = await getCurrentUser();
  if (!u || u.role !== "GESTOR_EMPRESA" || !u.companyId) return null;
  return u.companyId;
}

function falhou(e: unknown): Erro {
  return { ok: false, message: e instanceof Error ? e.message : "Não foi possível concluir o pedido." };
}

const SEM_PERMISSAO: Erro = { ok: false, message: "Só o gestor da empresa pode gerir o plano." };

export async function subscreverPacote(pacoteId: string): Promise<ResultadoUrl> {
  const companyId = await empresaDoGestor();
  if (!companyId) return SEM_PERMISSAO;
  try {
    return { ok: true, url: `/pagar/${await iniciarPacote(companyId, pacoteId)}` };
  } catch (e) {
    return falhou(e);
  }
}

export async function mudarCancelamento(cancelar: boolean): Promise<Resultado> {
  const companyId = await empresaDoGestor();
  if (!companyId) return SEM_PERMISSAO;
  try {
    await cancelarSubscricao(companyId, cancelar);
  } catch (e) {
    return falhou(e);
  }
  revalidatePath("/dashboard/plano");
  return { ok: true };
}

export async function pedirTrocaCartao(): Promise<{ ok: true; clientSecret: string } | Erro> {
  const companyId = await empresaDoGestor();
  if (!companyId) return SEM_PERMISSAO;
  try {
    return { ok: true, clientSecret: await iniciarTrocaCartao(companyId) };
  } catch (e) {
    return falhou(e);
  }
}

export async function guardarCartao(setupIntentId: string): Promise<Resultado> {
  const companyId = await empresaDoGestor();
  if (!companyId) return SEM_PERMISSAO;
  try {
    if (!(await concluirTrocaCartao(companyId, setupIntentId))) {
      return { ok: false, message: "O cartão não foi confirmado. Tente de novo." };
    }
  } catch (e) {
    return falhou(e);
  }
  revalidatePath("/dashboard/plano");
  return { ok: true };
}
