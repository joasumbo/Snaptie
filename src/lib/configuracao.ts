import "server-only";

import { prisma } from "@/lib/prisma";

// Definições da plataforma que o administrador muda no painel, sem deploy.
export const CHAVES = {
  webhookId: "stripe_webhook_id",
  webhookSegredo: "stripe_webhook_secret",
  portalConfig: "stripe_portal_config",
  limitesAtivos: "limites_planos_ativos",
} as const;

type Chave = (typeof CHAVES)[keyof typeof CHAVES];

export async function lerConfig(chave: Chave): Promise<string | null> {
  const linha = await prisma.configuracao.findUnique({ where: { chave } });
  return linha?.valor ?? null;
}

export async function gravarConfig(chave: Chave, valor: string): Promise<void> {
  await prisma.configuracao.upsert({
    where: { chave },
    create: { chave, valor },
    update: { valor },
  });
}

export async function apagarConfig(chave: Chave): Promise<void> {
  await prisma.configuracao.deleteMany({ where: { chave } });
}

// Os limites dos planos só travam as empresas depois de o administrador os
// ligar. Até lá, as empresas que já usam a plataforma no Free continuam como
// estavam.
export async function limitesAtivos(): Promise<boolean> {
  return (await lerConfig(CHAVES.limitesAtivos)) === "1";
}
