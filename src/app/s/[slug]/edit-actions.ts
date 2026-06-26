"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import {
  prepareUpload,
  createUploadUrl,
  publicUrlFor,
  type UploadKind,
} from "@/lib/storage";

// Public, PIN-gated editing of a QR's content. No login required, but every
// action re-checks that the QR allows public editing and the PIN matches.
async function authorize(slug: string, pin: string) {
  const qr = await prisma.qrCode.findFirst({
    where: { slug, publicado: true, edicaoPublica: true },
  });
  if (!qr || !qr.edicaoPin) return null;
  const ok = await verifyPassword(pin ?? "", qr.edicaoPin);
  return ok ? qr : null;
}

export async function verifyEditPin(
  slug: string,
  pin: string,
): Promise<{ ok: boolean }> {
  return { ok: Boolean(await authorize(slug, pin)) };
}

export type EditResult = { ok: true } | { ok: false; message: string };

export async function saveBlockContent(input: {
  slug: string;
  pin: string;
  blockId: string;
  titulo: string;
  conteudo: Record<string, unknown>;
}): Promise<EditResult> {
  const qr = await authorize(input.slug, input.pin);
  if (!qr) return { ok: false, message: "Código inválido." };
  if (!input.titulo?.trim()) return { ok: false, message: "O título é obrigatório." };

  const block = await prisma.qrBlock.findUnique({ where: { id: input.blockId } });
  if (!block || block.qrId !== qr.id) {
    return { ok: false, message: "Elemento não encontrado." };
  }

  // Only the content is editable here — never the type, order or existence.
  await prisma.qrBlock.update({
    where: { id: block.id },
    data: {
      titulo: input.titulo.trim(),
      conteudo: (input.conteudo ?? {}) as Prisma.InputJsonValue,
    },
  });
  return { ok: true };
}

export type UploadTicket =
  | { ok: true; uploadUrl: string; publicUrl: string }
  | { ok: false; message: string };

export async function requestPublicUpload(input: {
  slug: string;
  pin: string;
  kind: UploadKind;
  contentType: string;
  size: number;
}): Promise<UploadTicket> {
  const qr = await authorize(input.slug, input.pin);
  if (!qr) return { ok: false, message: "Código inválido." };

  const prepared = prepareUpload(input.kind, input.contentType, input.size);
  if (!prepared.ok) return prepared;

  const uploadUrl = await createUploadUrl({
    key: prepared.key,
    contentType: input.contentType,
  });
  return { ok: true, uploadUrl, publicUrl: publicUrlFor(prepared.key) };
}
