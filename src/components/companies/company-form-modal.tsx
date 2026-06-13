"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal, {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
} from "@atlaskit/modal-dialog";
import Textfield from "@atlaskit/textfield";
import Select from "@atlaskit/select";
import Button from "@atlaskit/button/new";
import type { Plano } from "@prisma/client";
import { PLANO_OPTIONS } from "@/lib/companies";
import { createCompany, updateCompany } from "@/app/dashboard/companies/actions";

type Option = { label: string; value: Plano };

export type EditableCompany = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  website: string | null;
  logo: string | null;
  corPrimaria: string | null;
  corSecundaria: string | null;
  plano: Plano;
};

type Props = {
  company?: EditableCompany;
  onClose: () => void;
  onSaved: () => void;
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--ds-text-subtle)",
  marginBottom: 4,
};

function Labeled({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor={htmlFor} style={labelStyle}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ flex: 1 }}>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          style={{
            width: 40,
            height: 36,
            padding: 2,
            border: "1px solid var(--ds-border)",
            borderRadius: 6,
            background: "var(--ds-surface)",
            cursor: "pointer",
          }}
        />
        <div style={{ flex: 1 }}>
          <Textfield
            value={value}
            onChange={(e) => onChange(e.currentTarget.value)}
          />
        </div>
      </div>
    </div>
  );
}

export function CompanyFormModal({ company, onClose, onSaved }: Props) {
  const router = useRouter();
  const isEdit = Boolean(company);

  const [nome, setNome] = useState(company?.nome ?? "");
  const [email, setEmail] = useState(company?.email ?? "");
  const [telefone, setTelefone] = useState(company?.telefone ?? "");
  const [website, setWebsite] = useState(company?.website ?? "");
  const [logo, setLogo] = useState(company?.logo ?? "");
  const [corPrimaria, setCorPrimaria] = useState(company?.corPrimaria ?? "#0052cc");
  const [corSecundaria, setCorSecundaria] = useState(
    company?.corSecundaria ?? "#172b4d",
  );
  const [plano, setPlano] = useState<Plano>(company?.plano ?? "FREE");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    const payload = {
      nome,
      email,
      telefone,
      website,
      logo,
      corPrimaria,
      corSecundaria,
      plano,
    };
    const result = isEdit
      ? await updateCompany({ ...payload, id: company!.id })
      : await createCompany(payload);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved();
    router.refresh();
  }

  return (
    <ModalTransition>
      <Modal onClose={submitting ? () => {} : onClose}>
        <ModalHeader>
          <ModalTitle>{isEdit ? "Editar empresa" : "Nova empresa"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          {error ? (
            <div
              role="alert"
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 4,
                backgroundColor: "var(--ds-background-danger)",
                color: "var(--ds-text-danger)",
                fontSize: 14,
              }}
            >
              {error}
            </div>
          ) : null}

          <Labeled label="Nome da empresa" htmlFor="c-nome">
            <Textfield
              id="c-nome"
              value={nome}
              onChange={(e) => setNome(e.currentTarget.value)}
            />
          </Labeled>

          <Labeled label="Email principal" htmlFor="c-email">
            <Textfield
              id="c-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />
          </Labeled>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Labeled label="Telefone" htmlFor="c-telefone">
                <Textfield
                  id="c-telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.currentTarget.value)}
                />
              </Labeled>
            </div>
            <div style={{ flex: 1 }}>
              <Labeled label="Website" htmlFor="c-website">
                <Textfield
                  id="c-website"
                  placeholder="https://"
                  value={website}
                  onChange={(e) => setWebsite(e.currentTarget.value)}
                />
              </Labeled>
            </div>
          </div>

          <Labeled label="Logótipo (URL)" htmlFor="c-logo">
            <Textfield
              id="c-logo"
              placeholder="https://"
              value={logo}
              onChange={(e) => setLogo(e.currentTarget.value)}
            />
          </Labeled>

          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <ColorField
              label="Cor primária"
              value={corPrimaria}
              onChange={setCorPrimaria}
            />
            <ColorField
              label="Cor secundária"
              value={corSecundaria}
              onChange={setCorSecundaria}
            />
          </div>

          <Labeled label="Plano" htmlFor="c-plano">
            <Select<Option>
              inputId="c-plano"
              options={PLANO_OPTIONS}
              value={PLANO_OPTIONS.find((o) => o.value === plano) ?? null}
              onChange={(opt) => opt && setPlano(opt.value)}
            />
          </Labeled>
        </ModalBody>
        <ModalFooter>
          <Button appearance="subtle" onClick={onClose} isDisabled={submitting}>
            Cancelar
          </Button>
          <Button appearance="primary" onClick={handleSubmit} isLoading={submitting}>
            {isEdit ? "Guardar" : "Criar"}
          </Button>
        </ModalFooter>
      </Modal>
    </ModalTransition>
  );
}
