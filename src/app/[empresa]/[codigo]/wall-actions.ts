"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { visitorIp } from "@/lib/rate-limit";
import {
  prepareUpload,
  createUploadUrl,
  publicUrlFor,
  type UploadTicket,
} from "@/lib/storage";
import { sendMaintenanceEmail } from "@/lib/email";
import { ESTADO_INICIAL, emailsManutencao } from "@/lib/qr";

// The message wall: any visitor may leave a message on a FEED block, with no
// code and no account. That is the point of it — and also why it needs limits.

const MAX_NOME = 40;
const MAX_MENSAGEM = 500;
const MAX_POR_JANELA = 3; // messages one visitor may leave...
const JANELA_MINUTOS = 5; // ...in this many minutes

export type WallResult = { ok: true } | { ok: false; motivo: "invalido" | "vazio" | "muitas" };

// Só se guarda o endereço de uma imagem que saiu do nosso próprio
// armazenamento. Sem esta verificação, o campo aceitava qualquer endereço e o
// mural passava a servir para pendurar imagens de terceiros.
function imagemNossa(url: string): boolean {
  const base = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
  return Boolean(base) && url.startsWith(`${base}/`);
}

// O mesmo bloco visto duas vezes: tem de ser um mural vivo numa página
// publicada, e não um bloco qualquer cujo id alguém conheça.
async function muralVivo(codigo: string, blockId: string) {
  return prisma.qrBlock.findFirst({
    where: {
      id: blockId,
      tipo: { in: ["FEED", "MANUTENCAO"] },
      ativo: true,
      qr: { codigo, publicado: true },
    },
    select: {
      id: true,
      tipo: true,
      titulo: true,
      conteudo: true,
      qr: { select: { nome: true, company: { select: { slug: true } } } },
    },
  });
}

// O endereço vem do próprio pedido, não de uma variável de ambiente. Uma
// variável mal configurada mandaria toda a gente para localhost, e é um erro
// que só se descobre quando alguém carrega no link do email.
async function enderecoBase(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return (process.env.APP_URL ?? "").replace(/\/$/, "");
}

export async function postWallMessage(input: {
  codigo: string;
  blockId: string;
  nome: string;
  mensagem: string;
  imagem?: string;
}): Promise<WallResult> {
  const nome = input.nome?.trim().slice(0, MAX_NOME) ?? "";
  const mensagem = input.mensagem?.trim().slice(0, MAX_MENSAGEM) ?? "";
  const imagem = input.imagem?.trim() ?? "";
  if (imagem && !imagemNossa(imagem)) return { ok: false, motivo: "invalido" };
  // Uma imagem sozinha já é uma mensagem; o texto passa a ser dispensável.
  if (!nome || (!mensagem && !imagem)) return { ok: false, motivo: "vazio" };

  const block = await muralVivo(input.codigo, input.blockId);
  if (!block) return { ok: false, motivo: "invalido" };

  // An open form on a public page is a spam magnet, so one visitor only gets a
  // few messages per window.
  const ip = await visitorIp();
  const desde = new Date(Date.now() - JANELA_MINUTOS * 60_000);
  const recentes = await prisma.qrMessage.count({
    where: { blockId: block.id, ip, createdAt: { gte: desde } },
  });
  if (recentes >= MAX_POR_JANELA) return { ok: false, motivo: "muitas" };

  const manutencao = block.tipo === "MANUTENCAO";
  await prisma.qrMessage.create({
    data: {
      blockId: block.id,
      nome,
      mensagem,
      imagem: imagem || null,
      // Uma avaria acabada de comunicar está, por definição, por resolver.
      estado: manutencao ? ESTADO_INICIAL : null,
      ip,
    },
  });

  // O aviso vai depois de a mensagem estar guardada, e uma falha no envio não
  // a desfaz. Perder a participação por causa do email seria o pior dos dois
  // mundos: quem escreveu ficava convencido de que comunicou, e não comunicou.
  if (manutencao) {
    const conteudo =
      block.conteudo && typeof block.conteudo === "object"
        ? (block.conteudo as Record<string, unknown>)
        : {};
    const destinatarios = emailsManutencao(conteudo);
    if (destinatarios.length > 0) {
      try {
        await sendMaintenanceEmail({
          to: destinatarios,
          pagina: block.qr.nome,
          mural: block.titulo,
          nome,
          mensagem,
          imagem: imagem || null,
          link: `${await enderecoBase()}/${block.qr.company.slug}/${input.codigo}`,
        });
      } catch (e) {
        console.error("[manutencao:email]", e);
      }
    }
  }

  revalidatePath(`/${block.qr.company.slug}/${input.codigo}`);
  return { ok: true };
}

// Só imagens de verdade, e sem SVG: um SVG é um documento que pode trazer
// script lá dentro, e aqui quem carrega o ficheiro é um visitante anónimo.
const TIPOS_IMAGEM = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Dá ao visitante uma autorização de curta duração para enviar uma imagem
// diretamente para o armazenamento. Passa pelas mesmas barreiras da mensagem:
// mural vivo, página publicada e o mesmo limite por visitante.
export async function requestWallUpload(input: {
  codigo: string;
  blockId: string;
  contentType: string;
  size: number;
}): Promise<UploadTicket> {
  if (!TIPOS_IMAGEM.includes(input.contentType)) {
    return { ok: false, message: "Formato de imagem não suportado." };
  }

  const block = await muralVivo(input.codigo, input.blockId);
  if (!block) return { ok: false, message: "Mural indisponível." };

  const ip = await visitorIp();
  const desde = new Date(Date.now() - JANELA_MINUTOS * 60_000);
  const recentes = await prisma.qrMessage.count({
    where: { blockId: block.id, ip, createdAt: { gte: desde } },
  });
  if (recentes >= MAX_POR_JANELA) {
    return { ok: false, message: "Demasiadas mensagens. Tente daqui a pouco." };
  }

  const prepared = prepareUpload("image", input.contentType, input.size);
  if (!prepared.ok) return prepared;

  const uploadUrl = await createUploadUrl({
    key: prepared.key,
    contentType: input.contentType,
  });
  return { ok: true, uploadUrl, publicUrl: publicUrlFor(prepared.key) };
}

// Marca um acontecimento num bloco de registo. Ao contrário do mural, o
// visitante não escreve texto: só escolhe uma das ações configuradas, e é essa
// escolha que fica guardada. Aceitar texto livre aqui abriria a porta a que
// qualquer pessoa escrevesse o que quisesse no histórico.
export async function registarEvento(input: {
  codigo: string;
  blockId: string;
  acao: string;
}): Promise<WallResult> {
  const block = await prisma.qrBlock.findFirst({
    where: {
      id: input.blockId,
      tipo: "CHAT",
      ativo: true,
      qr: { codigo: input.codigo, publicado: true },
    },
    select: {
      id: true,
      conteudo: true,
      qr: { select: { company: { select: { slug: true } } } },
    },
  });
  if (!block) return { ok: false, motivo: "invalido" };

  // A ação tem de ser uma das do bloco. Sem esta verificação, o blockId
  // sozinho bastava para escrever qualquer coisa no histórico.
  const conteudo =
    block.conteudo && typeof block.conteudo === "object"
      ? (block.conteudo as Record<string, unknown>)
      : {};
  const acoes = Array.isArray(conteudo.acoes)
    ? conteudo.acoes.filter((a): a is string => typeof a === "string")
    : [];
  if (!acoes.includes(input.acao)) {
    return { ok: false, motivo: "invalido" };
  }

  const ip = await visitorIp();
  const desde = new Date(Date.now() - JANELA_MINUTOS * 60_000);
  const recentes = await prisma.qrMessage.count({
    where: { blockId: block.id, ip, createdAt: { gte: desde } },
  });
  // Um percurso tem várias marcas seguidas (entrou, saiu, entrou), por isso o
  // limite é mais folgado do que no mural — mas continua a existir.
  if (recentes >= MAX_POR_JANELA * 4) return { ok: false, motivo: "muitas" };

  await prisma.qrMessage.create({
    data: { blockId: block.id, nome: "", mensagem: input.acao, ip },
  });

  revalidatePath(`/${block.qr.company.slug}/${input.codigo}`);
  revalidatePath(`/${block.qr.company.slug}`);
  return { ok: true };
}
