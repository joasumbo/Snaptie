import "server-only";

import { prisma } from "@/lib/prisma";

// Definições da plataforma que o administrador muda no painel, sem deploy.
export const CHAVES = {
  webhookId: "stripe_webhook_id",
  webhookSegredo: "stripe_webhook_secret",
  portalConfig: "stripe_portal_config",
  limitesAtivos: "limites_planos_ativos",
  emissorNome: "emissor_nome",
  emissorNif: "emissor_nif",
  emissorMorada: "emissor_morada",
  emissorEmail: "emissor_email",
  avisoAdmin: "aviso_admin_email",
  diasTolerancia: "dias_tolerancia",
} as const;

export type Chave = (typeof CHAVES)[keyof typeof CHAVES];

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

export type Emissor = { nome: string; nif: string; morada: string; email: string };

// Quem recebe o dinheiro, como aparece nos comprovativos e nos emails.
export async function lerEmissor(): Promise<Emissor> {
  const linhas = await prisma.configuracao.findMany({
    where: { chave: { in: [CHAVES.emissorNome, CHAVES.emissorNif, CHAVES.emissorMorada, CHAVES.emissorEmail] } },
  });
  const v = (k: string) => linhas.find((l) => l.chave === k)?.valor ?? "";
  return {
    nome: v(CHAVES.emissorNome) || "INPULSE EVENTS",
    nif: v(CHAVES.emissorNif),
    morada: v(CHAVES.emissorMorada),
    email: v(CHAVES.emissorEmail),
  };
}

// Dias entre a primeira renovação falhada e o fecho das páginas da empresa.
export async function diasTolerancia(): Promise<number> {
  const n = Number(await lerConfig(CHAVES.diasTolerancia));
  return Number.isInteger(n) && n >= 1 && n <= 60 ? n : 7;
}

// Número seguinte do comprovativo, por ano: SNP-2026-000001. O contador vive
// numa linha das configurações e sobe numa única instrução, para dois
// pagamentos ao mesmo tempo nunca receberem o mesmo número.
export async function numeroComprovativo(data = new Date()): Promise<string> {
  const ano = data.getFullYear();
  const chave = `comprovativo_seq_${ano}`;
  const linhas = await prisma.$queryRaw<{ valor: string }[]>`
    INSERT INTO configuracoes (chave, valor, updated_at) VALUES (${chave}, '1', now())
    ON CONFLICT (chave) DO UPDATE SET valor = (configuracoes.valor::int + 1)::text, updated_at = now()
    RETURNING valor`;
  const n = Number(linhas[0]?.valor ?? 1);
  return `SNP-${ano}-${String(n).padStart(6, "0")}`;
}
