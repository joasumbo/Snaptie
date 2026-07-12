"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type BlockType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/dal";
import { hashPassword } from "@/lib/auth/password";
import { slugify, randomCode } from "@/lib/slug";
import { isContentBlock } from "@/lib/qr";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; message: string };

// Turns an unexpected error (e.g. a database failure) into a result the UI can
// show, instead of letting the Server Action throw — a thrown action leaves the
// client spinner running forever. The detail is logged for the server logs.
function fail(context: string, error: unknown): ActionResult {
  console.error(`[qr-action:${context}]`, error);
  const message = error instanceof Error ? error.message : "Erro desconhecido.";
  return { ok: false, message: `Não foi possível guardar: ${message}` };
}

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
  "TITULO",
  "LOGO",
];

type PageFields = {
  logo?: string | null;
  imagemCapa?: string | null;
  logoTamanho?: string;
  logoForma?: string;
  nomeTamanho?: string;
  mostrarLogo?: boolean;
  mostrarNome?: boolean;
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
  if (input.mostrarLogo !== undefined) data.mostrarLogo = input.mostrarLogo;
  if (input.mostrarNome !== undefined) data.mostrarNome = input.mostrarNome;
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

// Random short code used in the public URL (snaptie.net/{empresa}/{codigo}).
async function uniqueQrCode(): Promise<string> {
  while (true) {
    const codigo = randomCode(10);
    const existing = await prisma.qrCode.findUnique({ where: { codigo } });
    if (!existing) return codigo;
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
      codigo: await uniqueQrCode(),
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
  edicaoPublica?: boolean;
  edicaoPersonalizacao?: boolean;
  novoPin?: string;
} & PageFields): Promise<ActionResult> {
  const actor = await requireQrManager();
  if (!actor) return { ok: false, message: "Sem permissão." };
  if (!input.nome?.trim()) return { ok: false, message: "O nome é obrigatório." };

  const qr = await ownedQr(actor.id, actor.role === "ADMIN", actor.companyId, input.id);
  if (!qr) return { ok: false, message: "QR não encontrado." };

  // The visitor may be allowed to edit the content, the appearance, or both.
  // Either one is gated by the same code, so turning either on without a code
  // already in place requires a new one.
  const editData: {
    edicaoPublica?: boolean;
    edicaoPersonalizacao?: boolean;
    edicaoPin?: string;
  } = {};
  const novoPin = input.novoPin?.trim();
  if (novoPin) editData.edicaoPin = await hashPassword(novoPin);

  const querEditar =
    (input.edicaoPublica ?? qr.edicaoPublica) ||
    (input.edicaoPersonalizacao ?? qr.edicaoPersonalizacao);
  if (querEditar && !novoPin && !qr.edicaoPin) {
    return { ok: false, message: "Defina um código para a edição pública." };
  }
  if (input.edicaoPublica !== undefined) editData.edicaoPublica = input.edicaoPublica;
  if (input.edicaoPersonalizacao !== undefined) {
    editData.edicaoPersonalizacao = input.edicaoPersonalizacao;
  }

  await prisma.qrCode.update({
    where: { id: qr.id },
    data: {
      nome: input.nome.trim(),
      descricao: input.descricao?.trim() || null,
      corPrimaria: input.corPrimaria?.trim() || null,
      corSecundaria: input.corSecundaria?.trim() || null,
      ...pageData(input),
      ...editData,
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

  try {
    await prisma.qrCode.update({
      where: { id },
      data: { publicado, estado: publicado ? "ativo" : "rascunho" },
    });
  } catch (e) {
    return fail("setQrPublished", e);
  }

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
  editavelPublico?: boolean;
};

function blockData(input: BlockFields) {
  return {
    titulo: input.titulo?.trim() || "",
    cor: input.cor?.trim() || null,
    descricao: input.descricao?.trim() || null,
    icone: input.icone?.trim() || null,
    conteudo: (input.conteudo ?? {}) as Prisma.InputJsonValue,
    editavelPublico: input.editavelPublico ?? false,
  };
}

export async function addBlock(
  input: { qrId: string; tipo: BlockType } & BlockFields,
): Promise<ActionResult> {
  try {
    const actor = await requireQrManager();
    if (!actor) return { ok: false, message: "Sem permissão." };
    if (!BLOCK_TYPES.includes(input.tipo)) return { ok: false, message: "Tipo inválido." };
    if (!isContentBlock(input.tipo) && !input.titulo?.trim()) {
      return { ok: false, message: "O título é obrigatório." };
    }

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
  } catch (e) {
    return fail("addBlock", e);
  }
}

export async function updateBlock(
  input: { id: string; ativo: boolean } & BlockFields,
): Promise<ActionResult> {
  try {
    const actor = await requireQrManager();
    if (!actor) return { ok: false, message: "Sem permissão." };

    const block = await prisma.qrBlock.findUnique({
      where: { id: input.id },
      include: { qr: true },
    });
    if (!block) return { ok: false, message: "Botão não encontrado." };
    if (actor.role !== "ADMIN" && block.qr.companyId !== actor.companyId) {
      return { ok: false, message: "Sem permissão." };
    }
    if (!isContentBlock(block.tipo) && !input.titulo?.trim()) {
      return { ok: false, message: "O título é obrigatório." };
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
  } catch (e) {
    return fail("updateBlock", e);
  }
}

export async function deleteBlock(id: string): Promise<ActionResult> {
  try {
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
  } catch (e) {
    return fail("deleteBlock", e);
  }
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
