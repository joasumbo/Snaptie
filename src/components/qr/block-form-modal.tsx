"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, Upload, FileText, Film } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { uploadFile } from "@/lib/upload-client";
import type { UploadKind } from "@/lib/storage";
import {
  ACTION_TYPES,
  CONTENT_TYPES,
  BLOCK_TYPE_LABELS,
  TYPE_FIELD,
  isContentBlock,
  BUTTON_SHAPES,
  BUTTON_WIDTH,
  buttonShape,
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
  editavelPublico: boolean;
};

type Props = {
  qrId: string;
  block?: EditableBlock;
  onClose: () => void;
  // On edit, receives the updated fields so the list can refresh instantly.
  onSaved: (updated?: Partial<EditableBlock> & { id: string }) => void;
};

const ACCEPT: Record<UploadKind, string> = {
  image: "image/*",
  video: "video/*",
  pdf: "application/pdf",
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

// File chosen locally but not yet uploaded — keeps a preview URL for display.
type Pending = { file: File; preview: string };

export function BlockFormModal({ qrId, block, onClose, onSaved }: Props) {
  const router = useRouter();
  const isEdit = Boolean(block);
  const fileInput = useRef<HTMLInputElement>(null);

  const [tipo, setTipo] = useState<BlockType | null>(block?.tipo ?? null);
  const [titulo, setTitulo] = useState(block?.titulo ?? "");
  const [cor, setCor] = useState(block?.cor ?? "");
  const [descricao, setDescricao] = useState(block?.descricao ?? "");
  const [ativo, setAtivo] = useState(block?.ativo ?? true);
  const [editavelPublico, setEditavelPublico] = useState(
    block?.editavelPublico ?? false,
  );

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
  // As ações do bloco de registo, uma por linha — é a forma mais direta de
  // editar uma lista curta sem inventar um construtor.
  const [acoes, setAcoes] = useState<string>(
    Array.isArray(c.acoes) ? (c.acoes as string[]).join("\n") : "",
  );
  // O botão com imagem guarda a imagem à parte do link: `url` é para onde leva,
  // `imagem` é o que se vê.
  const [imagem, setImagem] = useState(str(c, "imagem"));
  const [forma, setForma] = useState<string>(buttonShape(c.forma));
  const [tamanho, setTamanho] = useState<string>(
    BUTTON_WIDTH[String(c.tamanho)] ? String(c.tamanho) : "5",
  );

  // Files picked but not yet uploaded. Only sent to R2 on submit.
  const [single, setSingle] = useState<Pending | null>(null);
  const [novas, setNovas] = useState<Pending[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = tipo ? TYPE_FIELD[tipo] : null;
  const singleKind: UploadKind | null =
    field === "imagem" || field === "botaoImagem"
      ? "image"
      : field === "video"
        ? "video"
        : field === "pdf"
          ? "pdf"
          : null;
  // No botão com imagem o ficheiro carregado é a imagem de fundo, não o `url` —
  // esse fica reservado para o destino do link.
  const ficheiroEmImagem = field === "botaoImagem";

  function pickSingle(file: File) {
    setSingle({ file, preview: URL.createObjectURL(file) });
  }
  function clearSingle() {
    if (single) URL.revokeObjectURL(single.preview);
    setSingle(null);
    // also drops a previously saved file (on edit)
    if (ficheiroEmImagem) setImagem("");
    else setUrl("");
  }
  function addCarouselFiles(files: FileList) {
    const next = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setNovas((arr) => [...arr, ...next]);
  }
  function removeNova(i: number) {
    setNovas((arr) => {
      const target = arr[i];
      if (target) URL.revokeObjectURL(target.preview);
      return arr.filter((_, j) => j !== i);
    });
  }

  async function handleSubmit() {
    if (!tipo) return;
    setError(null);
    setSubmitting(true);
    try {
      let conteudo: Record<string, unknown>;
      switch (field) {
        case "url":
          conteudo = { url };
          break;
        case "texto":
        case "titulo":
          conteudo = { texto };
          break;
        case "telefone":
          conteudo = { numero };
          break;
        case "email":
          conteudo = { email };
          break;
        case "whatsapp":
          conteudo = { numero, mensagem };
          break;
        case "wifi":
          conteudo = { ssid, password };
          break;
        case "imagem":
        case "video":
        case "pdf": {
          // Upload the picked file now (only on confirm); keep the existing one otherwise.
          const finalUrl = single ? await uploadFile(single.file, singleKind!) : url;
          conteudo = { url: finalUrl };
          break;
        }
        case "carrossel": {
          const uploaded: string[] = [];
          for (const p of novas) uploaded.push(await uploadFile(p.file, "image"));
          conteudo = { imagens: [...imagens, ...uploaded], orientacao };
          break;
        }
        case "botaoImagem": {
          const finalImagem = single ? await uploadFile(single.file, "image") : imagem;
          conteudo = { imagem: finalImagem, url, forma, tamanho };
          break;
        }
        case "registo":
          conteudo = {
            acoes: acoes
              .split("\n")
              .map((a) => a.trim())
              .filter(Boolean),
          };
          break;
        default:
          conteudo = {};
      }

      const payload = {
        titulo,
        cor: isContentBlock(tipo) ? null : cor,
        descricao: isContentBlock(tipo) ? null : descricao,
        conteudo,
        editavelPublico,
      };
      const result = isEdit
        ? await updateBlock({ id: block!.id, ativo, ...payload })
        : await addBlock({ qrId, tipo, ...payload });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onSaved(
        isEdit
          ? {
              id: block!.id,
              titulo,
              cor: payload.cor,
              descricao: payload.descricao,
              conteudo,
              ativo,
              editavelPublico,
            }
          : undefined,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocorreu um erro. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  const singlePreview =
    single?.preview ?? ((ficheiroEmImagem ? imagem : url) || null);

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
            {/* The wall is a content element, but it is the one the owner names. */}
            {!isContentBlock(tipo) || tipo === "FEED" ? (
              <Field label="Título">
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              </Field>
            ) : null}

            {field === "mural" ? (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                São os visitantes que escrevem aqui: cada um deixa o nome e uma
                mensagem, e as mais recentes aparecem primeiro. Pode apagar
                qualquer mensagem a partir desta página.
              </p>
            ) : null}

            {field === "registo" ? (
              <Field label="Ações (uma por linha)">
                <textarea
                  value={acoes}
                  onChange={(e) => setAcoes(e.target.value)}
                  rows={5}
                  placeholder={"Entrou no transporte\nSaiu do transporte\nEntrou na escola\nSaiu da escola"}
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <p className="text-xs text-muted-foreground">
                  Cada linha vira um botão. O visitante toca e fica registado
                  com a data e a hora — não escreve texto.
                </p>
              </Field>
            ) : null}

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

            {field === "titulo" ? (
              <Field label="Título">
                <Input
                  placeholder="Escreva o título"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
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

            {/* Single file: image, video or pdf — preview only, uploaded on save */}
            {singleKind ? (
              <Field
                label={
                  tipo === "LOGO"
                    ? "Logótipo"
                    : field === "botaoImagem"
                      ? "Imagem de fundo"
                      : field === "imagem"
                        ? "Imagem"
                        : field === "video"
                          ? "Vídeo"
                          : "Ficheiro PDF"
                }
              >
                {singlePreview ? (
                  <div className="flex items-center gap-3 rounded-lg border p-2">
                    {singleKind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={singlePreview}
                        alt=""
                        className="size-14 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex size-14 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        {field === "video" ? (
                          <Film className="size-5" />
                        ) : (
                          <FileText className="size-5" />
                        )}
                      </div>
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                      {single ? single.file.name : "Ficheiro carregado"}
                    </span>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={clearSingle}>
                      <X />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInput.current?.click()}
                  >
                    <Upload />
                    Carregar ficheiro
                  </Button>
                )}
                <input
                  ref={fileInput}
                  type="file"
                  accept={ACCEPT[singleKind]}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) pickSingle(f);
                    e.target.value = "";
                  }}
                />
              </Field>
            ) : null}

            {field === "botaoImagem" ? (
              <>
                <Field label="Link de destino">
                  <Input
                    placeholder="https://"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe vazio para a imagem aparecer sem levar a lado nenhum.
                  </p>
                </Field>

                <Field label="Texto por cima (opcional)">
                  <Input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Sem texto, mostra só a imagem"
                  />
                </Field>

                <Field label="Forma">
                  <div className="grid grid-cols-2 gap-2">
                    {BUTTON_SHAPES.map((f) => (
                      <button
                        key={f.valor}
                        type="button"
                        onClick={() => setForma(f.valor)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm transition-colors",
                          forma === f.valor
                            ? "border-foreground bg-foreground text-background"
                            : "hover:bg-muted",
                        )}
                      >
                        {f.nome}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Tamanho">
                  <div className="inline-flex rounded-lg border p-0.5">
                    {Object.keys(BUTTON_WIDTH).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setTamanho(n)}
                        className={cn(
                          "w-10 rounded-md py-1 text-sm transition-colors",
                          tamanho === n
                            ? "bg-foreground text-background"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    1 é o mais pequeno, 5 ocupa a largura toda. Abaixo de 5 o
                    botão fica centrado na página.
                  </p>
                </Field>
              </>
            ) : null}

            {field === "carrossel" ? (
              <Field label="Imagens">
                <div className="space-y-2">
                  {imagens.length > 0 || novas.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {imagens.map((src, i) => (
                        <div key={`u${i}`} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="" className="size-16 rounded-md object-cover" />
                          <button
                            type="button"
                            onClick={() => setImagens((arr) => arr.filter((_, j) => j !== i))}
                            className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                      {novas.map((p, i) => (
                        <div key={`n${i}`} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.preview}
                            alt=""
                            className="size-16 rounded-md object-cover ring-2 ring-primary/40"
                          />
                          <button
                            type="button"
                            onClick={() => removeNova(i)}
                            className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInput.current?.click()}
                  >
                    <Upload />
                    Carregar ficheiro
                  </Button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) addCarouselFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-sm text-muted-foreground">
                      Formato das imagens:
                    </span>
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

            <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                checked={editavelPublico}
                onChange={(e) => setEditavelPublico(e.target.checked)}
                className="size-4"
              />
              <span>
                Permitir edição pelo visitante
                <span className="block text-xs text-muted-foreground">
                  O visitante (com código) pode alterar este elemento na página pública.
                </span>
              </span>
            </label>

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
