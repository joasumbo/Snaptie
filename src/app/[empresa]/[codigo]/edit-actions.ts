"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { isContentBlock } from "@/lib/qr";
import {
  prepareUpload,
  createUploadUrl,
  publicUrlFor,
  type UploadKind,
} from "@/lib/storage";

// Public, PIN-gated editing of a QR's content. No login required, but every
// action re-checks that the QR allows public editing and the PIN matches.
async function authorize(codigo: string, pin: string) {
  const qr = await prisma.qrCode.findFirst({
    where: { codigo, publicado: true, edicaoPublica: true },
  });
  if (!qr || !qr.edicaoPin) return null;
  const ok = await verifyPassword(pin ?? "", qr.edicaoPin);
  return ok ? qr : null;
}

export async function verifyEditPin(
  codigo: string,
  pin: string,
): Promise<{ ok: boolean }> {
  return { ok: Boolean(await authorize(codigo, pin)) };
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

  const block = await prisma.qrBlock.findUnique({ where: { id: input.blockId } });
  if (!block || block.qrId !== qr.id) {
    return { ok: false, message: "Elemento não encontrado." };
  }
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

// Lets the visitor change the page customisation (logo, cover, visibility and
// sizes) — but never the QR's identity, publication state or the edit code.
export async function savePageSettings(input: {
  codigo: string;
  pin: string;
  logo?: string | null;
  imagemCapa?: string | null;
  logoTamanho?: string;
  logoForma?: string;
  nomeTamanho?: string;
  mostrarLogo?: boolean;
  mostrarNome?: boolean;
}): Promise<EditResult> {
  const qr = await authorize(input.codigo, input.pin);
  if (!qr) return { ok: false, message: "Código inválido." };

  try {
    await prisma.qrCode.update({
      where: { id: qr.id },
      data: {
        logo: input.logo?.trim() || null,
        imagemCapa: input.imagemCapa?.trim() || null,
        logoTamanho: SIZES.includes(input.logoTamanho ?? "") ? input.logoTamanho : "M",
        logoForma: SHAPES.includes(input.logoForma ?? "") ? input.logoForma : "circulo",
        nomeTamanho: SIZES.includes(input.nomeTamanho ?? "") ? input.nomeTamanho : "M",
        mostrarLogo: input.mostrarLogo ?? true,
        mostrarNome: input.mostrarNome ?? true,
      },
    });
  } catch (e) {
    console.error("[public-edit:savePageSettings]", e);
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
