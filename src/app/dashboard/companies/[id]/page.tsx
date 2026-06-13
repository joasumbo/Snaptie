import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import CompanyDetailView from "@/components/companies/company-detail-view";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMIN"]);
  const { id } = await params;

  const company = await prisma.company.findFirst({
    where: { id, deletedAt: null },
    include: { _count: { select: { users: true, qrCodes: true } } },
  });
  if (!company) notFound();

  const scans = await prisma.qrCode.aggregate({
    where: { companyId: id },
    _sum: { scansTotal: true },
  });

  return (
    <CompanyDetailView
      company={{
        id: company.id,
        nome: company.nome,
        slug: company.slug,
        email: company.email,
        telefone: company.telefone,
        website: company.website,
        logo: company.logo,
        corPrimaria: company.corPrimaria,
        corSecundaria: company.corSecundaria,
        plano: company.plano,
        estado: company.estado,
        createdAt: company.createdAt.toISOString(),
      }}
      indicators={{
        users: company._count.users,
        qrCodes: company._count.qrCodes,
        scans: scans._sum.scansTotal ?? 0,
      }}
    />
  );
}
