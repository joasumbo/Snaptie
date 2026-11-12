import "server-only";

import { prisma } from "@/lib/prisma";
import { limitesAtivos } from "@/lib/configuracao";
import { PLANOS, textoEspaco } from "@/lib/planos";

// O espaço de cada empresa: a soma dos ficheiros enviados para as páginas
// dela (fotografias, vídeos, PDFs, imagens do mural), face ao limite do plano.
// Os ficheiros enviados pelo administrador do Snaptie não contam, tal como os
// QR codes que ele cria passam por cima dos limites.

const MB = 1024 * 1024;

export async function espacoUsado(companyId: string): Promise<number> {
  const r = await prisma.ficheiro.aggregate({ where: { companyId }, _sum: { bytes: true } });
  return Number(r._sum.bytes ?? 0);
}

// Limite em bytes. null = sem limite.
export async function limiteEspaco(companyId: string): Promise<number | null> {
  const c = await prisma.company.findUnique({ where: { id: companyId }, select: { plano: true } });
  if (!c) return null;
  const mb = PLANOS[c.plano].armazenamentoMb;
  return mb == null ? null : mb * MB;
}

export async function resumoEspaco(companyId: string): Promise<{ usado: number; limite: number | null }> {
  const [usado, limite] = await Promise.all([espacoUsado(companyId), limiteEspaco(companyId)]);
  return { usado, limite };
}

// null quando cabe; senão a mensagem para quem está a enviar.
export async function verificarEspaco(companyId: string, bytes: number): Promise<string | null> {
  if (!(await limitesAtivos())) return null;
  const { usado, limite } = await resumoEspaco(companyId);
  if (limite == null || usado + bytes <= limite) return null;
  const c = await prisma.company.findUnique({ where: { id: companyId }, select: { plano: true } });
  const nome = c ? PLANOS[c.plano].nome : "atual";
  return `O plano ${nome} inclui ${textoEspaco(limite / MB)} de espaço e este ficheiro já não cabe. Mude de plano para enviar mais.`;
}

export async function registarFicheiro(companyId: string, chave: string, bytes: number): Promise<void> {
  await prisma.ficheiro
    .create({ data: { companyId, chave, bytes: BigInt(Math.max(0, Math.round(bytes))) } })
    .catch((e) => console.error("[armazenamento] registo", chave, e));
}
