"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserRole, UserStatus } from "@prisma/client";
import { ROLE_OPTIONS, ROLE_LABELS, STATUS_OPTIONS, STATUS_LABELS } from "@/lib/roles";
import { createUser, updateUser } from "@/app/dashboard/users/actions";

export type EditableUser = {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};

type Props = {
  mode: "create" | "edit";
  user?: EditableUser;
  actorRole: UserRole;
  onClose: () => void;
  onSaved: () => void;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function UserFormModal({ mode, user, actorRole, onClose, onSaved }: Props) {
  const [nome, setNome] = useState(user?.nome ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(user?.role ?? "VISUALIZADOR");
  const [status, setStatus] = useState<UserStatus>(user?.status ?? "ATIVO");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleOptions = ROLE_OPTIONS.filter(
    (o) => actorRole === "ADMIN" || o.value !== "ADMIN",
  );

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    const result =
      mode === "create"
        ? await createUser({ nome, email, password, role })
        : await updateUser({ id: user!.id, nome, email, role, status });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved();
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !submitting) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Novo utilizador" : "Editar utilizador"}
          </DialogTitle>
        </DialogHeader>

        {error ? (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="space-y-4">
          <Field label="Nome">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {mode === "create" ? (
            <Field label="Palavra-passe">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          ) : null}
          <Field label="Função">
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string | null) =>
                    v ? ROLE_LABELS[v as UserRole] : "Selecionar"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {mode === "edit" ? (
            <Field label="Estado">
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as UserStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string | null) =>
                      v ? STATUS_LABELS[v as UserStatus] : "Selecionar"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            {mode === "create" ? "Criar" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
