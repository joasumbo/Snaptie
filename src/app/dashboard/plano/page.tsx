import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { PLANOS } from "@/lib/planos";
import MeuPlano from "@/components/pagamentos/meu-plano";
import { cartaoAtual } from "@/lib/stripe-pagamentos";
import { getLocale } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function PlanoPage() {
  const user = await requireRole(["GESTOR_EMPRESA"]);
  if (!user.companyId) redirect("/dashboard");

  const [company, pacotes, pagamentos, qrs] = await Promise.all([
    prisma.company.findUniqueOrThrow({
      where: { id: user.companyId },
      select: {
        plano: true,
        subscricaoEstado: true,
        subscricaoFim: true,
        subscricaoCancela: true,
        suspensaPagamento: true,
        emFaltaDesde: true,
        nome: true,
        nif: true,
        morada: true,
        pacote: { select: { id: true, nome: true, limiteQrs: true } },
      },
    }),
    prisma.pacote.findMany({
      where: { ativo: true, stripePriceId: { not: null }, OR: [{ companyId: null }, { companyId: user.companyId }] },
      orderBy: [{ ordem: "asc" }, { precoCentimos: "asc" }],
    }),
    prisma.pagamento.findMany({
      where: { companyId: user.companyId, tipo: { in: ["pacote", "renovacao"] }, estado: { in: ["pago", "falhou"] } },
      orderBy: { createdAt: "desc" },
      take: 24,
    }),
    prisma.qrCode.count({ where: { companyId: user.companyId } }),
  ]);

  const limite = company.pacote?.limiteQrs ?? PLANOS[company.plano].limiteQrs;
  const [cartao, locale] = await Promise.all([
    cartaoAtual(user.companyId).catch(() => null),
    getLocale(),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader title="O meu plano" description="O plano da sua empresa no Snaptie e os pagamentos feitos." />
      <MeuPlano
        plano={company.plano}
        pacoteAtual={company.pacote?.id ?? null}
        nomePacote={company.pacote?.nome ?? null}
        estado={company.subscricaoEstado}
        fim={company.subscricaoFim?.toISOString() ?? null}
        cancela={company.subscricaoCancela}
        cartao={cartao}
        suspensa={company.suspensaPagamento}
        emFalta={Boolean(company.emFaltaDesde)}
        faturacao={{ nome: company.nome, nif: company.nif ?? "", morada: company.morada ?? "" }}
        chavePublica={process.env.STRIPE_PUBLISHABLE_KEY ?? ""}
        locale={locale}
        qrs={qrs}
        limite={limite}
        pacotes={pacotes.map((p) => ({
          id: p.id,
          nome: p.nome,
          descricao: p.descricao ?? "",
          precoCentimos: p.precoCentimos,
          intervalo: p.intervalo,
          plano: p.plano,
          limiteQrs: p.limiteQrs ?? PLANOS[p.plano].limiteQrs,
        }))}
        pagamentos={pagamentos.map((p) => ({
          id: p.id,
          descricao: p.descricao ?? "",
          valorCentimos: p.valorCentimos,
          moeda: p.moeda,
          data: (p.pagoEm ?? p.createdAt).toISOString(),
          estado: p.estado,
          numero: p.moloniFatura ?? p.numero,
          fatura: Boolean(p.moloniFaturaPdf),
        }))}
      />
    </div>
  );
}
