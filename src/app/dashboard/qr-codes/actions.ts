"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type BlockType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/dal";
import { slugify } from "@/lib/slug";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; message: string };

const QR_ROLES = ["ADMIN", "GESTOR_EMPRESA", "GESTOR_QR"] as const;
const BLOCK_TYPES: BlockType[] = ["TEXTO", "LINK", "IMAGEM", "VIDEO", "PDF"];

async function requireQrManager() {
  const user = await getCurrentUser();
  if (!user || !QR_ROLES.includes(user.role as (typeof QR_ROLES)[number])) {
    return null;
  }
  return user;
}

async function uniqueQrSlug(nome: string): Promise<string> {
  const base = slugify(nome) || "qr";
  let slug = base;
  let n = 1;
  while (true) {
    const existing = await prisma.qrCode.findUnique({ where: { slug } });
    if (!existing) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

// Loads a QR and checks the actor may manage it (same company, or admin).
async function ownedQr(actorId: string, isAdmin: boolean, companyId: string | null, qrId: string) {
  const qr = await prisma.qrCode.findUnique({ where: { id: qrId } });
  if (!qr) return null;
  if (!isAdmin && qr.companyId !== companyId) return null;
  return qr;
}

export async function createQrCode(input: {
  nome: string;
  descricao?: string;
  companyId?: string;
  corPrimaria?: string;
  corSecundaria?: string;
}): Promise<ActionResult> {
  const actor = await requireQrManager();
  if (!actor) return { ok: false, message: "Sem permissão." };
  if (!input.nome?.trim()) return { ok: false, message: "O nome é obrigatório." };

  let companyId: string;
  if (actor.role === "ADMIN") {
    if (!input.companyId) return { ok: false, message: "Selecione uma empresa." };
    const company = await prisma.company.findFirst({
      where: { id: input.companyId, deletedAt: null },
    });
    if (!company) return { ok: false, message: "Empresa inválida." };
    companyId = company.id;
  } else {
    if (!actor.companyId) {
      return { ok: false, message: "A sua conta não está associada a uma empresa." };
    }
    companyId = actor.companyId;
  }

  const qr = await prisma.qrCode.create({
    data: {
      nome: input.nome.trim(),
      descricao: input.descricao?.trim() || null,
      slug: await uniqueQrSlug(input.nome),
      companyId,
      corPrimaria: input.corPrimaria?.trim() || null,
      corSecundaria: input.corSecundaria?.trim() || null,
    },
  });

  revalidatePath("/dashboard/qr-codes");
  return { ok: true, id: qr.id };
}

export async function updateQrCode(input: {
  id: string;
  nome: string;
  descricao?: string;
  corPrimaria?: string;
  corSecundaria?: string;
}): Promise<ActionResult> {
  const actor = await requireQrManager();
  if (!actor) return { ok: false, message: "Sem permissão." };
  if (!input.nome?.trim()) return { ok: false, message: "O nome é obrigatório." };

  const qr = await ownedQr(actor.id, actor.role === "ADMIN", actor.companyId, input.id);
  if (!qr) return { ok: false, message: "QR não encontrado." };

  await prisma.qrCode.update({
    where: { id: qr.id },
    data: {
      nome: input.nome.trim(),
      descricao: input.descricao?.trim() || null,
      corPrimaria: input.corPrimaria?.trim() || null,
      corSecundaria: input.corSecundaria?.trim() || null,
    },
  });

  revalidatePath("/dashboard/qr-codes");
  revalidatePath(`/dashboard/qr-codes/${qr.id}`);
  return { ok: true };
}

export async function setQrPublished(
  id: string,
  publicado: boolean,
): Promise<ActionResult> {
  const actor = await requireQrManager();
  if (!actor) return { ok: false, message: "Sem permissão." };
  const qr = await ownedQr(actor.id, actor.role === "ADMIN", actor.companyId, id);
  if (!qr) return { ok: false, message: "QR não encontrado." };

  await prisma.qrCode.update({
    where: { id },
    data: { publicado, estado: publicado ? "ativo" : "rascunho" },
  });

  revalidatePath("/dashboard/qr-codes");
  revalidatePath(`/dashboard/qr-codes/${id}`);
  return { ok: true };
}

export async function deleteQrCode(id: string): Promise<ActionResult> {
  const actor = await requireQrManager();
  if (!actor) return { ok: false, message: "Sem permissão." };
  const qr = await ownedQr(actor.id, actor.role === "ADMIN", actor.companyId, id);
  if (!qr) return { ok: false, message: "QR não encontrado." };

  await prisma.qrCode.delete({ where: { id } });
  revalidatePath("/dashboard/qr-codes");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Blocks (the buttons shown on the scan page)
// ---------------------------------------------------------------------------

function buildConteudo(tipo: BlockType, value: string): Prisma.InputJsonValue {
  if (tipo === "TEXTO") return { texto: value };
  return { url: value };
}

export async function addBlock(input: {
  qrId: string;
  tipo: BlockType;
  titulo: string;
  conteudo: string;
}): Promise<ActionResult> {
  const actor = await requireQrManager();
  if (!actor) return { ok: false, message: "Sem permissão." };
  if (!BLOCK_TYPES.includes(input.tipo)) return { ok: false, message: "Tipo inválido." };
  if (!input.titulo?.trim()) return { ok: false, message: "O título é obrigatório." };

  const qr = await ownedQr(actor.id, actor.role === "ADMIN", actor.companyId, input.qrId);
  if (!qr) return { ok: false, message: "QR não encontrado." };

  const last = await prisma.qrBlock.findFirst({
    where: { qrId: qr.id },
    orderBy: { ordem: "desc" },
  });

  await prisma.qrBlock.create({
    data: {
      qrId: qr.id,
      tipo: input.tipo,
      titulo: input.titulo.trim(),
      conteudo: buildConteudo(input.tipo, input.conteudo.trim()),
      ordem: (last?.ordem ?? 0) + 1,
    },
  });

  revalidatePath(`/dashboard/qr-codes/${qr.id}`);
  return { ok: true };
}

export async function updateBlock(input: {
  id: string;
  titulo: string;
  conteudo: string;
  ativo: boolean;
}): Promise<ActionResult> {
  const actor = await requireQrManager();
  if (!actor) return { ok: false, message: "Sem permissão." };
  if (!input.titulo?.trim()) return { ok: false, message: "O título é obrigatório." };

  const block = await prisma.qrBlock.findUnique({
    where: { id: input.id },
    include: { qr: true },
  });
  if (!block) return { ok: false, message: "Botão não encontrado." };
  if (actor.role !== "ADMIN" && block.qr.companyId !== actor.companyId) {
    return { ok: false, message: "Sem permissão." };
  }

  await prisma.qrBlock.update({
    where: { id: input.id },
    data: {
      titulo: input.titulo.trim(),
      conteudo: buildConteudo(block.tipo, input.conteudo.trim()),
      ativo: input.ativo,
    },
  });

  revalidatePath(`/dashboard/qr-codes/${block.qrId}`);
  return { ok: true };
}

export async function deleteBlock(id: string): Promise<ActionResult> {
  const actor = await requireQrManager();
  if (!actor) return { ok: false, message: "Sem permissão." };

  const block = await prisma.qrBlock.findUnique({
    where: { id },
    include: { qr: true },
  });
  if (!block) return { ok: false, message: "Botão não encontrado." };
  if (actor.role !== "ADMIN" && block.qr.companyId !== actor.companyId) {
    return { ok: false, message: "Sem permissão." };
  }

  await prisma.qrBlock.delete({ where: { id } });
  revalidatePath(`/dashboard/qr-codes/${block.qrId}`);
  return { ok: true };
}

export async function moveBlock(
  id: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const actor = await requireQrManager();
  if (!actor) return { ok: false, message: "Sem permissão." };

  const block = await prisma.qrBlock.findUnique({
    where: { id },
    include: { qr: true },
  });
  if (!block) return { ok: false, message: "Botão não encontrado." };
  if (actor.role !== "ADMIN" && block.qr.companyId !== actor.companyId) {
    return { ok: false, message: "Sem permissão." };
  }

  const neighbour = await prisma.qrBlock.findFirst({
    where: {
      qrId: block.qrId,
      ordem: direction === "up" ? { lt: block.ordem } : { gt: block.ordem },
    },
    orderBy: { ordem: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbour) return { ok: true }; // already at the edge

  await prisma.$transaction([
    prisma.qrBlock.update({
      where: { id: block.id },
      data: { ordem: neighbour.ordem },
    }),
    prisma.qrBlock.update({
      where: { id: neighbour.id },
      data: { ordem: block.ordem },
    }),
  ]);

  revalidatePath(`/dashboard/qr-codes/${block.qrId}`);
  return { ok: true };
}
