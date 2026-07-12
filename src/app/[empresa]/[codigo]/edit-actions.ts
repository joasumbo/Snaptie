"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { isContentBlock } from "@/lib/qr";
import {
  prepareUpload,
  createUploadUrl,
  publicUrlFor,
  type UploadKind,
} from "@/lib/storage";

// Public, PIN-gated editing of a QR. No login required, but every action
// re-checks the PIN and, on top of that, the specific permission it needs:
// content and appearance are granted separately by the owner.
async function authorize(codigo: string, pin: string) {
  const qr = await prisma.qrCode.findFirst({
    where: {
      codigo,
      publicado: true,
      OR: [{ edicaoPublica: true }, { edicaoPersonalizacao: true }],
    },
  });
  if (!qr || !qr.edicaoPin) return null;
  const ok = await verifyPassword(pin ?? "", qr.edicaoPin);
  return ok ? qr : null;
}

// Tells the page not only that the code is right, but what it unlocks.
export async function verifyEditPin(
  codigo: string,
  pin: string,
): Promise<{ ok: boolean; podeConteudo: boolean; podePersonalizar: boolean }> {
  const qr = await authorize(codigo, pin);
  return {
    ok: Boolean(qr),
    podeConteudo: qr?.edicaoPublica ?? false,
    podePersonalizar: qr?.edicaoPersonalizacao ?? false,
  };
}

export type EditResult = { ok: true } | { ok: false; message: string };

export async function saveBlockContent(input: {
  codigo: string;
  pin: string;
  blockId: string;
  titulo: string;
  conteudo: Record<string, unknown>;
}): Promise<EditResult> {
  const qr = await authorize(input.codigo, input.pin);
  if (!qr) return { ok: false, message: "Código inválido." };
  if (!qr.edicaoPublica) return { ok: false, message: "Sem permissão." };

  const block = await prisma.qrBlock.findUnique({ where: { id: input.blockId } });
  if (!block || block.qrId !== qr.id) {
    return { ok: false, message: "Elemento não encontrado." };
  }
  // The page only offers the editable elements, but the check belongs here too:
  // the code alone must not open up every block on the page.
  if (!block.editavelPublico) return { ok: false, message: "Sem permissão." };
  if (!isContentBlock(block.tipo) && !input.titulo?.trim()) {
    return { ok: false, message: "O título é obrigatório." };
  }

  // Only the content is editable here — never the type, order or existence.
  try {
    await prisma.qrBlock.update({
      where: { id: block.id },
      data: {
        titulo: input.titulo.trim(),
        conteudo: (input.conteudo ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    console.error("[public-edit:saveBlockContent]", e);
    const message = e instanceof Error ? e.message : "Erro desconhecido.";
    return { ok: false, message: `Não foi possível guardar: ${message}` };
  }
  return { ok: true };
}

const SIZES = ["P", "M", "G"];
const SHAPES = ["quadrado", "circulo"];

// The appearance of the page, when the owner granted that permission. The
// visitor never chooses the value freely: sizes and shapes are checked against
// the same lists the dashboard offers.
export async function savePageSettings(input: {
  codigo: string;
  pin: string;
  logo: string | null;
  imagemCapa: string | null;
  logoTamanho: string;
  logoForma: string;
  nomeTamanho: string;
  mostrarLogo: boolean;
  mostrarNome: boolean;
}): Promise<EditResult> {
  const qr = await authorize(input.codigo, input.pin);
  if (!qr) return { ok: false, message: "Código inválido." };
  if (!qr.edicaoPersonalizacao) return { ok: false, message: "Sem permissão." };

  try {
    await prisma.qrCode.update({
      where: { id: qr.id },
      data: {
        logo: input.logo?.trim() || null,
        imagemCapa: input.imagemCapa?.trim() || null,
        logoTamanho: SIZES.includes(input.logoTamanho) ? input.logoTamanho : "M",
        logoForma: SHAPES.includes(input.logoForma) ? input.logoForma : "circulo",
        nomeTamanho: SIZES.includes(input.nomeTamanho) ? input.nomeTamanho : "M",
        mostrarLogo: Boolean(input.mostrarLogo),
        mostrarNome: Boolean(input.mostrarNome),
      },
    });
  } catch (e) {
    console.error("[public-edit:savePageSettings]", e);
    const message = e instanceof Error ? e.message : "Erro desconhecido.";
    return { ok: false, message: `Não foi possível guardar: ${message}` };
  }
  return { ok: true };
}

// Lets the visitor change the edit code itself (after proving the current one).
export async function changeEditCode(input: {
  codigo: string;
  pin: string;
  newPin: string;
}): Promise<EditResult> {
  const qr = await authorize(input.codigo, input.pin);
  if (!qr) return { ok: false, message: "Código inválido." };

  const novo = input.newPin?.trim();
  if (!novo || novo.length < 4) {
    return { ok: false, message: "O novo código deve ter pelo menos 4 caracteres." };
  }
  try {
    await prisma.qrCode.update({
      where: { id: qr.id },
      data: { edicaoPin: await hashPassword(novo) },
    });
  } catch (e) {
    console.error("[public-edit:changeEditCode]", e);
    const message = e instanceof Error ? e.message : "Erro desconhecido.";
    return { ok: false, message: `Não foi possível guardar: ${message}` };
  }
  return { ok: true };
}

export type UploadTicket =
  | { ok: true; uploadUrl: string; publicUrl: string }
  | { ok: false; message: string };

export async function requestPublicUpload(input: {
  codigo: string;
  pin: string;
  kind: UploadKind;
  contentType: string;
  size: number;
}): Promise<UploadTicket> {
  const qr = await authorize(input.codigo, input.pin);
  if (!qr) return { ok: false, message: "Código inválido." };

  const prepared = prepareUpload(input.kind, input.contentType, input.size);
  if (!prepared.ok) return prepared;

  const uploadUrl = await createUploadUrl({
    key: prepared.key,
    contentType: input.contentType,
  });
  return { ok: true, uploadUrl, publicUrl: publicUrlFor(prepared.key) };
}
