import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireQrManager } from "@/lib/qr-export";
import { estadoManutencao } from "@/lib/qr";
import { gerarXlsx, type Celula } from "@/lib/xlsx";

export const dynamic = "force-dynamic";

/**
 * As ocorrências de manutenção, de todas as lojas, num ficheiro Excel: data,
 * loja, mural, quem comunicou, mensagem e estado.
 *   /api/ocorrencias/export                 gestor: a sua empresa
 *                                            administrador: todas as empresas
 *   /api/ocorrencias/export?company=<id>    administrador: só essa empresa
 * Um gestor só exporta a sua: o parâmetro é ignorado.
 */
export async function GET(req: NextRequest) {
  const actor = await requireQrManager();
  if (!actor) return NextResponse.json({ error: "Sem permissao" }, { status: 401 });

  const isAdmin = actor.role === "ADMIN";
  const companyId = isAdmin ? req.nextUrl.searchParams.get("company") : actor.companyId;
  // Um gestor sem empresa não exporta nada (nunca "tudo").
  if (!isAdmin && !companyId) return NextResponse.json({ error: "Sem empresa" }, { status: 400 });

  let slug = "todas-as-empresas";
  if (companyId) {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { slug: true } });
    if (!company) return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
    slug = company.slug;
  }
  // Com todas as empresas, a empresa vai numa coluna própria.
  const comEmpresa = !companyId;

  const mensagens = await prisma.qrMessage.findMany({
    where: { block: { tipo: "MANUTENCAO", qr: companyId ? { companyId } : {} } },
    orderBy: { createdAt: "desc" },
    select: {
      nome: true,
      mensagem: true,
      estado: true,
      imagem: true,
      imagens: true,
      createdAt: true,
      block: { select: { titulo: true, qr: { select: { nome: true, company: { select: { nome: true } } } } } },
    },
  });

  const xlsx = gerarXlsx({
    folha: "Ocorrências",
    colunas: [
      { titulo: "Data", largura: 17 },
      ...(comEmpresa ? [{ titulo: "Empresa", largura: 20 }] : []),
      { titulo: "Loja / QR", largura: 24 },
      { titulo: "Mural", largura: 18 },
      { titulo: "Nome", largura: 20 },
      { titulo: "Mensagem", largura: 60 },
      { titulo: "Estado", largura: 14 },
      { titulo: "Imagens", largura: 9 },
    ],
    linhas: mensagens.map((m): Celula[] => [
      m.createdAt,
      ...(comEmpresa ? [m.block.qr.company.nome] : []),
      m.block.qr.nome,
      m.block.titulo || "Manutenção",
      m.nome,
      m.mensagem,
      estadoManutencao(m.estado).rotulo,
      // Sem as fotos, como pedido; fica só quantas tem, para saber onde há.
      m.imagens.length || (m.imagem ? 1 : 0),
    ]),
  });

  const dia = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(xlsx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ocorrencias-${slug}-${dia}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
