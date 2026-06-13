"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import type { Plano } from "@prisma/client";
import { PLANO_OPTIONS, PLANO_LABELS } from "@/lib/companies";
import { createCompany, updateCompany } from "@/app/dashboard/companies/actions";

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
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
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 cursor-pointer rounded-md border bg-transparent p-1"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </Field>
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
  const [corPrimaria, setCorPrimaria] = useState(company?.corPrimaria ?? "#6366f1");
  const [corSecundaria, setCorSecundaria] = useState(
    company?.corSecundaria ?? "#8b5cf6",
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
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !submitting) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar empresa" : "Nova empresa"}</DialogTitle>
        </DialogHeader>

        {error ? (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <Field label="Nome da empresa">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>
          <Field label="Email principal">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone">
              <Input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
            </Field>
            <Field label="Website">
              <Input
                placeholder="https://"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Logótipo (URL)">
            <Input
              placeholder="https://"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
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
          <Field label="Plano">
            <Select value={plano} onValueChange={(v) => setPlano(v as Plano)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string | null) =>
                    v ? PLANO_LABELS[v as Plano] : "Selecionar"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PLANO_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            {isEdit ? "Guardar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
