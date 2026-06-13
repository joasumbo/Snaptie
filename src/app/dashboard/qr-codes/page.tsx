import { requireRole } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import QrCodesView from "@/components/qr/qr-codes-view";

export default async function QrCodesPage() {
  const actor = await requireRole(["ADMIN", "GESTOR_EMPRESA", "GESTOR_QR"]);
  const isAdmin = actor.role === "ADMIN";

  const where = isAdmin ? {} : { companyId: actor.companyId ?? "__none__" };

  const qrs = await prisma.qrCode.findMany({
    where,
    include: {
      _count: { select: { blocks: true } },
      company: { select: { nome: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const companies = isAdmin
    ? await prisma.company.findMany({
        where: { deletedAt: null },
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      })
    : [];

  const rows = qrs.map((q) => ({
    id: q.id,
    nome: q.nome,
    descricao: q.descricao,
    corPrimaria: q.corPrimaria,
    corSecundaria: q.corSecundaria,
    publicado: q.publicado,
    blockCount: q._count.blocks,
    scansTotal: q.scansTotal,
    createdAt: q.createdAt.toISOString(),
    companyNome: q.company.nome,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR Codes"
        description="Crie e faça a gestão dos seus QR codes."
      />
      <QrCodesView qrs={rows} companies={companies} isAdmin={isAdmin} />
    </div>
  );
}
