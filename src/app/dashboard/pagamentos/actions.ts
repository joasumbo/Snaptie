"use server";

import { revalidatePath } from "next/cache";
import type { Plano } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/dal";
import { CHAVES, gravarConfig } from "@/lib/configuracao";
import { aposPagamento } from "@/lib/cobrancas";
import { INTERVALOS } from "@/lib/pagamentos";
import { arquivarProduto, criarPagamentoAvulso, iniciarPacote, ligarWebhook, sincronizarPacote } from "@/lib/stripe-pagamentos";
import { appUrl } from "@/lib/stripe";

export type Resultado = { ok: true } | { ok: false; message: string };

const PLANOS_VALIDOS: Plano[] = ["FREE", "STARTER", "PRO", "ENTERPRISE"];

async function soAdmin() {
  const u = await getCurrentUser();
  return u?.role === "ADMIN" ? u : null;
}

function erro(e: unknown): Resultado {
  const msg = e instanceof Error ? e.message : String(e);
  return { ok: false, message: `O Stripe recusou: ${msg}` };
}

export type PacoteInput = {
  id?: string;
  nome: string;
  descricao: string;
  precoEuros: number;
  intervalo: string;
  plano: Plano;
  limiteQrs: number | null;
  ativo: boolean;
  ordem: number;
  companyId: string | null;
};

function validar(i: PacoteInput): string | null {
  if (!i.nome.trim()) return "Dê um nome ao pacote.";
  if (!Number.isFinite(i.precoEuros) || i.precoEuros < 0.5) return "O preço mínimo no Stripe é 0,50 €.";
  if (i.precoEuros > 100000) return "Preço demasiado alto.";
  if (!(INTERVALOS as readonly string[]).includes(i.intervalo)) return "Escolha mensal, anual ou pagamento único.";
  if (!PLANOS_VALIDOS.includes(i.plano) || i.plano === "FREE") return "Escolha o plano que o pacote dá.";
  if (i.limiteQrs != null && (!Number.isInteger(i.limiteQrs) || i.limiteQrs < 1)) {
    return "O limite de QR codes tem de ser um número inteiro positivo.";
  }
  return null;
}

export async function guardarPacote(i: PacoteInput): Promise<Resultado> {
  if (!(await soAdmin())) return { ok: false, message: "Sem permissão." };
  const invalido = validar(i);
  if (invalido) return { ok: false, message: invalido };

  const dados = {
    nome: i.nome.trim(),
    descricao: i.descricao.trim() || null,
    precoCentimos: Math.round(i.precoEuros * 100),
    intervalo: i.intervalo,
    plano: i.plano,
    limiteQrs: i.limiteQrs,
    ativo: i.ativo,
    ordem: Math.trunc(i.ordem) || 0,
    companyId: i.companyId || null,
  };

  const anterior = i.id ? await prisma.pacote.findUnique({ where: { id: i.id } }) : null;
  if (i.id && !anterior) return { ok: false, message: "Pacote não encontrado." };
  const pacote = anterior
    ? await prisma.pacote.update({ where: { id: anterior.id }, data: dados })
    : await prisma.pacote.create({ data: dados });

  try {
    await sincronizarPacote(pacote, anterior);
  } catch (e) {
    // Um pacote novo que não chegou ao Stripe não serve para nada: sai.
    if (!anterior) await prisma.pacote.delete({ where: { id: pacote.id } });
    else await prisma.pacote.update({ where: { id: anterior.id }, data: anterior });
    return erro(e);
  }
  revalidatePath("/dashboard/pagamentos");
  revalidatePath("/dashboard/plano");
  return { ok: true };
}

export async function apagarPacote(id: string): Promise<Resultado> {
  if (!(await soAdmin())) return { ok: false, message: "Sem permissão." };
  const pacote = await prisma.pacote.findUnique({
    where: { id },
    include: { _count: { select: { empresas: true, pagamentos: true } } },
  });
  if (!pacote) return { ok: false, message: "Pacote não encontrado." };
  try {
    await arquivarProduto(pacote);
  } catch (e) {
    return erro(e);
  }
  // Com histórico fica guardado, só desativado, para os pagamentos antigos
  // continuarem a dizer o que se comprou.
  if (pacote._count.empresas > 0 || pacote._count.pagamentos > 0) {
    await prisma.pacote.update({ where: { id }, data: { ativo: false } });
  } else {
    await prisma.pacote.delete({ where: { id } });
  }
  revalidatePath("/dashboard/pagamentos");
  revalidatePath("/dashboard/plano");
  return { ok: true };
}

export async function ligarWebhookStripe(): Promise<Resultado> {
  if (!(await soAdmin())) return { ok: false, message: "Sem permissão." };
  try {
    await ligarWebhook();
  } catch (e) {
    return erro(e);
  }
  revalidatePath("/dashboard/pagamentos");
  return { ok: true };
}

export async function mudarLimites(ativos: boolean): Promise<Resultado> {
  if (!(await soAdmin())) return { ok: false, message: "Sem permissão." };
  await gravarConfig(CHAVES.limitesAtivos, ativos ? "1" : "0");
  revalidatePath("/dashboard/pagamentos");
  return { ok: true };
}

// Um link para mandar a quem tem de pagar: abre a nossa página de pagamento.
// Cada link serve para um pagamento.
export async function criarLinkPagamento(i: {
  valorEuros: number;
  descricao: string;
  email: string;
  companyId?: string | null;
  pacoteId?: string | null;
}): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  if (!(await soAdmin())) return { ok: false, message: "Sem permissão." };
  // Link de um pacote para uma empresa: quando ela paga, fica com o plano
  // (e, se for mensal ou anual, com a subscrição a renovar sozinha).
  if (i.pacoteId) {
    if (!i.companyId) return { ok: false, message: "Escolha a empresa que vai pagar o pacote." };
    try {
      const id = await iniciarPacote(i.companyId, i.pacoteId);
      revalidatePath("/dashboard/pagamentos");
      return { ok: true, url: `${appUrl()}/pagar/${id}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }
  if (!i.descricao.trim()) return { ok: false, message: "Diga a que se refere o pagamento." };
  if (!Number.isFinite(i.valorEuros) || i.valorEuros < 0.5) return { ok: false, message: "O valor mínimo é 0,50 €." };
  if (i.valorEuros > 100000) return { ok: false, message: "Valor demasiado alto." };
  const email = i.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "O email não é válido." };
  try {
    const id = await criarPagamentoAvulso({
      tipo: "link",
      valorCentimos: Math.round(i.valorEuros * 100),
      descricao: i.descricao.trim(),
      email: email || null,
      companyId: i.companyId || null,
    });
    revalidatePath("/dashboard/pagamentos");
    return { ok: true, url: `${appUrl()}/pagar/${id}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function reenviarComprovativo(id: string): Promise<Resultado> {
  if (!(await soAdmin())) return { ok: false, message: "Sem permissão." };
  try {
    await aposPagamento(id, true);
  } catch (e) {
    return { ok: false, message: `Não foi possível enviar: ${e instanceof Error ? e.message : String(e)}` };
  }
  return { ok: true };
}

export async function guardarFaturacao(i: {
  nome: string;
  nif: string;
  morada: string;
  email: string;
  avisoAdmin: string;
  dias: number;
}): Promise<Resultado> {
  if (!(await soAdmin())) return { ok: false, message: "Sem permissão." };
  const dias = Math.trunc(i.dias);
  if (!Number.isInteger(dias) || dias < 1 || dias > 60) return { ok: false, message: "A tolerância tem de ser entre 1 e 60 dias." };
  await Promise.all([
    gravarConfig(CHAVES.emissorNome, i.nome.trim()),
    gravarConfig(CHAVES.emissorNif, i.nif.trim()),
    gravarConfig(CHAVES.emissorMorada, i.morada.trim()),
    gravarConfig(CHAVES.emissorEmail, i.email.trim()),
    gravarConfig(CHAVES.avisoAdmin, i.avisoAdmin.trim()),
    gravarConfig(CHAVES.diasTolerancia, String(dias)),
  ]);
  revalidatePath("/dashboard/pagamentos");
  return { ok: true };
}
