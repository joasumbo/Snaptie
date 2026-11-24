"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Loader2, Package, Pencil, Plus, Trash2, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUpload } from "@/components/ui/file-upload";
import { euros } from "@/lib/pagamentos";
import { apagarProdutoEnvio, guardarProdutoEnvio, marcarEncomendaEnviada } from "@/app/dashboard/pagamentos/actions";

type Qr = { id: string; nome: string; empresa: string };

export type ProdutoAdmin = {
  id: string;
  nome: string;
  descricao: string | null;
  imagem: string | null;
  precoCentimos: number;
  portesCentimos: number;
  qrModeloId: string | null;
  stock: number | null;
  ativo: boolean;
  vendidos: number;
};

export type Encomenda = {
  id: string;
  produto: string;
  quantidade: number;
  valorCentimos: number;
  pagoEm: string | null;
  nome: string;
  email: string;
  telefone: string;
  morada: string;
  codigoPostal: string;
  cidade: string;
  estado: string;
  codigo: string | null;
  enviadoEm: string | null;
  qr: string | null;
  temQr: boolean;
};

type Rascunho = {
  id?: string;
  nome: string;
  descricao: string;
  imagem: string;
  preco: string;
  portes: string;
  qrModeloId: string;
  stock: string;
  ativo: boolean;
};

const VAZIO: Rascunho = { nome: "", descricao: "", imagem: "", preco: "", portes: "", qrModeloId: "", stock: "", ativo: true };

const numero = (s: string) => Number(s.replace(",", "."));
const data = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

// Produtos enviados por correio e as encomendas pagas, por enviar e enviadas.
export default function EnviosAdmin({ produtos, encomendas, qrs }: { produtos: ProdutoAdmin[]; encomendas: Encomenda[]; qrs: Qr[] }) {
  const router = useRouter();
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [filtroQr, setFiltroQr] = useState("");
  const [codigos, setCodigos] = useState<Record<string, string>>({});
  const [aGuardar, iniciar] = useTransition();

  const porEnviar = encomendas.filter((e) => e.estado !== "enviado");
  const enviadas = encomendas.filter((e) => e.estado === "enviado");
  const nomeQr = new Map(qrs.map((q) => [q.id, `${q.nome} · ${q.empresa}`]));
  const opcoesQr = useMemo(() => {
    const t = filtroQr.trim().toLowerCase();
    return qrs.filter((q) => !t || `${q.nome} ${q.empresa}`.toLowerCase().includes(t)).slice(0, 100);
  }, [filtroQr, qrs]);

  const mudar = (k: keyof Rascunho) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setRascunho((r) => (r ? { ...r, [k]: e.target.value } : r));

  function editar(p: ProdutoAdmin) {
    setRascunho({
      id: p.id,
      nome: p.nome,
      descricao: p.descricao ?? "",
      imagem: p.imagem ?? "",
      preco: (p.precoCentimos / 100).toFixed(2).replace(".", ","),
      portes: (p.portesCentimos / 100).toFixed(2).replace(".", ","),
      qrModeloId: p.qrModeloId ?? "",
      stock: p.stock == null ? "" : String(p.stock),
      ativo: p.ativo,
    });
  }

  function guardar() {
    if (!rascunho) return;
    iniciar(async () => {
      const r = await guardarProdutoEnvio({
        id: rascunho.id,
        nome: rascunho.nome,
        descricao: rascunho.descricao,
        imagem: rascunho.imagem,
        precoEuros: numero(rascunho.preco),
        portesEuros: rascunho.portes.trim() ? numero(rascunho.portes) : 0,
        qrModeloId: rascunho.qrModeloId,
        stock: rascunho.stock.trim() ? Number(rascunho.stock) : null,
        ativo: rascunho.ativo,
      });
      if (!r.ok) return void toast.error(r.message);
      toast.success(rascunho.id ? "Produto guardado." : "Produto criado. Já aparece na loja.");
      setRascunho(null);
      router.refresh();
    });
  }

  function apagar(p: ProdutoAdmin) {
    iniciar(async () => {
      const r = await apagarProdutoEnvio(p.id);
      if (!r.ok) return void toast.error(r.message);
      toast.success("Produto apagado.");
      router.refresh();
    });
  }

  function enviar(e: Encomenda) {
    iniciar(async () => {
      const r = await marcarEncomendaEnviada(e.id, codigos[e.id] ?? "");
      if (!r.ok) return void toast.error(r.message);
      toast.success(`Marcada como enviada. ${e.email ? "O cliente foi avisado por email." : ""}`);
      router.refresh();
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="size-5" /> Produtos por correio
            <Badge variant={produtos.some((p) => p.ativo) ? "default" : "secondary"}>
              {produtos.filter((p) => p.ativo).length ? `${produtos.filter((p) => p.ativo).length} à venda` : "Nada à venda"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Ímanes, porta-chaves e outros produtos vendidos em{" "}
            <a href="/loja" target="_blank" rel="noreferrer" className="text-indigo-600 underline-offset-4 hover:underline">
              mysnaptie.com/loja
            </a>{" "}
            e enviados pela Inpulse. Se o produto tiver um QR modelo, cada compra cria o QR do cliente, que lhe chega por email e que
            se imprime no produto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {produtos.length ? (
            <ul className="divide-y rounded-lg border">
              {produtos.map((p) => (
                <li key={p.id} className="flex items-center gap-3 p-3">
                  {p.imagem ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imagem} alt="" className="size-12 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Package className="size-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-medium">
                      <span className="truncate">{p.nome}</span>
                      {!p.ativo ? <Badge variant="secondary">Escondido</Badge> : null}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {euros(p.precoCentimos, "eur")} + {euros(p.portesCentimos, "eur")} de portes
                      {p.stock != null ? ` · stock ${p.stock}` : ""} · {p.vendidos} vendidos
                      {p.qrModeloId ? ` · QR: ${nomeQr.get(p.qrModeloId) ?? "modelo"}` : " · sem QR"}
                    </div>
                  </div>
                  <Button size="icon-sm" variant="ghost" aria-label="Editar" onClick={() => editar(p)}>
                    <Pencil />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Apagar" disabled={aGuardar} onClick={() => apagar(p)}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          {rascunho ? (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="font-medium">{rascunho.id ? "Editar produto" : "Produto novo"}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Nome</Label>
                  <Input value={rascunho.nome} onChange={mudar("nome")} placeholder="Íman com QR" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Descrição</Label>
                  <textarea
                    rows={2}
                    value={rascunho.descricao}
                    onChange={mudar("descricao")}
                    className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Preço (€)</Label>
                  <Input inputMode="decimal" value={rascunho.preco} onChange={mudar("preco")} placeholder="9,90" />
                </div>
                <div className="space-y-1.5">
                  <Label>Portes (€)</Label>
                  <Input inputMode="decimal" value={rascunho.portes} onChange={mudar("portes")} placeholder="0 = incluídos" />
                </div>
                <div className="space-y-1.5">
                  <Label>Stock</Label>
                  <Input inputMode="numeric" value={rascunho.stock} onChange={mudar("stock")} placeholder="Vazio = sem limite" />
                </div>
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={rascunho.ativo}
                    onChange={(e) => setRascunho((r) => (r ? { ...r, ativo: e.target.checked } : r))}
                    className="size-4"
                  />
                  À venda na loja
                </label>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Fotografia</Label>
                  <FileUpload kind="image" value={rascunho.imagem || null} onChange={(v) => setRascunho((r) => (r ? { ...r, imagem: v ?? "" } : r))} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>QR modelo (opcional)</Label>
                  <Input value={filtroQr} onChange={(e) => setFiltroQr(e.target.value)} placeholder="Procurar QR pelo nome ou empresa" />
                  <select
                    value={rascunho.qrModeloId}
                    onChange={mudar("qrModeloId")}
                    className="h-9 w-full rounded-lg border bg-transparent px-3 text-sm"
                  >
                    <option value="">Sem QR (só o produto)</option>
                    {rascunho.qrModeloId && !opcoesQr.some((q) => q.id === rascunho.qrModeloId) ? (
                      <option value={rascunho.qrModeloId}>{nomeQr.get(rascunho.qrModeloId) ?? "QR escolhido"}</option>
                    ) : null}
                    {opcoesQr.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.nome} · {q.empresa}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={guardar} disabled={aGuardar}>
                  {aGuardar ? <Loader2 className="animate-spin" /> : null}
                  Guardar
                </Button>
                <Button variant="outline" onClick={() => setRascunho(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setRascunho(VAZIO)}>
              <Plus /> Produto novo
            </Button>
          )}
        </CardContent>
      </Card>

      <Card id="encomendas">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="size-5" /> Encomendas
            <Badge variant={porEnviar.length ? "default" : "secondary"}>
              {porEnviar.length ? `${porEnviar.length} por enviar` : "Nada por enviar"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Encomendas pagas. Ao marcar como enviada, o cliente recebe um email com o código de seguimento dos CTT.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {encomendas.length === 0 ? <p className="text-sm text-muted-foreground">Ainda não há encomendas.</p> : null}
          {[...porEnviar, ...enviadas].map((e) => (
            <div key={e.id} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">
                  {e.produto}
                  {e.quantidade > 1 ? ` ×${e.quantidade}` : ""} · {euros(e.valorCentimos, "eur")}
                </div>
                {e.estado === "enviado" ? (
                  <Badge variant="secondary">Enviada {data(e.enviadoEm)}</Badge>
                ) : (
                  <Badge>Por enviar · pago {data(e.pagoEm)}</Badge>
                )}
              </div>
              <div className="mt-2 grid gap-1 text-muted-foreground sm:grid-cols-2">
                <div>
                  <div className="text-foreground">{e.nome}</div>
                  <div>{e.morada}</div>
                  <div>
                    {e.codigoPostal} {e.cidade}
                  </div>
                </div>
                <div>
                  <div>{e.telefone}</div>
                  <div>{e.email}</div>
                  {e.qr ? (
                    <a href={e.qr} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                      QR do cliente para imprimir <ExternalLink className="size-3" />
                    </a>
                  ) : e.temQr ? (
                    <div className="text-amber-600">O QR do cliente ainda está a ser criado.</div>
                  ) : null}
                </div>
              </div>
              {e.estado === "enviado" ? (
                e.codigo ? <div className="mt-2 text-muted-foreground">Seguimento: {e.codigo}</div> : null
              ) : (
                <div className="mt-3 flex gap-2">
                  <Input
                    value={codigos[e.id] ?? ""}
                    onChange={(ev) => setCodigos((c) => ({ ...c, [e.id]: ev.target.value }))}
                    placeholder="Código de seguimento CTT (opcional)"
                  />
                  <Button disabled={aGuardar} onClick={() => enviar(e)}>
                    <Truck /> Marcar como enviada
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
