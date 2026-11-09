"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Download, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormularioCartao, type Textos } from "@/components/pagamentos/formulario-cartao";
import { guardarDadosPagador, verificarPagamento, type Campo } from "../actions";

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
  codigoPostal: string;
  cidade: string;
  opcional: string;
  comprovativo: string;
  fatura: string;
  enviadoPara: string;
  passo1: string;
  passo2: string;
  continuar: string;
  alterar: string;
  faturaEm: string;
  nifDica: string;
  erros: Record<Campo, string>;
};

type Dados = { email: string; nome: string; nif: string; morada: string; codigoPostal: string; cidade: string };

export default function PaginaPagar(props: {
  id: string;
  estado: string;
  clientSecret: string | null;
  chavePublica: string;
  locale: string;
  retorno: string | null;
  pedeDados: boolean;
  fatura: boolean;
  dados: Dados;
  textos: TextosPagina;
}) {
  const router = useRouter();
  const t = props.textos;
  const [estado, setEstado] = useState(props.estado);
  const [dados, setDados] = useState(props.dados);
  // Primeiro os dados para a fatura, depois o pagamento. Quem já os deu (ou
  // paga como empresa) vai direto ao pagamento.
  const [passo, setPasso] = useState<1 | 2>(props.pedeDados && !(props.dados.nome && props.dados.email) ? 1 : 2);
  const [erro, setErro] = useState<Campo | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const campo = (k: keyof Dados) => (e: React.ChangeEvent<HTMLInputElement>) => setDados((d) => ({ ...d, [k]: e.target.value }));

  async function continuar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAGuardar(true);
    const r = await guardarDadosPagador(props.id, dados);
    setAGuardar(false);
    if (!r.ok) {
      setErro(r.campo);
      return;
    }
    setPasso(2);
  }

  async function concluido() {
    // O pagamento foi aceite. Pede-se ao servidor que confirme no Stripe; a
    // confirmação já dispara os emails e a fatura.
    for (let i = 0; i < 8; i++) {
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
      {t.voltar}
    </Button>
  ) : null;

  if (estado === "pago") {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
        <h2 className="mt-3 text-lg font-semibold text-zinc-900">{t.pagoTitulo}</h2>
        <p className="mt-1 text-sm text-zinc-500">{t.pagoTexto}</p>
        {dados.email ? <p className="mt-1 text-sm text-zinc-500">{t.enviadoPara.replace("{email}", dados.email)}</p> : null}
        <Button
          className="mt-5 w-full bg-indigo-600 text-white hover:bg-indigo-700"
          nativeButton={false}
          render={<a href={`/pagar/${props.id}/${props.fatura ? "fatura" : "comprovativo"}`} />}
        >
          <Download /> {props.fatura ? t.fatura : t.comprovativo}
        </Button>
        {voltar}
      </div>
    );
  }
  if (estado === "a_confirmar") {
    return (
      <div className="text-center">
        <Clock className="mx-auto size-12 text-amber-500" />
        <p className="mt-3 text-sm text-zinc-600">{t.pendente}</p>
        {voltar}
      </div>
    );
  }
  if (estado === "expirado" || !props.clientSecret || !props.chavePublica) {
    return (
      <div className="text-center">
        <XCircle className="mx-auto size-12 text-zinc-300" />
        <p className="mt-3 text-sm text-zinc-600">{t.expirado}</p>
        {voltar}
      </div>
    );
  }

  const passos = props.pedeDados ? (
    <ol className="mb-5 flex items-center gap-2 text-xs font-medium">
      <li className={passo === 1 ? "text-indigo-600" : "text-zinc-400"}>1. {t.passo1}</li>
      <li className="h-px flex-1 bg-zinc-200" aria-hidden />
      <li className={passo === 2 ? "text-indigo-600" : "text-zinc-400"}>2. {t.passo2}</li>
    </ol>
  ) : null;

  if (passo === 1) {
    const opcional = <span className="font-normal text-zinc-400"> ({t.opcional})</span>;
    const invalido = (c: Campo) => (erro === c ? "border-destructive" : undefined);
    return (
      <form onSubmit={continuar} className="space-y-3">
        {passos}
        <div className="space-y-1.5">
          <Label htmlFor="pg-nome">{t.nome}</Label>
          <Input id="pg-nome" autoComplete="name" required className={invalido("nome")} value={dados.nome} onChange={campo("nome")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pg-email">{t.email}</Label>
          <Input id="pg-email" type="email" autoComplete="email" required className={invalido("email")} value={dados.email} onChange={campo("email")} />
          <p className="text-xs text-zinc-400">{t.emailHint}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pg-nif">
            {t.nif}
            {opcional}
          </Label>
          <Input id="pg-nif" inputMode="numeric" maxLength={9} className={invalido("nif")} value={dados.nif} onChange={campo("nif")} />
          <p className="text-xs text-zinc-400">{t.nifDica}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pg-morada">
            {t.morada}
            {opcional}
          </Label>
          <Input id="pg-morada" autoComplete="street-address" value={dados.morada} onChange={campo("morada")} />
        </div>
        <div className="grid grid-cols-[1fr_1.4fr] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pg-cp">{t.codigoPostal}</Label>
            <Input
              id="pg-cp"
              autoComplete="postal-code"
              placeholder="1000-001"
              className={invalido("codigoPostal")}
              value={dados.codigoPostal}
              onChange={campo("codigoPostal")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pg-cidade">{t.cidade}</Label>
            <Input id="pg-cidade" autoComplete="address-level2" value={dados.cidade} onChange={campo("cidade")} />
          </div>
        </div>
        {erro ? (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {t.erros[erro]}
          </div>
        ) : null}
        <Button type="submit" className="h-11 w-full bg-indigo-600 text-base text-white hover:bg-indigo-700" disabled={aGuardar}>
          {aGuardar ? <Loader2 className="animate-spin" /> : null}
          {t.continuar}
        </Button>
      </form>
    );
  }

  return (
    <div>
      {passos}
      {props.pedeDados ? (
        <div className="mb-5 flex items-start justify-between gap-3 rounded-lg bg-zinc-50 px-3 py-2.5 text-sm">
          <div>
            <div className="text-xs text-zinc-400">{t.faturaEm}</div>
            <div className="font-medium text-zinc-900">
              {dados.nome}
              {dados.nif ? ` · NIF ${dados.nif}` : ""}
            </div>
            <div className="text-zinc-500">{dados.email}</div>
          </div>
          <button type="button" className="text-sm font-medium text-indigo-600 hover:underline" onClick={() => setPasso(1)}>
            {t.alterar}
          </button>
        </div>
      ) : null}
      <FormularioCartao
        chavePublica={props.chavePublica}
        clientSecret={props.clientSecret}
        modo="pagamento"
        locale={props.locale}
        retorno={`/pagar/${props.id}`}
        textos={t}
        onConcluido={concluido}
      />
    </div>
  );
}
