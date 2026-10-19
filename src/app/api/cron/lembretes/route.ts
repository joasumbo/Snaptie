import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendLembreteEmail } from "@/lib/email";
import { agoraEmLisboa, calhaNoDia, descreverRegra, lerLembrete } from "@/lib/lembrete";

export const dynamic = "force-dynamic";

/**
 * Envia os lembretes que estão na hora. Chamado de 15 em 15 minutos pelo
 * temporizador snaptie-lembretes no servidor, com a chave CRON_SECRET.
 *
 * Cada envio fica registado como mensagem do bloco (estado "envio:AAAA-MM-DD").
 * É isso que impede o mesmo lembrete de sair duas vezes no mesmo dia, e dá ao
 * dono o histórico do que foi enviado. Se o servidor estiver parado à hora
 * marcada, o lembrete sai na primeira passagem a seguir, ainda nesse dia.
 */
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ error: "CRON_SECRET nao definido" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 401 });
  }

  const agora = agoraEmLisboa();
  const base = (process.env.APP_URL || "https://mysnaptie.com").replace(/\/$/, "");
  const blocos = await prisma.qrBlock.findMany({
    where: { tipo: "LEMBRETE", ativo: true },
    select: {
      id: true,
      titulo: true,
      conteudo: true,
      qr: { select: { nome: true, codigo: true, company: { select: { slug: true } } } },
    },
  });

  let enviados = 0;
  const erros: string[] = [];
  for (const b of blocos) {
    const conteudo = b.conteudo && typeof b.conteudo === "object" ? (b.conteudo as Record<string, unknown>) : {};
    const l = lerLembrete(conteudo);
    if (l.emails.length === 0 || !calhaNoDia(l, agora.dia) || agora.hora < l.hora) continue;

    const marca = `envio:${agora.dia}`;
    const jaEnviado = await prisma.qrMessage.findFirst({ where: { blockId: b.id, estado: marca }, select: { id: true } });
    if (jaEnviado) continue;

    // Marca primeiro e envia depois: se o envio falhar, a marca sai e o
    // lembrete tenta outra vez na passagem seguinte.
    const registo = await prisma.qrMessage.create({
      data: { blockId: b.id, nome: "Lembrete enviado", mensagem: `Para ${l.emails.join(", ")}`, estado: marca },
    });
    try {
      await sendLembreteEmail({
        to: l.emails,
        pagina: b.qr.nome,
        titulo: b.titulo,
        mensagem: l.mensagem,
        quando: descreverRegra(l),
        link: `${base}/${b.qr.company.slug}/${b.qr.codigo ?? ""}`,
      });
      enviados++;
    } catch (e) {
      await prisma.qrMessage.delete({ where: { id: registo.id } }).catch(() => {});
      console.error("[lembrete]", b.id, e);
      erros.push(b.id);
    }
  }

  return NextResponse.json({ agora, verificados: blocos.length, enviados, erros });
}
