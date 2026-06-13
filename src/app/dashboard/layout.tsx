import { requireUser } from "@/lib/auth/dal";
import DashboardShell from "@/components/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <DashboardShell
      user={{ nome: user.nome, email: user.email, role: user.role }}
    >
      {children}
    </DashboardShell>
  );
}
