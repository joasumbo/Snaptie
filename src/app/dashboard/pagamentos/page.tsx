import { requireRole } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { CHAVES, diasTolerancia, lerConfig, lerEmissor, limitesAtivos } from "@/lib/configuracao";
import { modoStripe, stripe, stripeConfigurado } from "@/lib/stripe";
import { estadoWebhook } from "@/lib/stripe-pagamentos";
import PagamentosAdmin from "@/components/pagamentos/pagamentos-admin";
import MoloniAdmin from "@/components/pagamentos/moloni-admin";
import LojaAdmin from "@/components/pagamentos/loja-admin";
import { estadoMoloni } from "@/lib/moloni";
import { configuracaoFaturas, seriesMoloni } from "@/lib/moloni-faturas";

export const dynamic = "force-dynamic";

async function contaStripe(): Promise<{ nome: string } | { erro: string } | null> {
  if (!stripeConfigurado()) return null;
  try {
    const conta = await stripe().accounts.retrieveCurrent();
    return { nome: conta.business_profile?.name || conta.settings?.dashboard?.display_name || conta.id };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) };
  }
}

export default async function PagamentosPage() {
  await requireRole(["ADMIN"]);

  const [emissor, avisoAdmin, dias, empresas] = await Promise.all([
    lerEmissor(),
    lerConfig(CHAVES.avisoAdmin),
    diasTolerancia(),
    prisma.company.findMany({ where: { deletedAt: null }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  const [conta, webhook, limites, pacotes, pagamentos, subscritas] = await Promise.all([
    contaStripe(),
    stripeConfigurado() ? estadoWebhook().catch(() => ({ ligado: false as const })) : Promise.resolve({ ligado: false as const }),
    limitesAtivos(),
    prisma.pacote.findMany({
      orderBy: [{ ordem: "asc" }, { precoCentimos: "asc" }],
      include: { _count: { select: { empresas: true } }, empresa: { select: { nome: true } } },
    }),
    prisma.pagamento.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { company: { select: { nome: true } } },
    }),
    prisma.company.findMany({
      where: { deletedAt: null, subscricaoEstado: { not: null } },
      select: {
        id: true,
        nome: true,
        plano: true,
        subscricaoEstado: true,
        subscricaoFim: true,
        subscricaoCancela: true,
        suspensaPagamento: true,
        pacote: { select: { nome: true } },
      },
      orderBy: { nome: "asc" },
    }),
  ]);

  // A loja: o que está à venda (com as vendas de cada um) e os QRs que se
  // podem pôr à venda (fora as cópias já vendidas e as cópias em série).
  const [aVenda, vendas, comprados, todos] = await Promise.all([
    prisma.qrCode.findMany({
      where: { precoVenda: { not: null } },
      select: { id: true, nome: true, precoVenda: true, publicado: true, company: { select: { nome: true } } },
      orderBy: { nome: "asc" },
    }),
    prisma.pagamento.groupBy({ by: ["qrId"], where: { tipo: "qr", estado: "pago" }, _count: { _all: true } }),
    prisma.pagamento.findMany({ where: { qrCompradoId: { not: null } }, select: { qrCompradoId: true } }),
    prisma.qrCode.findMany({
      where: { lote: null, company: { deletedAt: null } },
      select: { id: true, nome: true, company: { select: { nome: true } } },
      orderBy: { updatedAt: "desc" },
      take: 2000,
    }),
  ]);
  const vendidos = new Map(vendas.map((v) => [v.qrId, v._count._all]));
  const copias = new Set(comprados.map((c) => c.qrCompradoId));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader
        title="Pagamentos"
        description="Pacotes à venda, ligação ao Stripe e pagamentos recebidos."
      />
      <MoloniAdmin
        estado={await estadoMoloni()}
        serie={(await configuracaoFaturas()).serie}
        series={await seriesMoloni().catch(() => [])}
      />
      <LojaAdmin
        aVenda={aVenda.map((q) => ({
          id: q.id,
          nome: q.nome,
          empresa: q.company.nome,
          precoCentimos: q.precoVenda!,
          publicado: q.publicado,
          vendidos: vendidos.get(q.id) ?? 0,
        }))}
        qrs={todos.filter((q) => !copias.has(q.id)).map((q) => ({ id: q.id, nome: q.nome, empresa: q.company.nome }))}
      />
      <PagamentosAdmin
        modo={modoStripe()}
        conta={conta}
        webhook={webhook}
        limites={limites}
        emissor={emissor}
        avisoAdmin={avisoAdmin ?? ""}
        dias={dias}
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
          empresas: p._count.empresas,
          companyId: p.companyId,
          empresaPrivada: p.empresa?.nome ?? null,
        }))}
        pagamentos={pagamentos.map((p) => ({
          id: p.id,
          tipo: p.tipo,
          estado: p.estado,
          valorCentimos: p.valorCentimos,
          moeda: p.moeda,
          descricao: p.descricao ?? "",
          empresa: p.company?.nome ?? "",
          email: p.email ?? "",
          data: p.createdAt.toISOString(),
          link: p.estado !== "pago" && p.estado !== "expirado" && p.tipo !== "botao" ? `/pagar/${p.id}` : null,
          numero: p.moloniFatura ?? p.numero,
          fatura: Boolean(p.moloniFaturaPdf),
          proforma: p.moloniOrcamento,
          emailEnviado: Boolean(p.emailEnviadoEm),
        }))}
        subscritas={subscritas.map((c) => ({
          id: c.id,
          nome: c.nome,
          plano: c.plano,
          pacote: c.pacote?.nome ?? "",
          estado: c.suspensaPagamento ? "suspensa" : c.subscricaoCancela && c.subscricaoEstado === "ativa" ? "a_cancelar" : (c.subscricaoEstado ?? ""),
          fim: c.subscricaoFim?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
