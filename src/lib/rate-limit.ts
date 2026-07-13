import "server-only";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

// The PINs that guard a QR are short and printed on objects out in the world,
// so the only thing standing between them and a script is this: after a few
// wrong tries, the visitor waits. Counted per QR and per visitor, in the
// database, because serverless instances do not share memory.

const MAX_FALHAS = 5; // wrong tries before the wait
const ESPERA_MINUTOS = 15; // how long the wait lasts
const JANELA_MINUTOS = 30; // failures older than this no longer count

export async function visitorIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";
}

export type RateCheck = { ok: true } | { ok: false; minutos: number };

// Call before checking a PIN. Says whether this visitor may try at all.
export async function checkPinRate(chave: string): Promise<RateCheck> {
  const registo = await prisma.pinAttempt.findUnique({ where: { chave } });
  if (!registo?.bloqueadoAte) return { ok: true };

  const restante = registo.bloqueadoAte.getTime() - Date.now();
  if (restante <= 0) return { ok: true };

  return { ok: false, minutos: Math.max(1, Math.ceil(restante / 60_000)) };
}

// Call when a PIN was wrong.
export async function registerPinFailure(chave: string): Promise<void> {
  const agora = new Date();
  const registo = await prisma.pinAttempt.findUnique({ where: { chave } });

  // A visitor who got it wrong once an hour ago is not the one we are guarding
  // against — old failures fall out of the window.
  const recente =
    registo && agora.getTime() - registo.updatedAt.getTime() < JANELA_MINUTOS * 60_000;
  const tentativas = (recente ? registo.tentativas : 0) + 1;

  const bloqueadoAte =
    tentativas >= MAX_FALHAS
      ? new Date(agora.getTime() + ESPERA_MINUTOS * 60_000)
      : null;

  await prisma.pinAttempt.upsert({
    where: { chave },
    create: { chave, tentativas, bloqueadoAte },
    update: { tentativas: tentativas >= MAX_FALHAS ? 0 : tentativas, bloqueadoAte },
  });
}

// Call when the PIN was right: the visitor is who they said they were.
export async function clearPinFailures(chave: string): Promise<void> {
  await prisma.pinAttempt.deleteMany({ where: { chave } });
}

export function tooManyMessage(minutos: number): string {
  return `Demasiadas tentativas. Tente novamente dentro de ${minutos} minuto${
    minutos === 1 ? "" : "s"
  }.`;
}
