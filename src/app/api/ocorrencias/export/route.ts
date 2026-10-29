import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireQrManager } from "@/lib/qr-export";
import { lerOcorrencias, ocorrenciasXlsx, respostaXlsx } from "@/lib/ocorrencias";

export const dynamic = "force-dynamic";

/**
 * As ocorrências de manutenção, de todas as lojas, num ficheiro Excel (painel).
 *   /api/ocorrencias/export                 gestor: a sua empresa
 *                                            administrador: todas as empresas
 *   /api/ocorrencias/export?company=<id>    administrador: só essa empresa
 * Um gestor só exporta a sua: o parâmetro é ignorado.
 * O elemento "Lista de ocorrências" das páginas usa /api/ocorrencias/bloco.
 */
export async function GET(req: NextRequest) {
  const actor = await requireQrManager();
  if (!actor) return NextResponse.json({ error: "Sem permissao" }, { status: 401 });

  const isAdmin = actor.role === "ADMIN";
  const companyId = isAdmin ? req.nextUrl.searchParams.get("company") : actor.companyId;
  // Um gestor sem empresa não exporta nada (nunca "tudo").
  if (!isAdmin && !companyId) return NextResponse.json({ error: "Sem empresa" }, { status: 400 });

  let nome = "todas-as-empresas";
  if (companyId) {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { slug: true } });
    if (!company) return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
    nome = company.slug;
  }

  return respostaXlsx(ocorrenciasXlsx(await lerOcorrencias(companyId), !companyId), nome);
}
