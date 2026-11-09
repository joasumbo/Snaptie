"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormularioCartao, type Textos } from "@/components/pagamentos/formulario-cartao";
import { verificarPagamento } from "../actions";

type TextosPagina = Textos & {
  pagoTitulo: string;
  pagoTexto: string;
  pendente: string;
  expirado: string;
  voltar: string;
};

export default function PaginaPagar(props: {
  id: string;
  estado: string;
  clientSecret: string | null;
  chavePublica: string;
  locale: string;
  retorno: string | null;
  textos: TextosPagina;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState(props.estado);

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
    <Button className="mt-5 w-full" variant="outline" onClick={() => router.push(props.retorno!)}>
      {props.textos.voltar}
    </Button>
  ) : null;

  if (estado === "pago") {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
        <h2 className="mt-3 text-lg font-semibold text-zinc-900">{props.textos.pagoTitulo}</h2>
        <p className="mt-1 text-sm text-zinc-500">{props.textos.pagoTexto}</p>
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

  return (
    <FormularioCartao
      chavePublica={props.chavePublica}
      clientSecret={props.clientSecret}
      modo="pagamento"
      locale={props.locale}
      retorno={`/pagar/${props.id}`}
      textos={props.textos}
      onConcluido={concluido}
    />
  );
}
