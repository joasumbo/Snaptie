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
import { createQrCode, updateQrCode } from "@/app/dashboard/qr-codes/actions";

export type EditableQr = {
  id: string;
  nome: string;
  descricao: string | null;
  corPrimaria: string | null;
  corSecundaria: string | null;
};

type Props = {
  qr?: EditableQr;
  companies?: { id: string; nome: string }[];
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

export function QrFormModal({ qr, companies, onClose, onSaved }: Props) {
  const router = useRouter();
  const isEdit = Boolean(qr);

  const [nome, setNome] = useState(qr?.nome ?? "");
  const [descricao, setDescricao] = useState(qr?.descricao ?? "");
  const [corPrimaria, setCorPrimaria] = useState(qr?.corPrimaria ?? "#6366f1");
  const [corSecundaria, setCorSecundaria] = useState(qr?.corSecundaria ?? "#0f172a");
  const [companyId, setCompanyId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsCompany = !isEdit && companies && companies.length > 0;

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    const result = isEdit
      ? await updateQrCode({ id: qr!.id, nome, descricao, corPrimaria, corSecundaria })
      : await createQrCode({
          nome,
          descricao,
          corPrimaria,
          corSecundaria,
          companyId: needsCompany ? companyId : undefined,
        });
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar QR" : "Novo QR"}</DialogTitle>
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
          <Field label="Descrição">
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </Field>
          {needsCompany ? (
            <Field label="Empresa">
              <Select value={companyId} onValueChange={(v) => setCompanyId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string | null) =>
                      companies!.find((c) => c.id === v)?.nome ?? "Selecionar"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {companies!.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cor primária">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={corPrimaria}
                  onChange={(e) => setCorPrimaria(e.target.value)}
                  className="size-9 cursor-pointer rounded-md border bg-transparent p-1"
                />
                <Input
                  value={corPrimaria}
                  onChange={(e) => setCorPrimaria(e.target.value)}
                />
              </div>
            </Field>
            <Field label="Cor secundária">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={corSecundaria}
                  onChange={(e) => setCorSecundaria(e.target.value)}
                  className="size-9 cursor-pointer rounded-md border bg-transparent p-1"
                />
                <Input
                  value={corSecundaria}
                  onChange={(e) => setCorSecundaria(e.target.value)}
                />
              </div>
            </Field>
          </div>
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
