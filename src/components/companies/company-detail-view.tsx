"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button, { LinkButton } from "@atlaskit/button/new";
import Lozenge from "@atlaskit/lozenge";
import type { CompanyStatus } from "@prisma/client";
import {
  COMPANY_STATUS_LABELS,
  COMPANY_STATUS_APPEARANCE,
  PLANO_LABELS,
} from "@/lib/companies";
import { formatDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CompanyFormModal, type EditableCompany } from "./company-form-modal";
import {
  deleteCompany,
  setCompanyStatus,
} from "@/app/dashboard/companies/actions";

type Company = EditableCompany & {
  slug: string;
  estado: CompanyStatus;
  createdAt: string;
};

type Props = {
  company: Company;
  indicators: { users: number; qrCodes: number; scans: number };
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--ds-text-subtle)",
};

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={{ marginTop: 2 }}>{value || "—"}</div>
    </div>
  );
}

function Indicator({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <div style={{ color: "var(--ds-text-subtle)", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 600, marginTop: 4 }}>{value}</div>
    </Card>
  );
}

function Swatch({ label, color }: { label: string; color: string | null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          border: "1px solid var(--ds-border)",
          backgroundColor: color ?? "transparent",
        }}
      />
      <span>{color ?? "—"}</span>
    </div>
  );
}

export default function CompanyDetailView({ company, indicators }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleToggleStatus() {
    setBusy(true);
    const next: CompanyStatus = company.estado === "ATIVA" ? "SUSPENSA" : "ATIVA";
    await setCompanyStatus(company.id, next);
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
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
            {company.nome}
          </h1>
          <Lozenge appearance={COMPANY_STATUS_APPEARANCE[company.estado]}>
            {COMPANY_STATUS_LABELS[company.estado]}
          </Lozenge>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <LinkButton href="/dashboard/companies" appearance="subtle">
            Voltar
          </LinkButton>
          <Button onClick={() => setEditing(true)}>Editar</Button>
          <Button onClick={handleToggleStatus} isDisabled={busy}>
            {company.estado === "ATIVA" ? "Suspender" : "Ativar"}
          </Button>
          <Button appearance="warning" onClick={() => setConfirmDelete(true)}>
            Eliminar
          </Button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        <Indicator label="Utilizadores" value={indicators.users} />
        <Indicator label="QR Codes" value={indicators.qrCodes} />
        <Indicator label="Scans" value={indicators.scans} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        <Card>
          <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>
            Dados gerais
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Detail label="Email" value={company.email} />
            <Detail label="Telefone" value={company.telefone} />
            <Detail
              label="Website"
              value={
                company.website ? (
                  <a href={company.website} target="_blank" rel="noreferrer">
                    {company.website}
                  </a>
                ) : null
              }
            />
            <Detail label="Identificador" value={company.slug} />
            <Detail label="Plano" value={PLANO_LABELS[company.plano]} />
            <Detail label="Criada em" value={formatDate(company.createdAt)} />
          </div>
        </Card>

        <Card>
          <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>
            Identidade visual
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Detail
              label="Logótipo"
              value={
                company.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={company.logo}
                    alt={`Logótipo de ${company.nome}`}
                    style={{ maxHeight: 48, maxWidth: 160, objectFit: "contain" }}
                  />
                ) : null
              }
            />
            <Detail
              label="Cor primária"
              value={<Swatch label="primaria" color={company.corPrimaria} />}
            />
            <Detail
              label="Cor secundária"
              value={<Swatch label="secundaria" color={company.corSecundaria} />}
            />
          </div>
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
