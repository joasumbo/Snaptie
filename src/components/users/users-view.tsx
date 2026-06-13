"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DynamicTable from "@atlaskit/dynamic-table";
import Textfield from "@atlaskit/textfield";
import Button from "@atlaskit/button/new";
import Lozenge from "@atlaskit/lozenge";
import PersonAddIcon from "@atlaskit/icon/core/person-add";
import type { UserRole, UserStatus } from "@prisma/client";
import {
  ROLE_LABELS,
  STATUS_LABELS,
  STATUS_APPEARANCE,
} from "@/lib/roles";
import { formatDate, formatDateTime } from "@/lib/format";
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
};

type Props = {
  users: UserRow[];
  actor: { id: string; role: UserRole };
};

export default function UsersView({ users, actor }: Props) {
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

  function canManage(u: UserRow): boolean {
    if (actor.role === "ADMIN") return true;
    return u.role !== "ADMIN";
  }

  async function handleToggleStatus(u: UserRow) {
    setBusyId(u.id);
    const next: UserStatus = u.status === "ATIVO" ? "INATIVO" : "ATIVO";
    await setUserStatus(u.id, next);
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

  const head = {
    cells: [
      { key: "nome", content: "Nome", isSortable: true },
      { key: "email", content: "Email", isSortable: true },
      { key: "role", content: "Função", isSortable: true },
      { key: "status", content: "Estado", isSortable: true },
      { key: "ultimoLogin", content: "Último login", isSortable: true },
      { key: "createdAt", content: "Criado", isSortable: true },
      { key: "actions", content: "", isSortable: false, width: 18 },
    ],
  };

  const rows = filtered.map((u) => {
    const isSelf = u.id === actor.id;
    const manageable = canManage(u);
    return {
      key: u.id,
      cells: [
        { key: u.nome, content: u.nome },
        { key: u.email, content: u.email },
        { key: u.role, content: <Lozenge>{ROLE_LABELS[u.role]}</Lozenge> },
        {
          key: u.status,
          content: (
            <Lozenge appearance={STATUS_APPEARANCE[u.status]}>
              {STATUS_LABELS[u.status]}
            </Lozenge>
          ),
        },
        { key: u.ultimoLogin ?? "", content: formatDateTime(u.ultimoLogin) },
        { key: u.createdAt, content: formatDate(u.createdAt) },
        {
          key: "actions",
          content: (
            <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
              <Button
                appearance="subtle"
                spacing="compact"
                isDisabled={!manageable}
                onClick={() =>
                  setModal({
                    mode: "edit",
                    user: {
                      id: u.id,
                      nome: u.nome,
                      email: u.email,
                      role: u.role,
                      status: u.status,
                    },
                  })
                }
              >
                Editar
              </Button>
              <Button
                appearance="subtle"
                spacing="compact"
                isDisabled={!manageable || isSelf || busyId === u.id}
                onClick={() => handleToggleStatus(u)}
              >
                {u.status === "ATIVO" ? "Desativar" : "Ativar"}
              </Button>
              <Button
                appearance="subtle"
                spacing="compact"
                isDisabled={!manageable || isSelf}
                onClick={() => setDeleteTarget(u)}
              >
                Eliminar
              </Button>
            </div>
          ),
        },
      ],
    };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ maxWidth: 280, width: "100%" }}>
          <Textfield
            placeholder="Pesquisar por nome ou email"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        </div>
        <Button
          appearance="primary"
          iconBefore={() => <PersonAddIcon label="" color="currentColor" />}
          onClick={() => setModal({ mode: "create" })}
        >
          Novo utilizador
        </Button>
      </div>

      <DynamicTable
        head={head}
        rows={rows}
        rowsPerPage={10}
        defaultPage={1}
        defaultSortKey="createdAt"
        defaultSortOrder="DESC"
        emptyView={
          <div style={{ padding: 24, color: "var(--ds-text-subtle)" }}>
            Nenhum utilizador encontrado.
          </div>
        }
      />

      {modal ? (
        <UserFormModal
          mode={modal.mode}
          user={modal.mode === "edit" ? modal.user : undefined}
          actorRole={actor.role}
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
