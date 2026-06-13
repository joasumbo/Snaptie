"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateName, changePassword } from "@/app/dashboard/profile/actions";

export default function ProfileView({
  user,
}: {
  user: { nome: string; email: string; role: UserRole; createdAt: string };
}) {
  const router = useRouter();

  const [nome, setNome] = useState(user.nome);
  const [savingName, setSavingName] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  async function handleSaveName() {
    setSavingName(true);
    const result = await updateName(nome);
    setSavingName(false);
    if (result.ok) {
      toast.success("Nome atualizado.");
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  async function handleChangePassword() {
    setSavingPwd(true);
    const result = await changePassword({ current, next, confirm });
    setSavingPwd(false);
    if (result.ok) {
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Palavra-passe alterada.");
    } else {
      toast.error(result.message);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardContent className="space-y-4">
          <h2 className="font-medium">Dados da conta</h2>
          <div className="space-y-1.5">
            <Label htmlFor="profile-nome">Nome</Label>
            <Input
              id="profile-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Email</div>
              <div className="mt-0.5">{user.email}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Função</div>
              <div className="mt-0.5">
                <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                Criado em
              </div>
              <div className="mt-0.5">{formatDate(user.createdAt)}</div>
            </div>
          </div>
          <Button
            onClick={handleSaveName}
            disabled={savingName || nome.trim() === user.nome}
          >
            {savingName ? <Loader2 className="animate-spin" /> : null}
            Guardar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <h2 className="font-medium">Alterar palavra-passe</h2>
          <div className="space-y-1.5">
            <Label htmlFor="pwd-current">Palavra-passe atual</Label>
            <Input
              id="pwd-current"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pwd-next">Nova palavra-passe</Label>
            <Input
              id="pwd-next"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pwd-confirm">Confirmar nova palavra-passe</Label>
            <Input
              id="pwd-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={savingPwd || !current || !next || !confirm}
          >
            {savingPwd ? <Loader2 className="animate-spin" /> : null}
            Alterar palavra-passe
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
