"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Download, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormularioCartao, type Textos } from "@/components/pagamentos/formulario-cartao";
import { guardarDadosPagador, verificarPagamento } from "../actions";

type TextosPagina = Textos & {
  pagoTitulo: string;
  pagoTexto: string;
  pendente: string;
  expirado: string;
  voltar: string;
  email: string;
  emailHint: string;
  nome: string;
  nif: string;
  morada: string;
  opcional: string;
  emailInvalido: string;
  comprovativo: string;
  enviadoPara: string;
  dadosTitulo: string;
};

export default function PaginaPagar(props: {
  id: string;
  estado: string;
  clientSecret: string | null;
  chavePublica: string;
  locale: string;
  retorno: string | null;
  pedeDados: boolean;
  dados: { email: string; nome: string; nif: string; morada: string };
  textos: TextosPagina;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState(props.estado);
  const [dados, setDados] = useState(props.dados);
  const campo = (k: keyof typeof dados) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDados((d) => ({ ...d, [k]: e.target.value }));

  async function antesDeEnviar(): Promise<string | null> {
    if (!props.pedeDados) return null;
    const r = await guardarDadosPagador(props.id, dados);
    if (r.ok) return null;
    return r.campo === "email" ? props.textos.emailInvalido : props.textos.erro;
  }

  async function concluido() {
    // O cartão foi aceite. Pede-se ao servidor que confirme no Stripe; alguns
    // métodos demoram uns segundos a dar o dinheiro como recebido.
    for (let i = 0; i < 6; i++) {
      if ((await verificarPagamento(props.id)) === "pago") {
        setEstado("pago");
        router.refresh();
        return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setEstado("a_confirmar");
  }

  const voltar = props.retorno ? (
    <Button className="mt-3 w-full" variant="outline" onClick={() => router.push(props.retorno!)}>
      {props.textos.voltar}
    </Button>
  ) : null;

  if (estado === "pago") {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
        <h2 className="mt-3 text-lg font-semibold text-zinc-900">{props.textos.pagoTitulo}</h2>
        <p className="mt-1 text-sm text-zinc-500">{props.textos.pagoTexto}</p>
        {dados.email ? (
          <p className="mt-1 text-sm text-zinc-500">{props.textos.enviadoPara.replace("{email}", dados.email)}</p>
        ) : null}
        <Button
          className="mt-5 w-full bg-indigo-600 text-white hover:bg-indigo-700"
          nativeButton={false}
          render={<a href={`/pagar/${props.id}/comprovativo`} />}
        >
          <Download /> {props.textos.comprovativo}
        </Button>
        {voltar}
      </div>
    );
  }
  if (estado === "a_confirmar") {
    return (
      <div className="text-center">
        <Clock className="mx-auto size-12 text-amber-500" />
        <p className="mt-3 text-sm text-zinc-600">{props.textos.pendente}</p>
        {voltar}
      </div>
    );
  }
  if (estado === "expirado" || !props.clientSecret || !props.chavePublica) {
    return (
      <div className="text-center">
        <XCircle className="mx-auto size-12 text-zinc-300" />
        <p className="mt-3 text-sm text-zinc-600">{props.textos.expirado}</p>
        {voltar}
      </div>
    );
  }

  const opcional = <span className="font-normal text-zinc-400"> ({props.textos.opcional})</span>;
  return (
    <FormularioCartao
      chavePublica={props.chavePublica}
      clientSecret={props.clientSecret}
      modo="pagamento"
      locale={props.locale}
      retorno={`/pagar/${props.id}`}
      textos={props.textos}
      onConcluido={concluido}
      antesDeEnviar={antesDeEnviar}
    >
      {props.pedeDados ? (
        <div className="space-y-3 border-b border-zinc-100 pb-5">
          <div className="space-y-1.5">
            <Label htmlFor="pg-email">{props.textos.email}</Label>
            <Input id="pg-email" type="email" autoComplete="email" required value={dados.email} onChange={campo("email")} />
            <p className="text-xs text-zinc-400">{props.textos.emailHint}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pg-nome">
              {props.textos.nome}
              {opcional}
            </Label>
            <Input id="pg-nome" autoComplete="name" value={dados.nome} onChange={campo("nome")} />
          </div>
          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pg-nif">
                {props.textos.nif}
                {opcional}
              </Label>
              <Input id="pg-nif" inputMode="numeric" value={dados.nif} onChange={campo("nif")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pg-morada">
                {props.textos.morada}
                {opcional}
              </Label>
              <Input id="pg-morada" autoComplete="street-address" value={dados.morada} onChange={campo("morada")} />
            </div>
          </div>
        </div>
      ) : null}
    </FormularioCartao>
  );
}
