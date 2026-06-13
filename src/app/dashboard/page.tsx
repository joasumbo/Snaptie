import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const totalUsers = await prisma.user.count();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader
        title={`Olá, ${user?.nome.split(" ")[0] ?? ""}`}
        description="Bem-vindo à plataforma Snaptie."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <Card>
          <div style={{ color: "var(--ds-text-subtle)", fontSize: 13 }}>
            Utilizadores
          </div>
          <div style={{ fontSize: 32, fontWeight: 600, marginTop: 4 }}>
            {totalUsers}
          </div>
        </Card>
      </div>
    </div>
  );
}
