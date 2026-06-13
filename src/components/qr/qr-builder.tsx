"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Plus,
  Copy,
  ExternalLink,
} from "lucide-react";
import type { BlockType } from "@prisma/client";
import { BLOCK_TYPE_LABELS } from "@/lib/qr";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { QrFormModal, type EditableQr } from "./qr-form-modal";
import { BlockFormModal, type EditableBlock } from "./block-form-modal";
import {
  deleteBlock,
  moveBlock,
  setQrPublished,
} from "@/app/dashboard/qr-codes/actions";

type BuilderBlock = EditableBlock & { ordem: number };

type Qr = EditableQr & { slug: string; publicado: boolean };

export default function QrBuilder({
  qr,
  blocks,
  publicUrl,
}: {
  qr: Qr;
  blocks: BuilderBlock[];
  publicUrl: string;
}) {
  const router = useRouter();
  const [editingQr, setEditingQr] = useState(false);
  const [blockModal, setBlockModal] = useState<
    { mode: "create" } | { mode: "edit"; block: EditableBlock } | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<BuilderBlock | null>(null);
  const [busy, setBusy] = useState(false);

  async function handlePublish() {
    setBusy(true);
    await setQrPublished(qr.id, !qr.publicado);
    setBusy(false);
    router.refresh();
  }

  async function handleMove(id: string, direction: "up" | "down") {
    setBusy(true);
    await moveBlock(id, direction);
    setBusy(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    await deleteBlock(deleteTarget.id);
    setBusy(false);
    setDeleteTarget(null);
    router.refresh();
  }

  function copyLink() {
    navigator.clipboard.writeText(publicUrl).then(
      () => toast.success("Ligação copiada."),
      () => toast.error("Não foi possível copiar."),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{qr.nome}</h1>
          <StatusBadge tone={qr.publicado ? "success" : "neutral"}>
            {qr.publicado ? "Publicado" : "Rascunho"}
          </StatusBadge>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" render={<Link href="/dashboard/qr-codes" />}>
            <ArrowLeft />
            Voltar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditingQr(true)}>
            Editar
          </Button>
          <Button size="sm" onClick={handlePublish} disabled={busy}>
            {qr.publicado ? "Despublicar" : "Publicar"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Botões</h2>
            <Button size="sm" onClick={() => setBlockModal({ mode: "create" })}>
              <Plus />
              Adicionar botão
            </Button>
          </div>

          {blocks.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Ainda não há botões. Adicione o primeiro.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {blocks.map((block, i) => (
                <Card key={block.id}>
                  <CardContent className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        disabled={busy || i === 0}
                        onClick={() => handleMove(block.id, "up")}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        disabled={busy || i === blocks.length - 1}
                        onClick={() => handleMove(block.id, "down")}
                      >
                        <ArrowDown />
                      </Button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{block.titulo}</span>
                        <Badge variant="secondary">
                          {BLOCK_TYPE_LABELS[block.tipo]}
                        </Badge>
                        {!block.ativo ? (
                          <StatusBadge tone="neutral">Inativo</StatusBadge>
                        ) : null}
                      </div>
                      <div className="truncate text-sm text-muted-foreground">
                        {block.conteudo || "—"}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setBlockModal({ mode: "edit", block })
                        }
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(block)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card className="h-fit">
          <CardContent className="space-y-4">
            <h2 className="font-medium">Página pública</h2>
            <div className="flex justify-center rounded-lg bg-white p-4">
              <QRCodeSVG value={publicUrl} size={180} />
            </div>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1 text-xs">
                {publicUrl}
              </code>
              <Button variant="outline" size="icon-sm" onClick={copyLink}>
                <Copy />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              render={<a href={publicUrl} target="_blank" rel="noreferrer" />}
            >
              <ExternalLink />
              Abrir página
            </Button>
            {!qr.publicado ? (
              <p className="text-xs text-muted-foreground">
                O QR só fica acessível ao público depois de publicado.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {editingQr ? (
        <QrFormModal
          qr={{
            id: qr.id,
            nome: qr.nome,
            descricao: qr.descricao,
            corPrimaria: qr.corPrimaria,
            corSecundaria: qr.corSecundaria,
          }}
          onClose={() => setEditingQr(false)}
          onSaved={() => setEditingQr(false)}
        />
      ) : null}

      {blockModal ? (
        <BlockFormModal
          qrId={qr.id}
          block={blockModal.mode === "edit" ? blockModal.block : undefined}
          onClose={() => setBlockModal(null)}
          onSaved={() => setBlockModal(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar botão"
        message={
          deleteTarget
            ? `Eliminar o botão "${deleteTarget.titulo}"?`
            : ""
        }
        isLoading={busy}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
