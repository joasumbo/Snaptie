import { requireRole } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import {
  emFalta,
  faturasPorEmitir,
  lerFiltros,
  listaPagamentos,
  porTipo,
  recorrente,
  saldo,
  series,
  totais,
  POR_PAGINA,
} from "@/lib/faturacao";
import { configuracaoFaturas, faturacaoAtiva } from "@/lib/moloni-faturas";
import { stripeConfigurado } from "@/lib/stripe";
import FaturacaoView from "@/components/pagamentos/faturacao-view";

export const dynamic = "force-dynamic";

export default async function FaturacaoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["ADMIN"]);
  const filtros = lerFiltros(await searchParams);
  const cfg = await configuracaoFaturas();

  const [t, s, r, b, falta, lista, tipos, porEmitir, moloni, empresas, pacotes] = await Promise.all([
    totais(),
    series(),
    recorrente(),
    saldo(),
    emFalta(),
    listaPagamentos(filtros),
    porTipo(filtros),
    faturasPorEmitir(cfg.desde),
    faturacaoAtiva(),
    prisma.company.findMany({ where: { deletedAt: null }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.pacote.findMany({
      where: { ativo: true, stripePriceId: { not: null } },
      orderBy: [{ ordem: "asc" }, { precoCentimos: "asc" }],
    }),
  ]);

  // As páginas dos QRs comprados na loja, para abrir a partir da ficha.
  const comprados = lista.linhas.map((p) => p.qrCompradoId).filter((x): x is string => Boolean(x));
  const paginas = new Map(
    (
      await prisma.qrCode.findMany({
        where: { id: { in: comprados } },
        select: { id: true, codigo: true, company: { select: { slug: true } } },
      })
    ).map((q) => [q.id, `/${q.company.slug}/${q.codigo}`]),
  );

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
        porTipo={tipos}
        porEmitir={porEmitir}
        moloni={moloni ? { serie: cfg.serieNome ?? "" } : null}
        podeCobrar={stripeConfigurado()}
        empresas={empresas}
        pacotes={pacotes.map((p) => ({
          id: p.id,
          nome: p.nome,
          descricao: p.descricao ?? "",
          precoCentimos: p.precoCentimos,
          intervalo: p.intervalo,
          plano: p.plano,
          limiteQrs: p.limiteQrs,
          ativo: p.ativo,
          ordem: p.ordem,
          sincronizado: Boolean(p.stripePriceId),
          empresas: 0,
          companyId: p.companyId,
          empresaPrivada: null,
        }))}
        linhas={lista.linhas.map((p) => ({
          id: p.id,
          data: (p.pagoEm ?? p.createdAt).toISOString(),
          criado: p.createdAt.toISOString(),
          tipo: p.tipo,
          estado: p.estado,
          descricao: p.descricao ?? "",
          pacote: p.pacote?.nome ?? "",
          empresa: p.company?.nome ?? "",
          cliente: p.nomeCliente ?? "",
          nif: p.nifCliente ?? p.company?.nif ?? "",
          morada: [p.moradaCliente, [p.cpCliente, p.cidadeCliente].filter(Boolean).join(" ")].filter(Boolean).join(", "),
          email: p.email ?? p.company?.email ?? "",
          valorCentimos: p.valorCentimos,
          moeda: p.moeda,
          numero: p.moloniFatura ?? p.numero,
          fatura: Boolean(p.moloniFaturaPdf),
          proforma: p.moloniOrcamentoPdf ? p.moloniOrcamento : null,
          erroFatura: p.estado === "pago" && !p.moloniFaturaPdf ? p.moloniErro : null,
          emailEnviado: p.emailEnviadoEm?.toISOString() ?? null,
          faturaEnviada: p.faturaEnviadaEm?.toISOString() ?? null,
          qrPagina: p.qrCompradoId ? (paginas.get(p.qrCompradoId) ?? null) : null,
          qrEntregue: p.qrEntregueEm?.toISOString() ?? null,
          entregaQr: Boolean(p.qrModeloId),
        }))}
      />
    </div>
  );
}
