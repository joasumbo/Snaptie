import { requireUser } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import ProfileView from "@/components/profile/profile-view";

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader title="Perfil" description="Os seus dados pessoais e segurança." />
      <ProfileView
        user={{
          nome: user.nome,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        }}
      />
    </div>
  );
}
