"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { isContentBlock, ESTADOS_MANUTENCAO } from "@/lib/qr";
import {
  visitorIp,
  checkPinRate,
  registerPinFailure,
  clearPinFailures,
  tooManyMessage,
} from "@/lib/rate-limit";
import {
  prepareUpload,
  createUploadUrl,
  publicUrlFor,
  type UploadKind,
} from "@/lib/storage";

// Public, PIN-gated editing of a QR. No login required, but every action
// re-checks the PIN and, on top of that, the specific permission it needs:
// content and appearance are granted separately by the owner. Wrong codes are
// counted, so the code cannot simply be guessed.
// On failure, "espera" carries the minutes left when the visitor is being made
// to wait, so the page can say so in its own language.
type Authorized =
  | { ok: true; qr: NonNullable<Awaited<ReturnType<typeof findEditableQr>>> }
  | { ok: false; message: string; espera?: number };

function findEditableQr(codigo: string) {
  return prisma.qrCode.findFirst({
    where: {
      codigo,
      publicado: true,
      OR: [{ edicaoPublica: true }, { edicaoPersonalizacao: true }],
    },
  });
}

async function authorize(codigo: string, pin: string): Promise<Authorized> {
  const chave = `edit:${codigo}:${await visitorIp()}`;
  const limite = await checkPinRate(chave);
  if (!limite.ok) {
    return {
      ok: false,
      message: tooManyMessage(limite.minutos),
      espera: limite.minutos,
    };
  }

  const qr = await findEditableQr(codigo);
  if (!qr || !qr.edicaoPin) return { ok: false, message: "Código inválido." };

  if (!(await verifyPassword(pin ?? "", qr.edicaoPin))) {
    await registerPinFailure(chave);
    return { ok: false, message: "Código inválido." };
  }

  await clearPinFailures(chave);
  return { ok: true, qr };
}

// Tells the page not only that the code is right, but what it unlocks — and,
// when it is wrong, why (a bad code and too many tries read differently).
export async function verifyEditPin(
  codigo: string,
  pin: string,
): Promise<{
  ok: boolean;
  podeConteudo: boolean;
  podePersonalizar: boolean;
  espera?: number;
}> {
  const auth = await authorize(codigo, pin);
  if (!auth.ok) {
    return {
      ok: false,
      podeConteudo: false,
      podePersonalizar: false,
      espera: auth.espera,
    };
  }
  return {
    ok: true,
    podeConteudo: auth.qr.edicaoPublica,
    podePersonalizar: auth.qr.edicaoPersonalizacao,
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
  const auth = await authorize(input.codigo, input.pin);
  if (!auth.ok) return auth;
  const qr = auth.qr;
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
  const auth = await authorize(input.codigo, input.pin);
  if (!auth.ok) return auth;
  const qr = auth.qr;
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
  const auth = await authorize(input.codigo, input.pin);
  if (!auth.ok) return auth;
  const qr = auth.qr;

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
  const auth = await authorize(input.codigo, input.pin);
  if (!auth.ok) return auth;

  const prepared = prepareUpload(input.kind, input.contentType, input.size);
  if (!prepared.ok) return prepared;

  const uploadUrl = await createUploadUrl({
    key: prepared.key,
    contentType: input.contentType,
  });
  return { ok: true, uploadUrl, publicUrl: publicUrlFor(prepared.key) };
}

// Mudar o estado de uma ocorrência na própria página, sem ir ao painel. Pede o
// mesmo código de edição e a permissão de conteúdo. Pode mudar:
//   - as ocorrências dos murais de manutenção desta página;
//   - se a página tem a "Lista de ocorrências", as de todas as lojas da empresa
//     dona da página — é para isso que a lista existe.
// Nunca as de outra empresa.
export async function mudarEstadoOcorrencia(input: {
  codigo: string;
  pin: string;
  messageId: string;
  estado: string;
}): Promise<EditResult> {
  const auth = await authorize(input.codigo, input.pin);
  if (!auth.ok) return auth;
  const qr = auth.qr;
  if (!qr.edicaoPublica) return { ok: false, message: "Sem permissão." };
  if (!ESTADOS_MANUTENCAO.some((e) => e.valor === input.estado)) {
    return { ok: false, message: "Estado inválido." };
  }

  const mensagem = await prisma.qrMessage.findUnique({
    where: { id: input.messageId },
    select: { id: true, block: { select: { tipo: true, qrId: true, qr: { select: { companyId: true } } } } },
  });
  if (!mensagem || mensagem.block.tipo !== "MANUTENCAO") {
    return { ok: false, message: "Ocorrência não encontrada." };
  }

  const daPagina = mensagem.block.qrId === qr.id;
  const temLista =
    !daPagina &&
    mensagem.block.qr.companyId === qr.companyId &&
    (await prisma.qrBlock.count({ where: { qrId: qr.id, tipo: "OCORRENCIAS", ativo: true } })) > 0;
  if (!daPagina && !temLista) return { ok: false, message: "Sem permissão." };

  try {
    await prisma.qrMessage.update({ where: { id: mensagem.id }, data: { estado: input.estado } });
  } catch (e) {
    console.error("[public-edit:mudarEstadoOcorrencia]", e);
    return { ok: false, message: "Não foi possível guardar." };
  }
  return { ok: true };
}
