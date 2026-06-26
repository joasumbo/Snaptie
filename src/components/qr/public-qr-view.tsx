"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Loader2, X } from "lucide-react";
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
import { FileUpload } from "@/components/ui/file-upload";
import { TYPE_FIELD, BLOCK_TYPE_LABELS } from "@/lib/qr";
import { QrPage, type QrPageData } from "./qr-page";
import {
  verifyEditPin,
  saveBlockContent,
  requestPublicUpload,
} from "@/app/s/[slug]/edit-actions";
import type { UploadKind } from "@/lib/storage";

type EditBlock = {
  id: string;
  tipo: BlockType;
  titulo: string;
  conteudo: Record<string, unknown>;
};

function str(c: Record<string, unknown>, k: string): string {
  return typeof c[k] === "string" ? (c[k] as string) : "";
}

export default function PublicQrView({
  data,
  slug,
  edicaoPublica,
}: {
  data: QrPageData;
  slug: string;
  edicaoPublica: boolean;
}) {
  const router = useRouter();
  const [pinOpen, setPinOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [authPin, setAuthPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [edits, setEdits] = useState<EditBlock[]>([]);
  const [saving, setSaving] = useState(false);

  async function checkPin() {
    setChecking(true);
    setPinError(null);
    const r = await verifyEditPin(slug, pin);
    setChecking(false);
    if (!r.ok) {
      setPinError("Código inválido.");
      return;
    }
    setAuthPin(pin);
    setEdits(
      data.blocks.map((b) => ({
        id: b.id,
        tipo: b.tipo,
        titulo: b.titulo,
        conteudo: { ...b.conteudo },
      })),
    );
    setPinOpen(false);
    setPanelOpen(true);
  }

  function setField(id: string, key: string, value: unknown) {
    setEdits((arr) =>
      arr.map((b) =>
        b.id === id ? { ...b, conteudo: { ...b.conteudo, [key]: value } } : b,
      ),
    );
  }
  function setTitulo(id: string, value: string) {
    setEdits((arr) => arr.map((b) => (b.id === id ? { ...b, titulo: value } : b)));
  }

  async function saveAll() {
    setSaving(true);
    for (const b of edits) {
      const r = await saveBlockContent({
        slug,
        pin: authPin,
        blockId: b.id,
        titulo: b.titulo,
        conteudo: b.conteudo,
      });
      if (!r.ok) {
        toast.error(r.message);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    toast.success("Alterações guardadas.");
    setPanelOpen(false);
    router.refresh();
  }

  const uploaderFor =
    (kind: UploadKind) =>
    (input: { kind: UploadKind; contentType: string; size: number }) =>
      requestPublicUpload({ ...input, kind, slug, pin: authPin });

  return (
    <div className="min-h-screen">
      <QrPage data={data} />

      {edicaoPublica ? (
        <div className="pb-10 text-center">
          <Button
            variant="outline"
            onClick={() => {
              setPin("");
              setPinError(null);
              setPinOpen(true);
            }}
          >
            <Pencil />
            Editar conteúdo
          </Button>
        </div>
      ) : null}

      <Dialog open={pinOpen} onOpenChange={(o) => !o && setPinOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar conteúdo</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="edit-pin">Código de edição</Label>
            <Input
              id="edit-pin"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
            {pinError ? (
              <p className="text-sm text-destructive">{pinError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={checkPin} disabled={checking}>
              {checking ? <Loader2 className="animate-spin" /> : null}
              Entrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={panelOpen}
        onOpenChange={(o) => !o && !saving && setPanelOpen(false)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar conteúdo</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {edits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem elementos.</p>
            ) : (
              edits.map((b) => (
                <div key={b.id} className="space-y-2 rounded-lg border p-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {BLOCK_TYPE_LABELS[b.tipo]}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Título</Label>
                    <Input
                      value={b.titulo}
                      onChange={(e) => setTitulo(b.id, e.target.value)}
                    />
                  </div>
                  <BlockFields
                    block={b}
                    setField={setField}
                    uploaderFor={uploaderFor}
                  />
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPanelOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={saveAll} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BlockFields({
  block,
  setField,
  uploaderFor,
}: {
  block: EditBlock;
  setField: (id: string, key: string, value: unknown) => void;
  uploaderFor: (
    kind: UploadKind,
  ) => (input: {
    kind: UploadKind;
    contentType: string;
    size: number;
  }) => Promise<
    { ok: true; uploadUrl: string; publicUrl: string } | { ok: false; message: string }
  >;
}) {
  const field = TYPE_FIELD[block.tipo];
  const c = block.conteudo;
  const id = block.id;

  if (field === "texto") {
    return (
      <div className="space-y-1.5">
        <Label>Texto</Label>
        <textarea
          rows={3}
          value={str(c, "texto")}
          onChange={(e) => setField(id, "texto", e.target.value)}
          className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
    );
  }
  if (field === "url") {
    return (
      <div className="space-y-1.5">
        <Label>{block.tipo === "MAPA" ? "Link do Google Maps" : "URL"}</Label>
        <Input
          placeholder="https://"
          value={str(c, "url")}
          onChange={(e) => setField(id, "url", e.target.value)}
        />
      </div>
    );
  }
  if (field === "telefone" || field === "whatsapp") {
    return (
      <>
        <div className="space-y-1.5">
          <Label>Número</Label>
          <Input
            value={str(c, "numero")}
            onChange={(e) => setField(id, "numero", e.target.value)}
          />
        </div>
        {field === "whatsapp" ? (
          <div className="space-y-1.5">
            <Label>Mensagem</Label>
            <Input
              value={str(c, "mensagem")}
              onChange={(e) => setField(id, "mensagem", e.target.value)}
            />
          </div>
        ) : null}
      </>
    );
  }
  if (field === "email") {
    return (
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input
          type="email"
          value={str(c, "email")}
          onChange={(e) => setField(id, "email", e.target.value)}
        />
      </div>
    );
  }
  if (field === "wifi") {
    return (
      <>
        <div className="space-y-1.5">
          <Label>Rede (SSID)</Label>
          <Input
            value={str(c, "ssid")}
            onChange={(e) => setField(id, "ssid", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Palavra-passe</Label>
          <Input
            value={str(c, "password")}
            onChange={(e) => setField(id, "password", e.target.value)}
          />
        </div>
      </>
    );
  }
  if (field === "imagem" || field === "video" || field === "pdf") {
    const kind: UploadKind =
      field === "imagem" ? "image" : field === "video" ? "video" : "pdf";
    return (
      <div className="space-y-1.5">
        <Label>Ficheiro</Label>
        <FileUpload
          kind={kind}
          value={str(c, "url") || null}
          onChange={(v) => setField(id, "url", v ?? "")}
          uploader={uploaderFor(kind)}
        />
      </div>
    );
  }
  if (field === "carrossel") {
    const imgs = Array.isArray(c.imagens) ? (c.imagens as string[]) : [];
    return (
      <div className="space-y-2">
        <Label>Imagens</Label>
        {imgs.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {imgs.map((src, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="size-16 rounded-md object-cover" />
                <button
                  type="button"
                  onClick={() =>
                    setField(
                      id,
                      "imagens",
                      imgs.filter((_, j) => j !== i),
                    )
                  }
                  className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <FileUpload
          kind="image"
          value={null}
          onChange={(v) => {
            if (v) setField(id, "imagens", [...imgs, v]);
          }}
          uploader={uploaderFor("image")}
        />
      </div>
    );
  }
  return null;
}
