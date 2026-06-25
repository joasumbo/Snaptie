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
const BLOCK_TYPES: BlockType[] = [
  "TEXTO",
  "LINK",
  "WHATSAPP",
  "TELEFONE",
  "EMAIL",
  "MAPA",
  "WIFI",
  "PDF",
  "IMAGEM",
  "CARROSSEL",
  "VIDEO",
];

type PageFields = {
  logo?: string | null;
  imagemCapa?: string | null;
  logoTamanho?: string;
  logoForma?: string;
  nomeTamanho?: string;
};

const SIZES = ["P", "M", "G"];
const SHAPES = ["quadrado", "circulo"];

// Only includes keys explicitly provided, so the basic QR form never overwrites
// the page customisation (and vice-versa).
function pageData(input: PageFields) {
  const data: Record<string, unknown> = {};
  if (input.logo !== undefined) data.logo = input.logo?.trim() || null;
  if (input.imagemCapa !== undefined) data.imagemCapa = input.imagemCapa?.trim() || null;
  if (input.logoTamanho !== undefined)
    data.logoTamanho = SIZES.includes(input.logoTamanho) ? input.logoTamanho : "M";
  if (input.logoForma !== undefined)
    data.logoForma = SHAPES.includes(input.logoForma) ? input.logoForma : "circulo";
  if (input.nomeTamanho !== undefined)
    data.nomeTamanho = SIZES.includes(input.nomeTamanho) ? input.nomeTamanho : "M";
  return data;
}

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
} & PageFields): Promise<ActionResult> {
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
      ...pageData(input),
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
} & PageFields): Promise<ActionResult> {
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
      ...pageData(input),
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

type BlockFields = {
  titulo: string;
  cor?: string | null;
  descricao?: string | null;
  icone?: string | null;
  conteudo: Record<string, unknown>;
};

function blockData(input: BlockFields) {
  return {
    titulo: input.titulo.trim(),
    cor: input.cor?.trim() || null,
    descricao: input.descricao?.trim() || null,
    icone: input.icone?.trim() || null,
    conteudo: (input.conteudo ?? {}) as Prisma.InputJsonValue,
  };
}

export async function addBlock(
  input: { qrId: string; tipo: BlockType } & BlockFields,
): Promise<ActionResult> {
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
      ordem: (last?.ordem ?? 0) + 1,
      ...blockData(input),
    },
  });

  revalidatePath(`/dashboard/qr-codes/${qr.id}`);
  return { ok: true };
}

export async function updateBlock(
  input: { id: string; ativo: boolean } & BlockFields,
): Promise<ActionResult> {
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
      ativo: input.ativo,
      ...blockData(input),
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
