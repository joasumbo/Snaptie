import { requireRole, USER_MANAGEMENT_ROLES } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import UsersView from "@/components/users/users-view";

export default async function UsersPage() {
  const actor = await requireRole(USER_MANAGEMENT_ROLES);

  // Admins see every user; company managers only see their own company.
  const where = actor.role === "ADMIN" ? {} : { companyId: actor.companyId };

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      status: true,
      ultimoLogin: true,
      createdAt: true,
      companyId: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Admins can move users between companies.
  const companies =
    actor.role === "ADMIN"
      ? await prisma.company.findMany({
          where: { deletedAt: null },
          select: { id: true, nome: true },
          orderBy: { nome: "asc" },
        })
      : [];

  const rows = users.map((u) => ({
    ...u,
    ultimoLogin: u.ultimoLogin ? u.ultimoLogin.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Utilizadores"
        description="Faça a gestão dos utilizadores da plataforma."
      />
      <UsersView
        users={rows}
        actor={{ id: actor.id, role: actor.role }}
        companies={companies}
      />
    </div>
  );
}
