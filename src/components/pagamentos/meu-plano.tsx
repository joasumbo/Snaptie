"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, CreditCard, Download, Loader2 } from "lucide-react";
import type { Plano } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PLANOS, NOMES_FUNCIONALIDADES } from "@/lib/planos";
import { NOMES_ESTADO_SUBSCRICAO, NOMES_INTERVALO, euros, type Intervalo } from "@/lib/pagamentos";
import { FormularioCartao } from "@/components/pagamentos/formulario-cartao";
import {
  guardarCartao,
  mudarCancelamento,
  pedirTrocaCartao,
  subscreverPacote,
} from "@/app/dashboard/plano/actions";

type PacoteVenda = {
  id: string;
  nome: string;
  descricao: string;
  precoCentimos: number;
  intervalo: string;
  plano: Plano;
  limiteQrs: number | null;
};

type Fatura = { id: string; numero: string; data: string; valorCentimos: number; moeda: string };

function data(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });
}

export default function MeuPlano(props: {
  plano: Plano;
  pacoteAtual: string | null;
  nomePacote: string | null;
  estado: string | null;
  fim: string | null;
  cancela: boolean;
  cartao: string | null;
  faturas: Fatura[];
  chavePublica: string;
  locale: string;
  qrs: number;
  limite: number | null;
  pacotes: PacoteVenda[];
  pagamentos: { id: string; descricao: string; valorCentimos: number; moeda: string; data: string }[];
}) {
  const router = useRouter();
  const [aAbrir, setAAbrir] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [segredoCartao, setSegredoCartao] = useState<string | null>(null);

  async function subscrever(id: string) {
    setAAbrir(id);
    const r = await subscreverPacote(id);
    if (!r.ok) {
      setAAbrir(null);
      toast.error(r.message);
      return;
    }
    router.push(r.url);
  }

  function cancelar(sim: boolean) {
    if (sim && !confirm("Cancelar a subscrição? O plano mantém-se até ao fim do período já pago.")) return;
    iniciar(async () => {
      const r = await mudarCancelamento(sim);
      if (!r.ok) toast.error(r.message);
      else toast.success(sim ? "Subscrição cancelada no fim do período." : "A subscrição continua ativa.");
      router.refresh();
    });
  }

  function trocarCartao() {
    iniciar(async () => {
      const r = await pedirTrocaCartao();
      if (!r.ok) toast.error(r.message);
      else setSegredoCartao(r.clientSecret);
    });
  }

  const subscrito = props.estado === "ativa" || props.estado === "em_falta";
  const def = PLANOS[props.plano];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Plano {def.nome}
            {props.estado ? (
              <Badge variant={props.estado === "em_falta" ? "destructive" : "secondary"}>
                {props.cancela && subscrito ? "Cancela no fim do período" : (NOMES_ESTADO_SUBSCRICAO[props.estado] ?? props.estado)}
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            {props.nomePacote ? `Pacote ${props.nomePacote}. ` : ""}
            {props.fim && subscrito ? (props.cancela ? `Ativo até ${data(props.fim)}.` : `Renova a ${data(props.fim)}.`) : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            QR codes: <strong>{props.qrs}</strong>
            {props.limite != null ? ` de ${props.limite}` : " (sem limite)"}
          </p>
          {def.funcionalidades.length ? (
            <ul className="space-y-1">
              {def.funcionalidades.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-600" /> {NOMES_FUNCIONALIDADES[f]}
                </li>
              ))}
            </ul>
          ) : null}
          {props.estado === "em_falta" ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
              O último pagamento falhou. Troque o cartão para não perder o plano.
            </p>
          ) : null}
          {subscrito ? (
            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CreditCard className="size-4" /> {props.cartao ?? "Cartão guardado"}
              </span>
              <Button size="sm" variant="outline" disabled={pendente} onClick={trocarCartao}>
                Trocar cartão
              </Button>
              {props.cancela ? (
                <Button size="sm" variant="outline" disabled={pendente} onClick={() => cancelar(false)}>
                  Manter a subscrição
                </Button>
              ) : (
                <Button size="sm" variant="ghost" className="text-destructive" disabled={pendente} onClick={() => cancelar(true)}>
                  Cancelar subscrição
                </Button>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {props.pacotes.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {props.pacotes.map((p) => {
            const atual = p.id === props.pacoteAtual && (subscrito || props.estado === "unico");
            const bloqueado = subscrito && p.intervalo !== "unico" && !atual;
            return (
              <Card key={p.id} className={atual ? "ring-2 ring-indigo-600" : undefined}>
                <CardHeader>
                  <CardTitle>{p.nome}</CardTitle>
                  <CardDescription>{p.descricao}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <span className="text-2xl font-semibold">{euros(p.precoCentimos)}</span>{" "}
                    <span className="text-muted-foreground">{NOMES_INTERVALO[p.intervalo as Intervalo]}</span>
                  </div>
                  <p className="text-muted-foreground">
                    Plano {PLANOS[p.plano].nome}, {p.limiteQrs != null ? `até ${p.limiteQrs} QR codes` : "QR codes sem limite"}.
                  </p>
                  {atual ? (
                    <Badge>O seu pacote</Badge>
                  ) : (
                    <Button
                      className="w-full bg-indigo-600 text-white hover:bg-indigo-700"
                      disabled={aAbrir !== null || bloqueado}
                      onClick={() => subscrever(p.id)}
                    >
                      {aAbrir === p.id ? <Loader2 className="animate-spin" /> : null}
                      {p.intervalo === "unico" ? "Comprar" : "Subscrever"}
                    </Button>
                  )}
                  {bloqueado ? (
                    <p className="text-xs text-muted-foreground">Para mudar de pacote, cancele primeiro a subscrição atual.</p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">De momento não há pacotes à venda. Fale connosco.</p>
      )}

      {props.faturas.length || props.pagamentos.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Pagamentos e faturas</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {props.faturas.length
                ? props.faturas.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                      <span>
                        {data(f.data)} · Fatura {f.numero}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{euros(f.valorCentimos, f.moeda)}</span>
                        <Button size="icon-sm" variant="ghost" aria-label="Descarregar fatura" nativeButton={false} render={<a href={`/api/faturas/${f.id}`} />}>
                          <Download />
                        </Button>
                      </span>
                    </li>
                  ))
                : props.pagamentos.map((p) => (
                    <li key={p.id} className="flex justify-between gap-3 py-2">
                      <span>
                        {data(p.data)} · {p.descricao}
                      </span>
                      <span className="font-medium">{euros(p.valorCentimos, p.moeda)}</span>
                    </li>
                  ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {segredoCartao ? (
        <Dialog open onOpenChange={(abrir) => !abrir && setSegredoCartao(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Trocar cartão</DialogTitle>
            </DialogHeader>
            <FormularioCartao
              chavePublica={props.chavePublica}
              clientSecret={segredoCartao}
              modo="cartao"
              locale={props.locale}
              retorno="/dashboard/plano"
              textos={{
                botao: "Guardar cartão",
                aProcessar: "A guardar…",
                seguro: "Pagamento seguro e encriptado",
                erro: "Não foi possível guardar o cartão.",
              }}
              onConcluido={async (id) => {
                const r = await guardarCartao(id);
                if (!r.ok) {
                  toast.error(r.message);
                  return;
                }
                toast.success("Cartão atualizado.");
                setSegredoCartao(null);
                router.refresh();
              }}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
