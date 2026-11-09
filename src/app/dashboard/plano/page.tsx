import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { PLANOS } from "@/lib/planos";
import MeuPlano from "@/components/pagamentos/meu-plano";

export const dynamic = "force-dynamic";

export default async function PlanoPage({
  searchParams,
}: {
  searchParams: Promise<{ pagamento?: string }>;
}) {
  const user = await requireRole(["GESTOR_EMPRESA"]);
  if (!user.companyId) redirect("/dashboard");
  const sp = await searchParams;

  const [company, pacotes, pagamentos, qrs] = await Promise.all([
    prisma.company.findUniqueOrThrow({
      where: { id: user.companyId },
      select: {
        plano: true,
        stripeCustomerId: true,
        subscricaoEstado: true,
        subscricaoFim: true,
        pacote: { select: { id: true, nome: true, limiteQrs: true } },
      },
    }),
    prisma.pacote.findMany({
      where: { ativo: true, stripePriceId: { not: null } },
      orderBy: [{ ordem: "asc" }, { precoCentimos: "asc" }],
    }),
    prisma.pagamento.findMany({
      where: { companyId: user.companyId, tipo: { in: ["pacote", "renovacao"] }, estado: "pago" },
      orderBy: { createdAt: "desc" },
      take: 24,
    }),
    prisma.qrCode.count({ where: { companyId: user.companyId } }),
  ]);

  const limite = company.pacote?.limiteQrs ?? PLANOS[company.plano].limiteQrs;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader title="O meu plano" description="O plano da sua empresa no Snaptie e os pagamentos feitos." />
      <MeuPlano
        retorno={sp.pagamento === "ok" ? "ok" : sp.pagamento === "cancelado" ? "cancelado" : null}
        plano={company.plano}
        pacoteAtual={company.pacote?.id ?? null}
        nomePacote={company.pacote?.nome ?? null}
        estado={company.subscricaoEstado}
        fim={company.subscricaoFim?.toISOString() ?? null}
        temCliente={Boolean(company.stripeCustomerId)}
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
          data: p.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
