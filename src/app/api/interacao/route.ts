import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { visitorIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Um visitante carregou num elemento da página. Chega por navigator.sendBeacon,
// por isso a resposta não interessa a ninguém: responde sempre 204 e nunca
// atrasa a ida do visitante para o link.
//
// Só conta cliques em elementos de páginas publicadas, e um mesmo visitante
// não marca mais do que 60 em 5 minutos — sem isto, bastava um script para
// encher as estatísticas de um concorrente.
const MAX_POR_JANELA = 60;
const JANELA_MINUTOS = 5;

export async function POST(req: NextRequest) {
  let corpo: { codigo?: unknown; blockId?: unknown };
  try {
    corpo = JSON.parse(await req.text());
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const codigo = typeof corpo.codigo === "string" ? corpo.codigo.slice(0, 40) : "";
  const blockId = typeof corpo.blockId === "string" ? corpo.blockId.slice(0, 40) : "";
  if (!codigo || !blockId) return new NextResponse(null, { status: 204 });

  try {
    const block = await prisma.qrBlock.findFirst({
      where: { id: blockId, ativo: true, qr: { codigo, publicado: true } },
      select: { id: true, qrId: true },
    });
    if (!block) return new NextResponse(null, { status: 204 });

    const ip = await visitorIp();
    const desde = new Date(Date.now() - JANELA_MINUTOS * 60_000);
    const recentes = await prisma.interacao.count({
      where: { qrId: block.qrId, ip, dataHora: { gte: desde } },
    });
    if (recentes >= MAX_POR_JANELA) return new NextResponse(null, { status: 204 });

    await prisma.interacao.create({
      data: {
        qrId: block.qrId,
        blockId: block.id,
        ip,
        navegador: (req.headers.get("user-agent") ?? "").slice(0, 255) || null,
      },
    });
  } catch (e) {
    // Estatística não é crítica: uma falha aqui não pode incomodar o visitante.
    console.error("[interacao]", e);
  }
  return new NextResponse(null, { status: 204 });
}
