"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DynamicTable from "@atlaskit/dynamic-table";
import Textfield from "@atlaskit/textfield";
import Button, { LinkButton } from "@atlaskit/button/new";
import Lozenge from "@atlaskit/lozenge";
import OfficeBuildingIcon from "@atlaskit/icon/core/office-building";
import type { CompanyStatus, Plano } from "@prisma/client";
import {
  COMPANY_STATUS_LABELS,
  COMPANY_STATUS_APPEARANCE,
  PLANO_LABELS,
} from "@/lib/companies";
import { formatDate } from "@/lib/format";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  CompanyFormModal,
  type EditableCompany,
} from "./company-form-modal";
import {
  deleteCompany,
  setCompanyStatus,
} from "@/app/dashboard/companies/actions";

export type CompanyRow = EditableCompany & {
  estado: CompanyStatus;
  userCount: number;
  qrCount: number;
  createdAt: string;
};

export default function CompaniesView({ companies }: { companies: CompanyRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<
    { mode: "create" } | { mode: "edit"; company: EditableCompany } | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanyRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
    );
  }, [companies, query]);

  async function handleToggleStatus(c: CompanyRow) {
    setBusyId(c.id);
    const next: CompanyStatus = c.estado === "ATIVA" ? "SUSPENSA" : "ATIVA";
    await setCompanyStatus(c.id, next);
    setBusyId(null);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    await deleteCompany(deleteTarget.id);
    setBusyId(null);
    setDeleteTarget(null);
    router.refresh();
  }

  const head = {
    cells: [
      { key: "nome", content: "Nome", isSortable: true },
      { key: "email", content: "Email", isSortable: true },
      { key: "estado", content: "Estado", isSortable: true },
      { key: "plano", content: "Plano", isSortable: true },
      { key: "users", content: "Utilizadores", isSortable: true },
      { key: "qr", content: "QR Codes", isSortable: true },
      { key: "createdAt", content: "Criado", isSortable: true },
      { key: "actions", content: "", isSortable: false },
    ],
  };

  const rows = filtered.map((c) => ({
    key: c.id,
    cells: [
      { key: c.nome, content: c.nome },
      { key: c.email, content: c.email },
      {
        key: c.estado,
        content: (
          <Lozenge appearance={COMPANY_STATUS_APPEARANCE[c.estado]}>
            {COMPANY_STATUS_LABELS[c.estado]}
          </Lozenge>
        ),
      },
      { key: c.plano, content: PLANO_LABELS[c.plano as Plano] },
      { key: c.userCount, content: c.userCount },
      { key: c.qrCount, content: c.qrCount },
      { key: c.createdAt, content: formatDate(c.createdAt) },
      {
        key: "actions",
        content: (
          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
            <LinkButton
              href={`/dashboard/companies/${c.id}`}
              appearance="subtle"
              spacing="compact"
            >
              Ver
            </LinkButton>
            <Button
              appearance="subtle"
              spacing="compact"
              onClick={() =>
                setModal({
                  mode: "edit",
                  company: {
                    id: c.id,
                    nome: c.nome,
                    email: c.email,
                    telefone: c.telefone,
                    website: c.website,
                    logo: c.logo,
                    corPrimaria: c.corPrimaria,
                    corSecundaria: c.corSecundaria,
                    plano: c.plano,
                  },
                })
              }
            >
              Editar
            </Button>
            <Button
              appearance="subtle"
              spacing="compact"
              isDisabled={busyId === c.id}
              onClick={() => handleToggleStatus(c)}
            >
              {c.estado === "ATIVA" ? "Suspender" : "Ativar"}
            </Button>
            <Button
              appearance="subtle"
              spacing="compact"
              onClick={() => setDeleteTarget(c)}
            >
              Eliminar
            </Button>
          </div>
        ),
      },
    ],
  }));

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
          iconBefore={() => <OfficeBuildingIcon label="" color="currentColor" />}
          onClick={() => setModal({ mode: "create" })}
        >
          Nova empresa
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
            Nenhuma empresa encontrada.
          </div>
        }
      />

      {modal ? (
        <CompanyFormModal
          company={modal.mode === "edit" ? modal.company : undefined}
          onClose={() => setModal(null)}
          onSaved={() => setModal(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar empresa"
        message={
          deleteTarget
            ? `Tem a certeza que pretende eliminar ${deleteTarget.nome}? A empresa deixa de estar acessível.`
            : ""
        }
        isLoading={busyId === deleteTarget?.id}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
