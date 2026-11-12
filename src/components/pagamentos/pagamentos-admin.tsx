"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, FileText, Link2, Loader2, Mail, Pencil, Plus, Trash2 } from "lucide-react";
import type { Plano } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLANO_LABELS } from "@/lib/companies";
import { PLANOS_PAGOS } from "@/lib/planos";
import {
  INTERVALOS,
  NOMES_ESTADO_PAGAMENTO,
  NOMES_ESTADO_SUBSCRICAO,
  NOMES_INTERVALO,
  euros,
  type Intervalo,
} from "@/lib/pagamentos";
import {
  apagarPacote,
  guardarPacote,
  criarLinkPagamento,
  ligarWebhookStripe,
  reenviarComprovativo,
  mudarLimites,
  type PacoteInput,
} from "@/app/dashboard/pagamentos/actions";
import Faturacao from "@/components/pagamentos/faturacao-admin";

type PacoteLinha = {
  id: string;
  nome: string;
  descricao: string;
  precoCentimos: number;
  intervalo: string;
  plano: Plano;
  limiteQrs: number | null;
  ativo: boolean;
  ordem: number;
  sincronizado: boolean;
  empresas: number;
  companyId: string | null;
  empresaPrivada: string | null;
};

type Empresa = { id: string; nome: string };
type Emissor = { nome: string; nif: string; morada: string; email: string };
const NENHUMA = "__nenhuma__";

type PagamentoLinha = {
  id: string;
  tipo: string;
  estado: string;
  valorCentimos: number;
  moeda: string;
  descricao: string;
  empresa: string;
  email: string;
  data: string;
  link: string | null;
  numero: string | null;
  emailEnviado: boolean;
  fatura: boolean;
  proforma: string | null;
};

type Subscrita = {
  id: string;
  nome: string;
  plano: Plano;
  pacote: string;
  estado: string;
  fim: string | null;
};

const NOMES_TIPO: Record<string, string> = {
  pacote: "Pacote",
  renovacao: "Renovação",
  botao: "Botão na página",
  qr: "Loja (QR)",
  link: "Link de pagamento",
};

function copiar(texto: string) {
  navigator.clipboard.writeText(texto).then(
    () => toast.success("Link copiado."),
    () => toast.error("Não foi possível copiar."),
  );
}

function data(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Lisbon" });
}

export default function PagamentosAdmin(props: {
  modo: "live" | "teste" | null;
  conta: { nome: string } | { erro: string } | null;
  webhook: { ligado: false } | { ligado: true; url: string; estado: string };
  limites: boolean;
  emissor: Emissor;
  avisoAdmin: string;
  dias: number;
  empresas: Empresa[];
  pacotes: PacoteLinha[];
  pagamentos: PagamentoLinha[];
  subscritas: Subscrita[];
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [editar, setEditar] = useState<PacoteLinha | "novo" | null>(null);

  function correr(acao: () => Promise<{ ok: true } | { ok: false; message: string }>, sucesso: string) {
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) toast.error(r.message);
      else {
        toast.success(sucesso);
        router.refresh();
      }
    });
  }

  const ligado = props.conta && "nome" in props.conta;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ligação ao Stripe</CardTitle>
          <CardDescription>
            A chave fica no servidor. Os pacotes, clientes e pagamentos do Snaptie levam a marca
            &quot;snaptie&quot; no Stripe; o resto da conta não é tocado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Conta:</span>
            {props.conta === null ? (
              <Badge variant="destructive">Sem chave configurada</Badge>
            ) : "erro" in props.conta ? (
              <Badge variant="destructive">Erro: {props.conta.erro}</Badge>
            ) : (
              <>
                <span className="font-medium">{props.conta.nome}</span>
                <Badge variant={props.modo === "live" ? "default" : "secondary"}>
                  {props.modo === "live" ? "Modo real" : "Modo de teste"}
                </Badge>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Webhook:</span>
            {props.webhook.ligado ? (
              <>
                <Badge variant={props.webhook.estado === "enabled" ? "default" : "destructive"}>
                  {props.webhook.estado === "enabled" ? "Ligado" : props.webhook.estado}
                </Badge>
                <span className="break-all text-muted-foreground">{props.webhook.url}</span>
              </>
            ) : (
              <Badge variant="destructive">Por ligar</Badge>
            )}
            {ligado ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pendente}
                onClick={() => correr(ligarWebhookStripe, "Webhook ligado.")}
              >
                {props.webhook.ligado ? "Voltar a ligar" : "Ligar webhook"}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="text-muted-foreground">Limites dos planos:</span>
            <Badge variant={props.limites ? "default" : "secondary"}>
              {props.limites ? "Ligados" : "Desligados"}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              disabled={pendente}
              onClick={() =>
                correr(
                  () => mudarLimites(!props.limites),
                  props.limites ? "Limites desligados." : "Limites ligados.",
                )
              }
            >
              {props.limites ? "Desligar" : "Ligar"}
            </Button>
            <p className="w-full text-xs text-muted-foreground">
              Ligados, cada empresa fica com o limite de QR codes e as funcionalidades do seu plano.
              Antes de ligar, confirme o plano de cada empresa: as que estão no Free ficam com 3 QR
              codes.
            </p>
          </div>
        </CardContent>
      </Card>

      <Faturacao emissor={props.emissor} avisoAdmin={props.avisoAdmin} dias={props.dias} />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Pacotes</CardTitle>
            <CardDescription>
              O que as empresas podem comprar em &quot;O meu plano&quot;. Criar ou mudar um pacote
              atualiza o produto e o preço no Stripe.
            </CardDescription>
          </div>
          <Button size="sm" disabled={!ligado} onClick={() => setEditar("novo")}>
            <Plus /> Novo pacote
          </Button>
        </CardHeader>
        <CardContent>
          {props.pacotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há pacotes.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Pacote</th>
                    <th className="py-2 pr-3 font-medium">Preço</th>
                    <th className="py-2 pr-3 font-medium">Plano</th>
                    <th className="py-2 pr-3 font-medium">QR codes</th>
                    <th className="py-2 pr-3 font-medium">Empresas</th>
                    <th className="py-2 pr-3 font-medium">Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {props.pacotes.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{p.nome}</div>
                        {p.descricao ? <div className="text-xs text-muted-foreground">{p.descricao}</div> : null}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {euros(p.precoCentimos)}{" "}
                        <span className="text-muted-foreground">{NOMES_INTERVALO[p.intervalo as Intervalo]}</span>
                      </td>
                      <td className="py-2 pr-3">
                        {PLANO_LABELS[p.plano]}
                        {p.empresaPrivada ? <div className="text-xs text-muted-foreground">Só para {p.empresaPrivada}</div> : null}
                      </td>
                      <td className="py-2 pr-3">{p.limiteQrs ?? "do plano"}</td>
                      <td className="py-2 pr-3">{p.empresas}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={p.ativo ? "default" : "secondary"}>{p.ativo ? "À venda" : "Inativo"}</Badge>
                        {!p.sincronizado ? <Badge variant="destructive" className="ml-1">Fora do Stripe</Badge> : null}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <Button size="icon-sm" variant="ghost" aria-label="Editar" onClick={() => setEditar(p)}>
                          <Pencil />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Apagar"
                          disabled={pendente}
                          onClick={() => {
                            if (!confirm(`Apagar o pacote ${p.nome}? Quem já o subscreveu mantém a subscrição.`)) return;
                            correr(() => apagarPacote(p.id), "Pacote retirado.");
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <LinkPagamento
        ativo={Boolean(ligado)}
        empresas={props.empresas}
        pacotes={props.pacotes.filter((p) => p.ativo && p.sincronizado)}
        onCriado={() => router.refresh()}
      />

      <Card>
        <CardHeader>
          <CardTitle>Empresas com plano pago</CardTitle>
        </CardHeader>
        <CardContent>
          {props.subscritas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma empresa pagou ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Empresa</th>
                    <th className="py-2 pr-3 font-medium">Pacote</th>
                    <th className="py-2 pr-3 font-medium">Estado</th>
                    <th className="py-2 pr-3 font-medium">Até</th>
                  </tr>
                </thead>
                <tbody>
                  {props.subscritas.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="py-2 pr-3 font-medium">{c.nome}</td>
                      <td className="py-2 pr-3">{c.pacote || PLANO_LABELS[c.plano]}</td>
                      <td className="py-2 pr-3">{NOMES_ESTADO_SUBSCRICAO[c.estado] ?? c.estado}</td>
                      <td className="py-2 pr-3">{c.fim ? data(c.fim) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimos pagamentos</CardTitle>
          <CardDescription>Os 50 mais recentes. O detalhe e os reembolsos fazem-se no Stripe.</CardDescription>
        </CardHeader>
        <CardContent>
          {props.pagamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há pagamentos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Data</th>
                    <th className="py-2 pr-3 font-medium">Tipo</th>
                    <th className="py-2 pr-3 font-medium">Descrição</th>
                    <th className="py-2 pr-3 font-medium">Empresa</th>
                    <th className="py-2 pr-3 font-medium">Valor</th>
                    <th className="py-2 pr-3 font-medium">Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {props.pagamentos.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="py-2 pr-3 whitespace-nowrap">{data(p.data)}</td>
                      <td className="py-2 pr-3">{NOMES_TIPO[p.tipo] ?? p.tipo}</td>
                      <td className="py-2 pr-3">
                        {p.descricao}
                        {p.email ? <div className="text-xs text-muted-foreground">{p.email}</div> : null}
                        {p.link ? (
                          <button
                            type="button"
                            className="mt-0.5 flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                            onClick={() => copiar(window.location.origin + p.link)}
                          >
                            <Copy className="size-3" /> Copiar link
                          </button>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3">{p.empresa}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{euros(p.valorCentimos, p.moeda)}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={p.estado === "pago" ? "default" : p.estado === "pendente" ? "secondary" : "destructive"}>
                          {NOMES_ESTADO_PAGAMENTO[p.estado] ?? p.estado}
                        </Badge>
                        {p.numero ? <div className="mt-0.5 text-xs text-muted-foreground">{p.numero}</div> : null}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        {p.estado === "pago" ? (
                          <>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Ver comprovativo"
                              nativeButton={false}
                              render={<a href={`/pagar/${p.id}/${p.fatura ? "fatura" : "comprovativo"}`} target="_blank" rel="noreferrer" />}
                            >
                              <FileText />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Reenviar comprovativo por email"
                              disabled={pendente}
                              onClick={() => correr(() => reenviarComprovativo(p.id), "Comprovativo reenviado.")}
                            >
                              <Mail />
                            </Button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {editar ? (
        <PacoteModal
          empresas={props.empresas}
          pacote={editar === "novo" ? null : editar}
          onClose={() => setEditar(null)}
          onSaved={() => {
            setEditar(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function PacoteModal({
  empresas,
  pacote,
  onClose,
  onSaved,
}: {
  empresas: Empresa[];
  pacote: PacoteLinha | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(pacote?.nome ?? "");
  const [descricao, setDescricao] = useState(pacote?.descricao ?? "");
  const [preco, setPreco] = useState(pacote ? String(pacote.precoCentimos / 100).replace(".", ",") : "");
  const [intervalo, setIntervalo] = useState<string>(pacote?.intervalo ?? "mes");
  const [plano, setPlano] = useState<Plano>(pacote?.plano ?? "STARTER");
  const [limite, setLimite] = useState(pacote?.limiteQrs != null ? String(pacote.limiteQrs) : "");
  const [ativo, setAtivo] = useState(pacote?.ativo ?? true);
  const [ordem, setOrdem] = useState(String(pacote?.ordem ?? 0));
  const [empresa, setEmpresa] = useState<string>(pacote?.companyId ?? NENHUMA);
  const [aGravar, setAGravar] = useState(false);

  async function gravar() {
    const input: PacoteInput = {
      id: pacote?.id,
      nome,
      descricao,
      precoEuros: Number(preco.replace(",", ".")),
      intervalo,
      plano,
      limiteQrs: limite.trim() ? Number(limite) : null,
      ativo,
      ordem: Number(ordem) || 0,
      companyId: empresa === NENHUMA ? null : empresa,
    };
    setAGravar(true);
    const r = await guardarPacote(input);
    setAGravar(false);
    if (!r.ok) {
      toast.error(r.message);
      return;
    }
    toast.success(pacote ? "Pacote atualizado no Stripe." : "Pacote criado no Stripe.");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(abrir) => !abrir && !aGravar && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pacote ? "Editar pacote" : "Novo pacote"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={nome} placeholder="Pro mensal" onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição (aparece no pagamento)</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Preço (€)</Label>
              <Input inputMode="decimal" value={preco} placeholder="19,90" onChange={(e) => setPreco(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cobrança</Label>
              <Select value={intervalo} onValueChange={(v) => setIntervalo(v as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: string | null) => (v ? NOMES_INTERVALO[v as Intervalo] : "")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {INTERVALOS.map((i) => (
                    <SelectItem key={i} value={i}>
                      {NOMES_INTERVALO[i]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Plano que dá</Label>
              <Select value={plano} onValueChange={(v) => setPlano(v as Plano)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: string | null) => (v ? PLANO_LABELS[v as Plano] : "")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PLANOS_PAGOS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PLANO_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Limite de QR codes</Label>
              <Input inputMode="numeric" value={limite} placeholder="o do plano" onChange={(e) => setLimite(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Quem vê o pacote</Label>
            <Select value={empresa} onValueChange={(v) => setEmpresa(v as string)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string | null) =>
                    !v || v === NENHUMA ? "Todas as empresas" : `Só ${empresas.find((e) => e.id === v)?.nome ?? ""}`
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUMA}>Todas as empresas</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    Só {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Para o Business: um pacote com o preço acordado, que só essa empresa vê em O meu plano.
            </p>
          </div>
          <div className="grid grid-cols-2 items-end gap-3">
            <div className="space-y-1.5">
              <Label>Ordem na lista</Label>
              <Input inputMode="numeric" value={ordem} onChange={(e) => setOrdem(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
              À venda
            </label>
          </div>
          {pacote ? (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Se mudar o preço ou a cobrança, o Stripe fica com um preço novo. Quem já subscreveu
              continua a pagar o valor antigo.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={aGravar}>
            Cancelar
          </Button>
          <Button onClick={gravar} disabled={aGravar}>
            {aGravar ? <Loader2 className="animate-spin" /> : null}
            {pacote ? "Guardar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LinkPagamento({
  ativo,
  empresas,
  pacotes,
  onCriado,
}: {
  ativo: boolean;
  empresas: Empresa[];
  pacotes: PacoteLinha[];
  onCriado: () => void;
}) {
  const [empresa, setEmpresa] = useState<string>(NENHUMA);
  const [pacote, setPacote] = useState<string>(NENHUMA);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [aCriar, setACriar] = useState(false);

  async function criar() {
    setACriar(true);
    const r = await criarLinkPagamento({
      descricao,
      valorEuros: Number(valor.replace(",", ".")),
      email,
      companyId: empresa === NENHUMA ? null : empresa,
      pacoteId: pacote === NENHUMA ? null : pacote,
    });
    setACriar(false);
    if (!r.ok) {
      toast.error(r.message);
      return;
    }
    setUrl(r.url);
    onCriado();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Link de pagamento</CardTitle>
        <CardDescription>
          Cria um link para a nossa página de pagamento, para mandar a quem tem de pagar. Cada link
          serve para um pagamento e aparece na lista abaixo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Empresa (opcional)</Label>
            <Select value={empresa} onValueChange={(v) => setEmpresa(v as string)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string | null) => (!v || v === NENHUMA ? "Nenhuma (pagamento avulso)" : (empresas.find((e) => e.id === v)?.nome ?? ""))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUMA}>Nenhuma (pagamento avulso)</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Pacote (opcional)</Label>
            <Select value={pacote} onValueChange={(v) => setPacote(v as string)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string | null) => {
                    const p = pacotes.find((x) => x.id === v);
                    return p ? `${p.nome} · ${euros(p.precoCentimos)} ${NOMES_INTERVALO[p.intervalo as Intervalo]}` : "Nenhum (valor livre)";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUMA}>Nenhum (valor livre)</SelectItem>
                {pacotes
                  .filter((p) => !p.companyId || p.companyId === empresa)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} · {euros(p.precoCentimos)} {NOMES_INTERVALO[p.intervalo as Intervalo]}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {pacote !== NENHUMA ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Quando a empresa pagar, fica com o plano do pacote. Se for mensal ou anual, a subscrição renova sozinha.
            </p>
            <Button disabled={!ativo || aCriar || empresa === NENHUMA} onClick={criar}>
              {aCriar ? <Loader2 className="animate-spin" /> : <Link2 />} Criar link
            </Button>
          </div>
        ) : (
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_2fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input value={descricao} placeholder="Instalação de 10 placas QR" onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Valor (€)</Label>
            <Input inputMode="decimal" value={valor} placeholder="50,00" onChange={(e) => setValor(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email para o recibo (opcional)</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button disabled={!ativo || aCriar} onClick={criar}>
            {aCriar ? <Loader2 className="animate-spin" /> : <Link2 />} Criar link
          </Button>
        </div>
        )}
        {url ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <a href={url} target="_blank" rel="noreferrer" className="break-all font-medium text-indigo-600 hover:underline">
              {url}
            </a>
            <Button size="sm" variant="outline" onClick={() => copiar(url)}>
              <Copy /> Copiar
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
