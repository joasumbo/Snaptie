"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { BlockType } from "@prisma/client";
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
import { BLOCK_TYPE_OPTIONS, BLOCK_TYPE_LABELS, isUrlBlock } from "@/lib/qr";
import { addBlock, updateBlock } from "@/app/dashboard/qr-codes/actions";

export type EditableBlock = {
  id: string;
  tipo: BlockType;
  titulo: string;
  conteudo: string;
  ativo: boolean;
};

type Props = {
  qrId: string;
  block?: EditableBlock;
  onClose: () => void;
  onSaved: () => void;
};

export function BlockFormModal({ qrId, block, onClose, onSaved }: Props) {
  const router = useRouter();
  const isEdit = Boolean(block);

  const [tipo, setTipo] = useState<BlockType>(block?.tipo ?? "LINK");
  const [titulo, setTitulo] = useState(block?.titulo ?? "");
  const [conteudo, setConteudo] = useState(block?.conteudo ?? "");
  const [ativo, setAtivo] = useState(block?.ativo ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urlBlock = isUrlBlock(tipo);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    const result = isEdit
      ? await updateBlock({ id: block!.id, titulo, conteudo, ativo })
      : await addBlock({ qrId, tipo, titulo, conteudo });
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
          <DialogTitle>{isEdit ? "Editar botão" : "Novo botão"}</DialogTitle>
        </DialogHeader>

        {error ? (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            {isEdit ? (
              <Input value={BLOCK_TYPE_LABELS[tipo]} disabled />
            ) : (
              <Select value={tipo} onValueChange={(v) => setTipo(v as BlockType)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string | null) =>
                      v ? BLOCK_TYPE_LABELS[v as BlockType] : "Selecionar"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {BLOCK_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>{urlBlock ? "URL" : "Texto"}</Label>
            {urlBlock ? (
              <Input
                placeholder="https://"
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
              />
            ) : (
              <textarea
                rows={3}
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            )}
          </div>

          {isEdit ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                className="size-4"
              />
              Ativo
            </label>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            {isEdit ? "Guardar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
