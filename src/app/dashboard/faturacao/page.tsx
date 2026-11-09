import { requireRole } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { emFalta, lerFiltros, listaPagamentos, recorrente, saldo, series, totais, POR_PAGINA } from "@/lib/faturacao";
import FaturacaoView from "@/components/pagamentos/faturacao-view";

export const dynamic = "force-dynamic";

export default async function FaturacaoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["ADMIN"]);
  const filtros = lerFiltros(await searchParams);

  const [t, s, r, b, falta, lista] = await Promise.all([
    totais(),
    series(),
    recorrente(),
    saldo(),
    emFalta(),
    listaPagamentos(filtros),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader title="Faturação" description="O que entrou pelo Snaptie, quem pagou e quando." />
      <FaturacaoView
        totais={t}
        series={s}
        recorrente={r}
        saldo={b}
        emFalta={falta}
        filtros={filtros}
        porPagina={POR_PAGINA}
        contagem={lista.contagem}
        soma={lista.soma}
        linhas={lista.linhas.map((p) => ({
          id: p.id,
          data: (p.pagoEm ?? p.createdAt).toISOString(),
          tipo: p.tipo,
          estado: p.estado,
          descricao: p.descricao ?? "",
          pacote: p.pacote?.nome ?? "",
          empresa: p.company?.nome ?? "",
          cliente: p.nomeCliente ?? "",
          email: p.email ?? "",
          valorCentimos: p.valorCentimos,
          moeda: p.moeda,
          numero: p.moloniFatura ?? p.numero,
          fatura: Boolean(p.moloniFaturaPdf),
        }))}
      />
    </div>
  );
}
