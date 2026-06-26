"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  ACTION_TYPES,
  CONTENT_TYPES,
  BLOCK_TYPE_LABELS,
  TYPE_FIELD,
  isContentBlock,
} from "@/lib/qr";
import { addBlock, updateBlock } from "@/app/dashboard/qr-codes/actions";

export type EditableBlock = {
  id: string;
  tipo: BlockType;
  titulo: string;
  cor: string | null;
  descricao: string | null;
  conteudo: Record<string, unknown>;
  ativo: boolean;
};

type Props = {
  qrId: string;
  block?: EditableBlock;
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

function str(c: Record<string, unknown>, k: string): string {
  return typeof c[k] === "string" ? (c[k] as string) : "";
}

export function BlockFormModal({ qrId, block, onClose, onSaved }: Props) {
  const router = useRouter();
  const isEdit = Boolean(block);

  const [tipo, setTipo] = useState<BlockType | null>(block?.tipo ?? null);
  const [titulo, setTitulo] = useState(block?.titulo ?? "");
  const [cor, setCor] = useState(block?.cor ?? "");
  const [descricao, setDescricao] = useState(block?.descricao ?? "");
  const [ativo, setAtivo] = useState(block?.ativo ?? true);

  const c = block?.conteudo ?? {};
  const [url, setUrl] = useState(str(c, "url"));
  const [texto, setTexto] = useState(str(c, "texto"));
  const [numero, setNumero] = useState(str(c, "numero"));
  const [mensagem, setMensagem] = useState(str(c, "mensagem"));
  const [email, setEmail] = useState(str(c, "email"));
  const [ssid, setSsid] = useState(str(c, "ssid"));
  const [password, setPassword] = useState(str(c, "password"));
  const [imagens, setImagens] = useState<string[]>(
    Array.isArray(c.imagens) ? (c.imagens as string[]) : [],
  );
  const [orientacao, setOrientacao] = useState<string>(
    typeof c.orientacao === "string" ? (c.orientacao as string) : "vertical",
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = tipo ? TYPE_FIELD[tipo] : null;

  function buildConteudo(): Record<string, unknown> {
    switch (field) {
      case "url":
        return { url };
      case "texto":
        return { texto };
      case "telefone":
        return { numero };
      case "email":
        return { email };
      case "whatsapp":
        return { numero, mensagem };
      case "wifi":
        return { ssid, password };
      case "imagem":
      case "video":
      case "pdf":
        return { url };
      case "carrossel":
        return { imagens, orientacao };
      default:
        return {};
    }
  }

  async function handleSubmit() {
    if (!tipo) return;
    setError(null);
    setSubmitting(true);
    const payload = {
      titulo,
      cor: isContentBlock(tipo) ? null : cor,
      descricao: isContentBlock(tipo) ? null : descricao,
      conteudo: buildConteudo(),
    };
    const result = isEdit
      ? await updateBlock({ id: block!.id, ativo, ...payload })
      : await addBlock({ qrId, tipo, ...payload });
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
          <DialogTitle>
            {isEdit ? `Editar ${BLOCK_TYPE_LABELS[tipo!]}` : "Novo elemento"}
          </DialogTitle>
        </DialogHeader>

        {error ? (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {/* Type picker (create only) */}
        {!isEdit && !tipo ? (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ação
              </p>
              <div className="grid grid-cols-3 gap-2">
                {ACTION_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className="rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted"
                  >
                    {BLOCK_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Conteúdo
              </p>
              <div className="grid grid-cols-3 gap-2">
                {CONTENT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className="rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted"
                  >
                    {BLOCK_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* Fields (once a type is chosen) */}
        {tipo ? (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            <Field label="Título">
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </Field>

            {field === "url" ? (
              <Field label={tipo === "MAPA" ? "Link do Google Maps" : "URL"}>
                <Input
                  placeholder="https://"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </Field>
            ) : null}

            {field === "texto" ? (
              <Field label="Texto">
                <textarea
                  rows={3}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </Field>
            ) : null}

            {field === "telefone" ? (
              <Field label="Número de telefone">
                <Input
                  placeholder="+351 ..."
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                />
              </Field>
            ) : null}

            {field === "email" ? (
              <Field label="Email">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
            ) : null}

            {field === "whatsapp" ? (
              <>
                <Field label="Número (com indicativo)">
                  <Input
                    placeholder="351912345678"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                  />
                </Field>
                <Field label="Mensagem inicial (opcional)">
                  <Input
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                  />
                </Field>
              </>
            ) : null}

            {field === "wifi" ? (
              <>
                <Field label="Nome da rede (SSID)">
                  <Input value={ssid} onChange={(e) => setSsid(e.target.value)} />
                </Field>
                <Field label="Palavra-passe">
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
              </>
            ) : null}

            {field === "imagem" ? (
              <Field label="Imagem">
                <FileUpload
                  kind="image"
                  value={url || null}
                  onChange={(v) => setUrl(v ?? "")}
                />
              </Field>
            ) : null}

            {field === "video" ? (
              <Field label="Vídeo">
                <FileUpload
                  kind="video"
                  value={url || null}
                  onChange={(v) => setUrl(v ?? "")}
                />
              </Field>
            ) : null}

            {field === "pdf" ? (
              <Field label="Ficheiro PDF">
                <FileUpload
                  kind="pdf"
                  value={url || null}
                  onChange={(v) => setUrl(v ?? "")}
                />
              </Field>
            ) : null}

            {field === "carrossel" ? (
              <Field label="Imagens">
                <div className="space-y-2">
                  {imagens.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {imagens.map((src, i) => (
                        <div key={i} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src}
                            alt=""
                            className="size-16 rounded-md object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setImagens((arr) => arr.filter((_, j) => j !== i))
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
                      if (v) setImagens((arr) => [...arr, v]);
                    }}
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-sm text-muted-foreground">Orientação:</span>
                    <div className="inline-flex rounded-lg border p-0.5">
                      {[
                        { label: "Vertical", value: "vertical" },
                        { label: "Horizontal", value: "horizontal" },
                      ].map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setOrientacao(o.value)}
                          className={cn(
                            "rounded-md px-3 py-1 text-sm transition-colors",
                            orientacao === o.value
                              ? "bg-foreground text-background"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Field>
            ) : null}

            {/* Colour and description only apply to action elements */}
            {!isContentBlock(tipo) ? (
              <>
                <Field label="Cor (opcional)">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={cor || "#6366f1"}
                      onChange={(e) => setCor(e.target.value)}
                      className="size-9 cursor-pointer rounded-md border bg-transparent p-1"
                    />
                    <Input
                      placeholder="Cor primária do QR"
                      value={cor}
                      onChange={(e) => setCor(e.target.value)}
                    />
                    {cor ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setCor("")}
                      >
                        <X />
                      </Button>
                    ) : null}
                  </div>
                </Field>
                <Field label="Descrição (opcional)">
                  <Input
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                  />
                </Field>
              </>
            ) : null}

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
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !tipo}
            className={cn(!tipo && "hidden")}
          >
            {submitting ? <Loader2 className="animate-spin" /> : null}
            {isEdit ? "Guardar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
