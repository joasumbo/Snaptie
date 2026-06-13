"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import type { CompanyStatus, Plano } from "@prisma/client";
import {
  COMPANY_STATUS_LABELS,
  COMPANY_STATUS_TONE,
  PLANO_LABELS,
} from "@/lib/companies";
import { formatDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CompanyFormModal, type EditableCompany } from "./company-form-modal";
import { deleteCompany, setCompanyStatus } from "@/app/dashboard/companies/actions";

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
    await setCompanyStatus(c.id, c.estado === "ATIVA" ? "SUSPENSA" : "ATIVA");
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

  const columns: Column<CompanyRow>[] = [
    {
      key: "nome",
      header: "Nome",
      sortable: true,
      sortValue: (c) => c.nome.toLowerCase(),
      cell: (c) => (
        <Link
          href={`/dashboard/companies/${c.id}`}
          className="font-medium hover:underline"
        >
          {c.nome}
        </Link>
      ),
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
      sortValue: (c) => c.email.toLowerCase(),
      cell: (c) => <span className="text-muted-foreground">{c.email}</span>,
    },
    {
      key: "estado",
      header: "Estado",
      sortable: true,
      sortValue: (c) => c.estado,
      cell: (c) => (
        <StatusBadge tone={COMPANY_STATUS_TONE[c.estado]}>
          {COMPANY_STATUS_LABELS[c.estado]}
        </StatusBadge>
      ),
    },
    {
      key: "plano",
      header: "Plano",
      sortable: true,
      sortValue: (c) => c.plano,
      cell: (c) => PLANO_LABELS[c.plano as Plano],
    },
    {
      key: "users",
      header: "Utilizadores",
      alignRight: true,
      sortable: true,
      sortValue: (c) => c.userCount,
      cell: (c) => c.userCount,
    },
    {
      key: "qr",
      header: "QR Codes",
      alignRight: true,
      sortable: true,
      sortValue: (c) => c.qrCount,
      cell: (c) => c.qrCount,
    },
    {
      key: "createdAt",
      header: "Criado",
      sortable: true,
      sortValue: (c) => c.createdAt,
      cell: (c) => (
        <span className="text-muted-foreground">{formatDate(c.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      alignRight: true,
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/dashboard/companies/${c.id}`} />}>
            Ver
          </Button>
          <Button
            variant="ghost"
            size="sm"
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
            variant="ghost"
            size="sm"
            disabled={busyId === c.id}
            onClick={() => handleToggleStatus(c)}
          >
            {c.estado === "ATIVA" ? "Suspender" : "Ativar"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget(c)}
          >
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Pesquisar por nome ou email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 max-w-72"
        />
        <Button onClick={() => setModal({ mode: "create" })}>
          <Building2 />
          Nova empresa
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(c) => c.id}
        initialSort={{ key: "createdAt", dir: "desc" }}
        emptyMessage="Nenhuma empresa encontrada."
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
