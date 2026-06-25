"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import type { UserRole, UserStatus } from "@prisma/client";
import { ROLE_LABELS, STATUS_LABELS, STATUS_TONE } from "@/lib/roles";
import { formatDate, formatDateTime } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UserFormModal, type EditableUser } from "./user-form-modal";
import { deleteUser, setUserStatus } from "@/app/dashboard/users/actions";

export type UserRow = {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  ultimoLogin: string | null;
  createdAt: string;
  companyId: string | null;
};

export default function UsersView({
  users,
  actor,
  companies,
}: {
  users: UserRow[];
  actor: { id: string; role: UserRole };
  companies: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<
    { mode: "create" } | { mode: "edit"; user: EditableUser } | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, query]);

  const canManage = (u: UserRow) => actor.role === "ADMIN" || u.role !== "ADMIN";

  async function handleToggleStatus(u: UserRow) {
    setBusyId(u.id);
    await setUserStatus(u.id, u.status === "ATIVO" ? "INATIVO" : "ATIVO");
    setBusyId(null);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    await deleteUser(deleteTarget.id);
    setBusyId(null);
    setDeleteTarget(null);
    router.refresh();
  }

  const columns: Column<UserRow>[] = [
    {
      key: "nome",
      header: "Nome",
      sortable: true,
      sortValue: (u) => u.nome.toLowerCase(),
      cell: (u) => <span className="font-medium">{u.nome}</span>,
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
      hideOnMobile: true,
      sortValue: (u) => u.email.toLowerCase(),
      cell: (u) => <span className="text-muted-foreground">{u.email}</span>,
    },
    {
      key: "role",
      header: "Função",
      sortable: true,
      hideOnMobile: true,
      sortValue: (u) => u.role,
      cell: (u) => <Badge variant="secondary">{ROLE_LABELS[u.role]}</Badge>,
    },
    {
      key: "status",
      header: "Estado",
      sortable: true,
      sortValue: (u) => u.status,
      cell: (u) => (
        <StatusBadge tone={STATUS_TONE[u.status]}>
          {STATUS_LABELS[u.status]}
        </StatusBadge>
      ),
    },
    {
      key: "ultimoLogin",
      header: "Último login",
      sortable: true,
      hideOnMobile: true,
      sortValue: (u) => u.ultimoLogin ?? "",
      cell: (u) => (
        <span className="text-muted-foreground">
          {formatDateTime(u.ultimoLogin)}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Criado",
      sortable: true,
      hideOnMobile: true,
      sortValue: (u) => u.createdAt,
      cell: (u) => (
        <span className="text-muted-foreground">{formatDate(u.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      alignRight: true,
      cell: (u) => {
        const isSelf = u.id === actor.id;
        const manageable = canManage(u);
        return (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={!manageable}
              onClick={() =>
                setModal({
                  mode: "edit",
                  user: {
                    id: u.id,
                    nome: u.nome,
                    email: u.email,
                    role: u.role,
                    status: u.status,
                    companyId: u.companyId,
                  },
                })
              }
            >
              Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!manageable || isSelf || busyId === u.id}
              onClick={() => handleToggleStatus(u)}
            >
              {u.status === "ATIVO" ? "Desativar" : "Ativar"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={!manageable || isSelf}
              onClick={() => setDeleteTarget(u)}
            >
              Eliminar
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Pesquisar por nome ou email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 w-full sm:max-w-72"
        />
        <Button
          className="w-full sm:w-auto"
          onClick={() => setModal({ mode: "create" })}
        >
          <UserPlus />
          Novo utilizador
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(u) => u.id}
        initialSort={{ key: "createdAt", dir: "desc" }}
        emptyMessage="Nenhum utilizador encontrado."
      />

      {modal ? (
        <UserFormModal
          mode={modal.mode}
          user={modal.mode === "edit" ? modal.user : undefined}
          actorRole={actor.role}
          companies={companies}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            router.refresh();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar utilizador"
        message={
          deleteTarget
            ? `Tem a certeza que pretende eliminar ${deleteTarget.nome}? Esta ação não pode ser anulada.`
            : ""
        }
        isLoading={busyId === deleteTarget?.id}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
