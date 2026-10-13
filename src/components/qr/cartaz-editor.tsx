"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Download,
  FileArchive,
  ImagePlus,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { uploadFile } from "@/lib/upload-client";
import { saveCartaz } from "@/app/dashboard/qr-codes/actions";
import {
  CartazView,
  FORMATOS,
  cartazInicial,
  novoElemento,
  type Alinhamento,
  type Cartaz,
  type ElementoCartaz,
  type FormatoId,
  type TipoElemento,
  type VariaveisCartaz,
} from "@/lib/cartaz";

const NOMES: Record<TipoElemento, string> = {
  texto: "Texto",
  imagem: "Imagem",
  linha: "Linha",
  qr: "QR code",
  espaco: "Espaço",
};

const ALINHAR: { label: string; value: Alinhamento }[] = [
  { label: "Esq.", value: "left" },
  { label: "Centro", value: "center" },
  { label: "Dir.", value: "right" },
];

// Mede a proporção real de uma imagem, para o cartaz não a esticar.
function medirProporcao(src: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth / Math.max(1, img.naturalHeight) || 1);
    img.onerror = () => resolve(1);
    img.src = src;
  });
}

// Descarrega por fetch, e não por um link direto: se o servidor recusar (uma
// imagem em formato que não imprime, por exemplo) mostra-se a razão em vez de
// abrir uma página com o erro em bruto.
async function descarregar(url: string, nomePadrao: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const erro = await res.json().catch(() => null);
    throw new Error(erro?.error ?? "Não foi possível gerar o ficheiro.");
  }
  const disp = res.headers.get("content-disposition") ?? "";
  const nome = /filename="([^"]+)"/.exec(disp)?.[1] ?? nomePadrao;
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

export default function CartazEditor({
  qr,
  inicial,
  cor,
  logo,
  variaveis,
  totalLote,
  totalEmpresa,
}: {
  qr: { id: string; nome: string; lote: string | null; companyId: string };
  inicial: Cartaz;
  cor: string;
  logo: string | null;
  variaveis: VariaveisCartaz;
  totalLote: number;
  totalEmpresa: number;
}) {
  const [cartaz, setCartaz] = useState<Cartaz>(inicial);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [qrSrc, setQrSrc] = useState("");
  const [ocupado, setOcupado] = useState<null | "guardar" | "png" | "zip" | "aplicar">(null);
  const [alterado, setAlterado] = useState(false);
  const [aplicarA, setAplicarA] = useState<null | "lote" | "empresa">(null);
  const [repor, setRepor] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(360);

  useEffect(() => {
    QRCode.toDataURL(variaveis.link, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 600,
      color: { dark: cor, light: "#ffffff" },
    }).then(setQrSrc);
  }, [variaveis.link, cor]);

  // A pré-visualização ocupa a largura da coluna, para se ver com detalhe.
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.min(520, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // As imagens que vêm do modelo inicial (o logótipo da empresa) entram com
  // proporção 1; mede-se a verdadeira assim que o editor abre.
  useEffect(() => {
    cartaz.elementos.forEach((e) => {
      if (e.tipo === "imagem" && e.src && e.proporcao === 1) {
        medirProporcao(e.src).then((p) => {
          if (Math.abs(p - 1) > 0.01) atualizarElemento(e.id, { proporcao: p }, false);
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function mudar(parcial: Partial<Cartaz>) {
    setCartaz((c) => ({ ...c, ...parcial }));
    setAlterado(true);
  }
  function atualizarElemento(id: string, parcial: Partial<ElementoCartaz>, marcar = true) {
    setCartaz((c) => ({
      ...c,
      elementos: c.elementos.map((e) => (e.id === id ? ({ ...e, ...parcial } as ElementoCartaz) : e)),
    }));
    if (marcar) setAlterado(true);
  }
  function mover(id: string, delta: number) {
    setCartaz((c) => {
      const i = c.elementos.findIndex((e) => e.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= c.elementos.length) return c;
      const lista = [...c.elementos];
      [lista[i], lista[j]] = [lista[j], lista[i]];
      return { ...c, elementos: lista };
    });
    setAlterado(true);
  }
  function remover(id: string) {
    setCartaz((c) => ({ ...c, elementos: c.elementos.filter((e) => e.id !== id) }));
    setAlterado(true);
  }
  function adicionar(tipo: TipoElemento | "titulo") {
    const e =
      tipo === "titulo"
        ? { ...novoElemento("texto", cor), texto: "Título", tamanho: 90, peso: 800 as const, maiusculas: true }
        : novoElemento(tipo, cor);
    setCartaz((c) => ({ ...c, elementos: [...c.elementos, e] }));
    setAbertoId(e.id);
    setAlterado(true);
  }

  async function guardar(aplicar?: "lote" | "empresa"): Promise<boolean> {
    const r = await saveCartaz({ qrId: qr.id, cartaz, aplicarA: aplicar });
    if (!r.ok) {
      toast.error(r.message);
      return false;
    }
    setAlterado(false);
    return true;
  }

  async function acao(tipo: "guardar" | "png" | "zip", fn: () => Promise<void>) {
    if (ocupado) return;
    setOcupado(tipo);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Algo correu mal.");
    } finally {
      setOcupado(null);
    }
  }

  const exportarUrl = qr.lote
    ? `/api/qr/export?format=cartazes&lote=${qr.lote}&modelo=${qr.id}`
    : `/api/qr/export?format=cartazes&company=${qr.companyId}&modelo=${qr.id}`;
  const totalExportar = qr.lote ? totalLote : totalEmpresa;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/dashboard/qr-codes/${qr.id}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {qr.nome}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Cartaz para imprimir</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={ocupado !== null}
            onClick={() =>
              acao("guardar", async () => {
                if (await guardar()) toast.success("Cartaz guardado.");
              })
            }
          >
            {ocupado === "guardar" ? <Loader2 className="animate-spin" /> : <Save />}
            {alterado ? "Guardar" : "Guardado"}
          </Button>
          <Button
            disabled={ocupado !== null}
            onClick={() =>
              acao("png", async () => {
                if (alterado && !(await guardar())) return;
                await descarregar(`/api/qr/${qr.id}/cartaz`, "cartaz.png");
              })
            }
          >
            {ocupado === "png" ? <Loader2 className="animate-spin" /> : <Download />}
            Descarregar PNG
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        {/* Controlos */}
        <div className="order-2 space-y-4 lg:order-1">
          <Card>
            <CardContent className="space-y-4">
              <h2 className="font-medium">Papel</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo label="Tamanho">
                  <select
                    value={cartaz.formato}
                    onChange={(e) => mudar({ formato: e.target.value as FormatoId })}
                    className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm"
                  >
                    {(Object.keys(FORMATOS) as FormatoId[]).map((f) => (
                      <option key={f} value={f}>
                        {FORMATOS[f].nome}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Fundo">
                  <Cor valor={cartaz.fundo} onChange={(fundo) => mudar({ fundo })} />
                </Campo>
                {cartaz.formato === "personalizado" ? (
                  <>
                    <Campo label="Largura (mm)">
                      <Numero valor={cartaz.larguraMm} min={30} max={600} onChange={(larguraMm) => mudar({ larguraMm })} />
                    </Campo>
                    <Campo label="Altura (mm)">
                      <Numero valor={cartaz.alturaMm} min={30} max={900} onChange={(alturaMm) => mudar({ alturaMm })} />
                    </Campo>
                  </>
                ) : null}
                <Campo label="Margem interior">
                  <Numero valor={cartaz.margem} min={0} max={300} onChange={(margem) => mudar({ margem })} />
                </Campo>
                <Campo label="Espaço entre elementos">
                  <Numero valor={cartaz.espacamento} min={0} max={200} onChange={(espacamento) => mudar({ espacamento })} />
                </Campo>
              </div>

              <div className="space-y-3 border-t pt-4">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={cartaz.borda.ativa}
                    onChange={(e) => mudar({ borda: { ...cartaz.borda, ativa: e.target.checked } })}
                    className="size-4"
                  />
                  Linha à volta
                </label>
                {cartaz.borda.ativa ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Campo label="Cor">
                      <Cor valor={cartaz.borda.cor} onChange={(c) => mudar({ borda: { ...cartaz.borda, cor: c } })} />
                    </Campo>
                    <Campo label="Espessura">
                      <Numero
                        valor={cartaz.borda.espessura}
                        min={1}
                        max={60}
                        onChange={(espessura) => mudar({ borda: { ...cartaz.borda, espessura } })}
                      />
                    </Campo>
                    <Campo label="Cantos redondos">
                      <Numero
                        valor={cartaz.borda.raio}
                        min={0}
                        max={300}
                        onChange={(raio) => mudar({ borda: { ...cartaz.borda, raio } })}
                      />
                    </Campo>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-medium">Elementos</h2>
                <Button variant="ghost" size="sm" onClick={() => setRepor(true)}>
                  <RotateCcw />
                  Recomeçar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Nos textos pode usar <code>{"{nome}"}</code> e <code>{"{empresa}"}</code>: em cada QR são trocados
                pelo nome dele, o que deixa usar o mesmo cartaz para várias lojas.
              </p>

              <div className="space-y-2">
                {cartaz.elementos.map((e, i) => (
                  <div key={e.id} className="rounded-lg border">
                    <div className="flex items-center gap-1 px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => setAbertoId(abertoId === e.id ? null : e.id)}
                        className="min-w-0 flex-1 truncate text-left text-sm"
                      >
                        <span className="font-medium">{NOMES[e.tipo]}</span>
                        <span className="ml-2 text-muted-foreground">{resumo(e)}</span>
                      </button>
                      <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => mover(e.id, -1)}>
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={i === cartaz.elementos.length - 1}
                        onClick={() => mover(e.id, 1)}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => remover(e.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    {abertoId === e.id ? (
                      <div className="border-t p-3">
                        <EditorElemento e={e} onChange={(p) => atualizarElemento(e.id, p)} />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-3">
                {(
                  [
                    ["titulo", "Título"],
                    ["texto", "Frase"],
                    ["imagem", "Imagem"],
                    ["linha", "Linha"],
                    ["qr", "QR code"],
                    ["espaco", "Espaço"],
                  ] as const
                ).map(([tipo, label]) => (
                  <Button key={tipo} variant="outline" size="sm" onClick={() => adicionar(tipo)}>
                    + {label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <h2 className="font-medium">Vários QRs</h2>
              <p className="text-sm text-muted-foreground">
                {qr.lote
                  ? `Este QR faz parte de um lote de ${totalLote}.`
                  : `A empresa tem ${totalEmpresa} QR codes.`}{" "}
                Pode usar este desenho em todos: cada cartaz sai com o seu próprio QR e o seu nome.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={ocupado !== null}
                  onClick={() =>
                    acao("zip", async () => {
                      if (alterado && !(await guardar())) return;
                      toast.info(`A gerar ${totalExportar} cartazes… pode demorar um pouco.`);
                      await descarregar(exportarUrl, "cartazes.zip");
                    })
                  }
                >
                  {ocupado === "zip" ? <Loader2 className="animate-spin" /> : <FileArchive />}
                  Descarregar {totalExportar} cartazes (ZIP)
                </Button>
                <Button
                  variant="ghost"
                  disabled={ocupado !== null}
                  onClick={() => setAplicarA(qr.lote ? "lote" : "empresa")}
                >
                  Guardar este desenho em todos
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pré-visualização */}
        <div className="order-1 lg:order-2">
          <div className="lg:sticky lg:top-4">
            <div ref={caixa} className="flex justify-center rounded-xl bg-muted/50 p-4">
              <div className="shadow-lg">
                {qrSrc ? (
                  <CartazView
                    cartaz={cartaz}
                    largura={largura}
                    qrSrc={qrSrc}
                    variaveis={variaveis}
                    fonte="var(--font-sans), sans-serif"
                  />
                ) : (
                  <div style={{ width: largura, height: largura * 1.4 }} className="bg-white" />
                )}
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              O PNG sai a 300 dpi, pronto para gráfica.
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={aplicarA !== null}
        title="Guardar em todos"
        message={`O desenho deste cartaz passa a ser usado nos ${
          aplicarA === "lote" ? totalLote : totalEmpresa
        } QR codes ${aplicarA === "lote" ? "do lote" : "da empresa"}, substituindo o que lá estiver.`}
        isLoading={ocupado === "aplicar"}
        onConfirm={async () => {
          if (!aplicarA) return;
          setOcupado("aplicar");
          const r = await saveCartaz({ qrId: qr.id, cartaz, aplicarA });
          setOcupado(null);
          setAplicarA(null);
          if (!r.ok) {
            toast.error(r.message);
            return;
          }
          setAlterado(false);
          toast.success(`Cartaz guardado neste QR e em mais ${r.aplicados ?? 0}.`);
        }}
        onClose={() => setAplicarA(null)}
      />

      <ConfirmDialog
        open={repor}
        title="Recomeçar"
        message="Volta ao modelo inicial. O desenho atual perde-se se não o tiver guardado."
        onConfirm={() => {
          setCartaz(cartazInicial({ cor, logo }));
          setAlterado(true);
          setRepor(false);
        }}
        onClose={() => setRepor(false)}
      />
    </div>
  );
}

function resumo(e: ElementoCartaz): string {
  switch (e.tipo) {
    case "texto":
      return e.texto.replace(/\s+/g, " ").slice(0, 40);
    case "imagem":
      return e.src ? "" : "sem imagem";
    case "espaco":
      return e.flexivel ? "empurra para o fundo" : "";
    default:
      return "";
  }
}

function EditorElemento({ e, onChange }: { e: ElementoCartaz; onChange: (p: Partial<ElementoCartaz>) => void }) {
  const ficheiro = useRef<HTMLInputElement>(null);
  const [aEnviar, setAEnviar] = useState(false);

  switch (e.tipo) {
    case "texto":
      return (
        <div className="space-y-3">
          <textarea
            rows={2}
            value={e.texto}
            onChange={(ev) => onChange({ texto: ev.target.value })}
            className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Tamanho da letra">
              <Numero valor={e.tamanho} min={10} max={300} onChange={(tamanho) => onChange({ tamanho })} />
            </Campo>
            <Campo label="Cor">
              <Cor valor={e.cor} onChange={(cor) => onChange({ cor })} />
            </Campo>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              value={String(e.peso) as "400" | "600" | "800"}
              onChange={(v) => onChange({ peso: Number(v) as 400 | 600 | 800 })}
              options={[
                { label: "Normal", value: "400" },
                { label: "Médio", value: "600" },
                { label: "Negrito", value: "800" },
              ]}
            />
            <Segmented value={e.alinhar} onChange={(alinhar) => onChange({ alinhar })} options={ALINHAR} />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={e.maiusculas}
                onChange={(ev) => onChange({ maiusculas: ev.target.checked })}
                className="size-4"
              />
              MAIÚSCULAS
            </label>
          </div>
        </div>
      );
    case "imagem":
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {e.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.src} alt="" className="h-14 max-w-32 rounded border object-contain" />
            ) : null}
            <Button variant="outline" size="sm" disabled={aEnviar} onClick={() => ficheiro.current?.click()}>
              {aEnviar ? <Loader2 className="animate-spin" /> : <ImagePlus />}
              {e.src ? "Trocar imagem" : "Escolher imagem"}
            </Button>
            <input
              ref={ficheiro}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={async (ev) => {
                const f = ev.target.files?.[0];
                ev.target.value = "";
                if (!f) return;
                setAEnviar(true);
                try {
                  const src = await uploadFile(f, "image");
                  onChange({ src, proporcao: await medirProporcao(src) });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Falha no envio.");
                } finally {
                  setAEnviar(false);
                }
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">PNG ou JPG. Um PNG com fundo transparente fica melhor.</p>
          <div className="flex flex-wrap items-end gap-3">
            <Campo label="Altura">
              <Numero valor={e.altura} min={20} max={1400} onChange={(altura) => onChange({ altura })} />
            </Campo>
            <Segmented value={e.alinhar} onChange={(alinhar) => onChange({ alinhar })} options={ALINHAR} />
          </div>
        </div>
      );
    case "linha":
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo label="Cor">
            <Cor valor={e.cor} onChange={(cor) => onChange({ cor })} />
          </Campo>
          <Campo label="Espessura">
            <Numero valor={e.espessura} min={1} max={40} onChange={(espessura) => onChange({ espessura })} />
          </Campo>
          <Campo label="Largura (%)">
            <Numero valor={e.largura} min={5} max={100} onChange={(largura) => onChange({ largura })} />
          </Campo>
        </div>
      );
    case "qr":
      return (
        <Campo label="Tamanho">
          <Numero valor={e.tamanho} min={120} max={1000} onChange={(tamanho) => onChange({ tamanho })} />
        </Campo>
      );
    case "espaco":
      return (
        <div className="flex flex-wrap items-end gap-4">
          <Campo label="Altura">
            <Numero valor={e.altura} min={0} max={800} onChange={(altura) => onChange({ altura })} />
          </Campo>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={e.flexivel}
              onChange={(ev) => onChange({ flexivel: ev.target.checked })}
              className="size-4"
            />
            Empurrar o que vem a seguir para o fundo
          </label>
        </div>
      );
  }
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Numero({
  valor,
  min,
  max,
  onChange,
}: {
  valor: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  // Guarda o que se escreve tal como está, e só passa o número quando é
  // válido: assim apagar o campo para escrever outro valor não o põe a zero.
  const [texto, setTexto] = useState(String(valor));
  useEffect(() => setTexto(String(valor)), [valor]);
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={texto}
      onChange={(ev) => {
        setTexto(ev.target.value);
        const n = Number(ev.target.value);
        if (ev.target.value !== "" && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
      }}
      className="h-9 w-28"
    />
  );
}

function Cor({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => setTexto(valor), [valor]);
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="size-9 cursor-pointer rounded-md border bg-transparent p-1"
      />
      <Input
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value);
        }}
        className="h-9 w-28 font-mono text-xs"
      />
    </div>
  );
}
