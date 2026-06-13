import { requireRole } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import CompaniesView from "@/components/companies/companies-view";

export default async function CompaniesPage() {
  await requireRole(["ADMIN"]);

  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { users: true, qrCodes: true } } },
    orderBy: { createdAt: "desc" },
  });

  const rows = companies.map((c) => ({
    id: c.id,
    nome: c.nome,
    email: c.email,
    telefone: c.telefone,
    website: c.website,
    logo: c.logo,
    corPrimaria: c.corPrimaria,
    corSecundaria: c.corSecundaria,
    plano: c.plano,
    estado: c.estado,
    userCount: c._count.users,
    qrCount: c._count.qrCodes,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader
        title="Empresas"
        description="Faça a gestão das empresas clientes da plataforma."
      />
      <CompaniesView companies={rows} />
    </div>
  );
}
