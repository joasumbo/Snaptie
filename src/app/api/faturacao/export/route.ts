import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { lerFiltros, listaPagamentos } from "@/lib/faturacao";
import { gerarXlsx } from "@/lib/xlsx";

export const dynamic = "force-dynamic";

const TIPOS: Record<string, string> = {
  pacote: "Pacote",
  renovacao: "Renovação",
  link: "Link de pagamento",
  botao: "Botão na página",
};

// Os pagamentos do painel de faturação, com os mesmos filtros, em Excel.
export async function GET(req: NextRequest) {
  const u = await getCurrentUser();
  if (u?.role !== "ADMIN") return NextResponse.json({ error: "Sem permissao" }, { status: 401 });

  const filtros = lerFiltros(Object.fromEntries(req.nextUrl.searchParams));
  const { linhas } = await listaPagamentos(filtros, true);
  const xlsx = gerarXlsx({
    folha: "Pagamentos",
    colunas: [
      { titulo: "Data", largura: 18 },
      { titulo: "Comprovativo", largura: 18 },
      { titulo: "Tipo", largura: 18 },
      { titulo: "Descrição", largura: 34 },
      { titulo: "Empresa", largura: 26 },
      { titulo: "Cliente", largura: 24 },
      { titulo: "NIF", largura: 13 },
      { titulo: "Email", largura: 30 },
      { titulo: "Valor (€)", largura: 12 },
      { titulo: "Estado", largura: 12 },
    ],
    linhas: linhas.map((p) => [
      p.pagoEm ?? p.createdAt,
      p.numero ?? "",
      TIPOS[p.tipo] ?? p.tipo,
      p.descricao ?? "",
      p.company?.nome ?? "",
      p.nomeCliente ?? "",
      p.nifCliente ?? "",
      p.email ?? "",
      p.valorCentimos / 100,
      p.estado,
    ]),
  });
  const dia = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(xlsx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="pagamentos-snaptie-${dia}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
