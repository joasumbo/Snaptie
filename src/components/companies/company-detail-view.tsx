"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, QrCode, ScanLine } from "lucide-react";
import type { CompanyStatus } from "@prisma/client";
import {
  COMPANY_STATUS_LABELS,
  COMPANY_STATUS_TONE,
  PLANO_LABELS,
} from "@/lib/companies";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Reveal } from "@/components/ui/reveal";
import { CompanyFormModal, type EditableCompany } from "./company-form-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteCompany, setCompanyStatus } from "@/app/dashboard/companies/actions";

type Company = EditableCompany & {
  slug: string;
  estado: CompanyStatus;
  createdAt: string;
};

const INDICATORS = [
  { key: "users", label: "Utilizadores", icon: Users },
  { key: "qrCodes", label: "QR Codes", icon: QrCode },
  { key: "scans", label: "Scans", icon: ScanLine },
] as const;

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value || "—"}</div>
    </div>
  );
}

function Swatch({ color }: { color: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="size-5 rounded-md border"
        style={{ backgroundColor: color ?? "transparent" }}
      />
      <span>{color ?? "—"}</span>
    </div>
  );
}

export default function CompanyDetailView({
  company,
  indicators,
}: {
  company: Company;
  indicators: { users: number; qrCodes: number; scans: number };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleToggleStatus() {
    setBusy(true);
    await setCompanyStatus(
      company.id,
      company.estado === "ATIVA" ? "SUSPENSA" : "ATIVA",
    );
    setBusy(false);
    router.refresh();
  }

  async function handleDelete() {
    setBusy(true);
    await deleteCompany(company.id);
    setBusy(false);
    setConfirmDelete(false);
    router.push("/dashboard/companies");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{company.nome}</h1>
          <StatusBadge tone={COMPANY_STATUS_TONE[company.estado]}>
            {COMPANY_STATUS_LABELS[company.estado]}
          </StatusBadge>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/dashboard/companies" />}>
            <ArrowLeft />
            Voltar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
            disabled={busy}
          >
            {company.estado === "ATIVA" ? "Suspender" : "Ativar"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmDelete(true)}
          >
            Eliminar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {INDICATORS.map(({ key, label, icon: Icon }, i) => (
          <Reveal key={key} delay={i * 0.06}>
            <Card>
              <CardContent className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{label}</div>
                  <div className="mt-1 text-3xl font-semibold">
                    {indicators[key]}
                  </div>
                </div>
                <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="size-5" />
                </span>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-3">
            <h2 className="font-medium">Dados gerais</h2>
            <Detail label="Email" value={company.email} />
            <Detail label="Telefone" value={company.telefone} />
            <Detail
              label="Website"
              value={
                company.website ? (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {company.website}
                  </a>
                ) : null
              }
            />
            <Detail label="Identificador" value={company.slug} />
            <Detail label="Plano" value={PLANO_LABELS[company.plano]} />
            <Detail label="Criada em" value={formatDate(company.createdAt)} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <h2 className="font-medium">Identidade visual</h2>
            <Detail
              label="Logótipo"
              value={
                company.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={company.logo}
                    alt={`Logótipo de ${company.nome}`}
                    className="max-h-12 max-w-40 object-contain"
                  />
                ) : null
              }
            />
            <Detail label="Cor primária" value={<Swatch color={company.corPrimaria} />} />
            <Detail
              label="Cor secundária"
              value={<Swatch color={company.corSecundaria} />}
            />
          </CardContent>
        </Card>
      </div>

      {editing ? (
        <CompanyFormModal
          company={{
            id: company.id,
            nome: company.nome,
            email: company.email,
            telefone: company.telefone,
            website: company.website,
            logo: company.logo,
            corPrimaria: company.corPrimaria,
            corSecundaria: company.corSecundaria,
            plano: company.plano,
          }}
          onClose={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar empresa"
        message={`Tem a certeza que pretende eliminar ${company.nome}? A empresa deixa de estar acessível.`}
        isLoading={busy}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
