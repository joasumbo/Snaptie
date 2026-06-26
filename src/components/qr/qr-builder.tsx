"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Plus,
  Copy,
  Download,
  ExternalLink,
  Palette,
} from "lucide-react";
import type { BlockType } from "@prisma/client";
import { BLOCK_TYPE_LABELS } from "@/lib/qr";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { QrPage, type QrPageData } from "./qr-page";
import { QrFormModal, type EditableQr } from "./qr-form-modal";
import { BlockFormModal, type EditableBlock } from "./block-form-modal";
import { PageSettingsModal, type PageSettings } from "./page-settings-modal";
import {
  deleteBlock,
  moveBlock,
  setQrPublished,
} from "@/app/dashboard/qr-codes/actions";

type BuilderBlock = EditableBlock & { ordem: number };

type Qr = {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  corPrimaria: string | null;
  corSecundaria: string | null;
  logo: string | null;
  imagemCapa: string | null;
  logoTamanho: string;
  logoForma: string;
  nomeTamanho: string;
  mostrarLogo: boolean;
  mostrarNome: boolean;
  edicaoPublica: boolean;
  temPin: boolean;
  publicado: boolean;
};

type Company = { nome: string; logo: string | null; corPrimaria: string | null };

function summary(b: BuilderBlock): string {
  const c = b.conteudo;
  const s = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
  if (b.tipo === "TEXTO") return s("texto");
  if (b.tipo === "WHATSAPP" || b.tipo === "TELEFONE") return s("numero");
  if (b.tipo === "EMAIL") return s("email");
  if (b.tipo === "WIFI") return s("ssid");
  if (b.tipo === "CARROSSEL")
    return `${Array.isArray(c.imagens) ? (c.imagens as unknown[]).length : 0} imagens`;
  return s("url");
}

export default function QrBuilder({
  qr,
  company,
  blocks,
  publicUrl,
}: {
  qr: Qr;
  company: Company;
  blocks: BuilderBlock[];
  publicUrl: string;
}) {
  const router = useRouter();
  const [editingQr, setEditingQr] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [blockModal, setBlockModal] = useState<
    { mode: "create" } | { mode: "edit"; block: EditableBlock } | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<BuilderBlock | null>(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const qrColor = qr.corPrimaria || "#0f172a";

  const previewData: QrPageData = {
    nome: qr.nome,
    descricao: qr.descricao,
    logo: qr.logo ?? company.logo,
    imagemCapa: qr.imagemCapa,
    logoTamanho: qr.logoTamanho,
    logoForma: qr.logoForma,
    nomeTamanho: qr.nomeTamanho,
    mostrarLogo: qr.mostrarLogo,
    mostrarNome: qr.mostrarNome,
    corPrimaria: qr.corPrimaria ?? company.corPrimaria,
    companyNome: company.nome,
    blocks: blocks
      .filter((b) => b.ativo)
      .map((b) => ({
        id: b.id,
        tipo: b.tipo,
        titulo: b.titulo,
        cor: b.cor,
        descricao: b.descricao,
        conteudo: b.conteudo,
      })),
  };

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

  function downloadQr() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${qr.slug}.png`;
    link.click();
  }

  const editableQr: EditableQr = {
    id: qr.id,
    nome: qr.nome,
    descricao: qr.descricao,
    corPrimaria: qr.corPrimaria,
    corSecundaria: qr.corSecundaria,
  };
  const pageSettings: PageSettings = { ...qr };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{qr.nome}</h1>
          <StatusBadge tone={qr.publicado ? "success" : "neutral"}>
            {qr.publicado ? "Publicado" : "Rascunho"}
          </StatusBadge>
        </div>
        <div className="flex flex-wrap gap-2 sm:shrink-0">
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/dashboard/qr-codes" />}>
            <ArrowLeft />
            Voltar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditingQr(true)}>
            Editar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Palette />
            Personalizar
          </Button>
          <Button size="sm" onClick={handlePublish} disabled={busy}>
            {qr.publicado ? "Despublicar" : "Publicar"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Elementos</h2>
            <Button size="sm" onClick={() => setBlockModal({ mode: "create" })}>
              <Plus />
              Adicionar elemento
            </Button>
          </div>

          {blocks.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Ainda não há elementos. Adicione o primeiro.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {blocks.map((block, i) => (
                <Card key={block.id} className="transition-all hover:shadow-md">
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
                        {summary(block) || "—"}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setBlockModal({ mode: "edit", block })}
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

        <div className="space-y-4">
          {/* Live preview */}
          <div>
            <h2 className="mb-2 font-medium">Pré-visualização</h2>
            <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-[2rem] border-4 border-foreground/80 bg-white shadow-xl">
              <div className="max-h-[560px] overflow-y-auto">
                <QrPage data={previewData} />
              </div>
            </div>
          </div>

          <Card className="h-fit">
            <CardContent className="space-y-3">
              <h2 className="font-medium">Código QR</h2>
              <div className="flex justify-center rounded-xl bg-white p-4 ring-1 ring-foreground/10">
                <QRCodeCanvas
                  ref={canvasRef}
                  value={publicUrl}
                  size={150}
                  fgColor={qrColor}
                  level="M"
                  marginSize={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1 text-xs">
                  {publicUrl}
                </code>
                <Button variant="outline" size="icon-sm" onClick={copyLink}>
                  <Copy />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={downloadQr}>
                  <Download />
                  Descarregar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<a href={publicUrl} target="_blank" rel="noreferrer" />}
                >
                  <ExternalLink />
                  Abrir
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {editingQr ? (
        <QrFormModal
          qr={editableQr}
          onClose={() => setEditingQr(false)}
          onSaved={() => setEditingQr(false)}
        />
      ) : null}

      {settingsOpen ? (
        <PageSettingsModal
          qr={pageSettings}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => setSettingsOpen(false)}
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
        title="Eliminar elemento"
        message={deleteTarget ? `Eliminar "${deleteTarget.titulo}"?` : ""}
        isLoading={busy}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
