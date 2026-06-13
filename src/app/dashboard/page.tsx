import { Users, Building2, QrCode } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { RevealGroup, RevealItem } from "@/components/ui/reveal";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "ADMIN";

  const [totalUsers, totalCompanies, totalQr] = await Promise.all([
    prisma.user.count(),
    prisma.company.count({ where: { deletedAt: null } }),
    prisma.qrCode.count(),
  ]);

  const stats = [
    { label: "Utilizadores", value: totalUsers, icon: Users },
    ...(isAdmin
      ? [{ label: "Empresas", value: totalCompanies, icon: Building2 }]
      : []),
    { label: "QR Codes", value: totalQr, icon: QrCode },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Olá, ${user?.nome.split(" ")[0] ?? ""}`}
        description="Bem-vindo à plataforma Snaptie."
      />

      <RevealGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <RevealItem key={label}>
            <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{label}</div>
                  <div className="mt-1 text-3xl font-semibold">{value}</div>
                </div>
                <span className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/10 to-violet-500/10 text-indigo-500">
                  <Icon className="size-5" />
                </span>
              </CardContent>
            </Card>
          </RevealItem>
        ))}
      </RevealGroup>
    </div>
  );
}
