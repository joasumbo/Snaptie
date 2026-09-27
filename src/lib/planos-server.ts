import "server-only";

import type { Plano } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  PLANOS,
  mensagemSemFuncionalidade,
  temFuncionalidade,
  type Funcionalidade,
} from "@/lib/planos";

export type PlanoEmpresa = {
  plano: Plano;
  limiteQrs: number | null;
  precoMensal: number | null;
};

// A subscrição ativa mais recente é onde vivem o preço e o limite acertados
// com um cliente Business. Nos outros planos o limite é o da tabela.
async function subscricaoAtiva(companyId: string) {
  return prisma.subscription.findFirst({
    where: { companyId, estado: "ATIVA" },
    orderBy: { dataInicio: "desc" },
  });
}

export async function planoDaEmpresa(companyId: string): Promise<PlanoEmpresa | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { plano: true },
  });
  if (!company) return null;

  const definicao = PLANOS[company.plano];
  if (!definicao.precoPersonalizado) {
    return { plano: company.plano, limiteQrs: definicao.limiteQrs, precoMensal: null };
  }

  const sub = await subscricaoAtiva(companyId);
  return {
    plano: company.plano,
    limiteQrs: sub?.limiteQrs ?? definicao.limiteQrs,
    precoMensal: sub?.valorMensal ? Number(sub.valorMensal) : null,
  };
}

// Guarda o preço e o limite personalizados. Atualiza a subscrição ativa em vez
// de criar uma nova a cada gravação, para o histórico só ganhar uma linha
// quando o plano muda de facto.
export async function guardarSubscricao(
  companyId: string,
  plano: Plano,
  custom: { precoMensal: number | null; limiteQrs: number | null },
): Promise<void> {
  const personalizado = PLANOS[plano].precoPersonalizado;
  const data = {
    plano,
    valorMensal: personalizado ? custom.precoMensal : null,
    limiteQrs: personalizado ? custom.limiteQrs : null,
  };

  const atual = await subscricaoAtiva(companyId);
  if (atual && atual.plano === plano) {
    await prisma.subscription.update({ where: { id: atual.id }, data });
    return;
  }
  await prisma.$transaction([
    prisma.subscription.updateMany({
      where: { companyId, estado: "ATIVA" },
      data: { estado: "CANCELADA", dataFim: new Date() },
    }),
    prisma.subscription.create({ data: { companyId, estado: "ATIVA", ...data } }),
  ]);
}

// As barreiras abaixo aplicam-se às empresas clientes. O administrador do
// Snaptie passa por cima delas: é quem monta as páginas para os clientes e
// quem decide as exceções.

export async function verificarFuncionalidade(
  actorRole: string,
  companyId: string,
  f: Funcionalidade,
): Promise<string | null> {
  if (actorRole === "ADMIN") return null;
  const plano = await planoDaEmpresa(companyId);
  if (!plano) return "Empresa não encontrada.";
  return temFuncionalidade(plano.plano, f) ? null : mensagemSemFuncionalidade(f);
}

export async function verificarLimiteQrs(
  actorRole: string,
  companyId: string,
  novos: number,
): Promise<string | null> {
  if (actorRole === "ADMIN") return null;
  const plano = await planoDaEmpresa(companyId);
  if (!plano) return "Empresa não encontrada.";
  if (plano.limiteQrs === null) return null;

  const atuais = await prisma.qrCode.count({ where: { companyId } });
  if (atuais + novos <= plano.limiteQrs) return null;
  const restam = Math.max(plano.limiteQrs - atuais, 0);
  return restam === 0
    ? `O plano ${PLANOS[plano.plano].nome} permite ${plano.limiteQrs} QR codes e já os tem todos. Mude de plano para criar mais.`
    : `O plano ${PLANOS[plano.plano].nome} permite ${plano.limiteQrs} QR codes: só pode criar mais ${restam}.`;
}
