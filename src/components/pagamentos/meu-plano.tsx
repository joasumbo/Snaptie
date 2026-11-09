"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import type { Plano } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLANOS, NOMES_FUNCIONALIDADES } from "@/lib/planos";
import { NOMES_ESTADO_SUBSCRICAO, NOMES_INTERVALO, euros, type Intervalo } from "@/lib/pagamentos";
import { gerirSubscricao, subscreverPacote } from "@/app/dashboard/plano/actions";

type PacoteVenda = {
  id: string;
  nome: string;
  descricao: string;
  precoCentimos: number;
  intervalo: string;
  plano: Plano;
  limiteQrs: number | null;
};

function data(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });
}

export default function MeuPlano(props: {
  retorno: "ok" | "cancelado" | null;
  plano: Plano;
  pacoteAtual: string | null;
  nomePacote: string | null;
  estado: string | null;
  fim: string | null;
  temCliente: boolean;
  qrs: number;
  limite: number | null;
  pacotes: PacoteVenda[];
  pagamentos: { id: string; descricao: string; valorCentimos: number; moeda: string; data: string }[];
}) {
  const [aAbrir, setAAbrir] = useState<string | null>(null);

  useEffect(() => {
    if (props.retorno === "ok") {
      toast.success("Pagamento recebido. O plano fica ativo assim que o Stripe confirmar, normalmente em segundos.");
    } else if (props.retorno === "cancelado") {
      toast("O pagamento foi cancelado. Nada foi cobrado.");
    }
  }, [props.retorno]);

  async function ir(chave: string, acao: () => Promise<{ ok: true; url: string } | { ok: false; message: string }>) {
    setAAbrir(chave);
    const r = await acao();
    if (!r.ok) {
      setAAbrir(null);
      toast.error(r.message);
      return;
    }
    window.location.href = r.url;
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
                {NOMES_ESTADO_SUBSCRICAO[props.estado] ?? props.estado}
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            {props.nomePacote ? `Pacote ${props.nomePacote}. ` : ""}
            {props.fim && subscrito ? `Renova ou termina a ${data(props.fim)}.` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
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
              O último pagamento falhou. Atualize o cartão em Gerir subscrição para não perder o plano.
            </p>
          ) : null}
          {props.temCliente ? (
            <Button variant="outline" disabled={aAbrir !== null} onClick={() => ir("portal", gerirSubscricao)}>
              {aAbrir === "portal" ? <Loader2 className="animate-spin" /> : null}
              Gerir subscrição, cartão e faturas
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {props.pacotes.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {props.pacotes.map((p) => {
            const atual = p.id === props.pacoteAtual && (subscrito || props.estado === "unico");
            const bloqueado = subscrito && p.intervalo !== "unico" && !atual;
            return (
              <Card key={p.id} className={atual ? "ring-2 ring-primary" : undefined}>
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
                      className="w-full"
                      disabled={aAbrir !== null || bloqueado}
                      onClick={() => ir(p.id, () => subscreverPacote(p.id))}
                    >
                      {aAbrir === p.id ? <Loader2 className="animate-spin" /> : null}
                      {p.intervalo === "unico" ? "Comprar" : "Subscrever"}
                    </Button>
                  )}
                  {bloqueado ? (
                    <p className="text-xs text-muted-foreground">Para mudar de pacote, use Gerir subscrição.</p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">De momento não há pacotes à venda. Fale connosco.</p>
      )}

      {props.pagamentos.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Pagamentos</CardTitle>
            <CardDescription>As faturas estão em Gerir subscrição.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {props.pagamentos.map((p) => (
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
    </div>
  );
}
