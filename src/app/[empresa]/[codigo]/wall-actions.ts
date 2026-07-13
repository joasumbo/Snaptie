"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { visitorIp } from "@/lib/rate-limit";

// The message wall: any visitor may leave a message on a FEED block, with no
// code and no account. That is the point of it — and also why it needs limits.

const MAX_NOME = 40;
const MAX_MENSAGEM = 500;
const MAX_POR_JANELA = 3; // messages one visitor may leave...
const JANELA_MINUTOS = 5; // ...in this many minutes

export type WallResult = { ok: true } | { ok: false; motivo: "invalido" | "vazio" | "muitas" };

export async function postWallMessage(input: {
  codigo: string;
  blockId: string;
  nome: string;
  mensagem: string;
}): Promise<WallResult> {
  const nome = input.nome?.trim().slice(0, MAX_NOME) ?? "";
  const mensagem = input.mensagem?.trim().slice(0, MAX_MENSAGEM) ?? "";
  if (!nome || !mensagem) return { ok: false, motivo: "vazio" };

  // The block must be a live wall on this published page — not any block whose
  // id someone happens to know.
  const block = await prisma.qrBlock.findFirst({
    where: {
      id: input.blockId,
      tipo: "FEED",
      ativo: true,
      qr: { codigo: input.codigo, publicado: true },
    },
    select: { id: true, qr: { select: { company: { select: { slug: true } } } } },
  });
  if (!block) return { ok: false, motivo: "invalido" };

  // An open form on a public page is a spam magnet, so one visitor only gets a
  // few messages per window.
  const ip = await visitorIp();
  const desde = new Date(Date.now() - JANELA_MINUTOS * 60_000);
  const recentes = await prisma.qrMessage.count({
    where: { blockId: block.id, ip, createdAt: { gte: desde } },
  });
  if (recentes >= MAX_POR_JANELA) return { ok: false, motivo: "muitas" };

  await prisma.qrMessage.create({
    data: { blockId: block.id, nome, mensagem, ip },
  });

  revalidatePath(`/${block.qr.company.slug}/${input.codigo}`);
  return { ok: true };
}
