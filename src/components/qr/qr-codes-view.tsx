"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { QrFormModal, type EditableQr } from "./qr-form-modal";
import { deleteQrCode, setQrPublished } from "@/app/dashboard/qr-codes/actions";

export type QrRow = EditableQr & {
  publicado: boolean;
  blockCount: number;
  scansTotal: number;
  createdAt: string;
  companyNome: string | null;
};

export default function QrCodesView({
  qrs,
  companies,
  isAdmin,
}: {
  qrs: QrRow[];
  companies: { id: string; nome: string }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<
    { mode: "create" } | { mode: "edit"; qr: EditableQr } | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<QrRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return qrs;
    return qrs.filter((r) => r.nome.toLowerCase().includes(q));
  }, [qrs, query]);

  async function handleTogglePublished(r: QrRow) {
    setBusyId(r.id);
    await setQrPublished(r.id, !r.publicado);
    setBusyId(null);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    await deleteQrCode(deleteTarget.id);
    setBusyId(null);
    setDeleteTarget(null);
    router.refresh();
  }

  const columns: Column<QrRow>[] = [
    {
      key: "nome",
      header: "Nome",
      sortable: true,
      sortValue: (r) => r.nome.toLowerCase(),
      cell: (r) => (
        <Link
          href={`/dashboard/qr-codes/${r.id}`}
          className="font-medium hover:underline"
        >
          {r.nome}
        </Link>
      ),
    },
    ...(isAdmin
      ? [
          {
            key: "company",
            header: "Empresa",
            sortable: true,
            sortValue: (r: QrRow) => r.companyNome ?? "",
            cell: (r: QrRow) => (
              <span className="text-muted-foreground">{r.companyNome ?? "—"}</span>
            ),
          },
        ]
      : []),
    {
      key: "estado",
      header: "Estado",
      sortable: true,
      sortValue: (r) => (r.publicado ? 1 : 0),
      cell: (r) => (
        <StatusBadge tone={r.publicado ? "success" : "neutral"}>
          {r.publicado ? "Publicado" : "Rascunho"}
        </StatusBadge>
      ),
    },
    {
      key: "blocks",
      header: "Botões",
      alignRight: true,
      sortable: true,
      sortValue: (r) => r.blockCount,
      cell: (r) => r.blockCount,
    },
    {
      key: "scans",
      header: "Scans",
      alignRight: true,
      sortable: true,
      sortValue: (r) => r.scansTotal,
      cell: (r) => r.scansTotal,
    },
    {
      key: "createdAt",
      header: "Criado",
      sortable: true,
      sortValue: (r) => r.createdAt,
      cell: (r) => (
        <span className="text-muted-foreground">{formatDate(r.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      alignRight: true,
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/dashboard/qr-codes/${r.id}`} />}>
            Abrir
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busyId === r.id}
            onClick={() => handleTogglePublished(r)}
          >
            {r.publicado ? "Despublicar" : "Publicar"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget(r)}
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
          placeholder="Pesquisar por nome"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 max-w-72"
        />
        <Button onClick={() => setModal({ mode: "create" })}>
          <Plus />
          Novo QR
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(r) => r.id}
        initialSort={{ key: "createdAt", dir: "desc" }}
        emptyMessage="Nenhum QR encontrado."
      />

      {modal ? (
        <QrFormModal
          qr={modal.mode === "edit" ? modal.qr : undefined}
          companies={isAdmin ? companies : undefined}
          onClose={() => setModal(null)}
          onSaved={() => setModal(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar QR"
        message={
          deleteTarget
            ? `Tem a certeza que pretende eliminar ${deleteTarget.nome}? Os botões associados também serão removidos.`
            : ""
        }
        isLoading={busyId === deleteTarget?.id}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
