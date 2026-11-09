"use client";

import { useMemo, useState } from "react";
import { loadStripe, type Appearance, type StripeElementLocale } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

// Os campos do cartão vêm do Stripe (os dados do cartão nunca passam pelo
// nosso servidor), mas vestidos com o aspeto do Snaptie e dentro da nossa
// página. Serve para pagar (PaymentIntent) e para guardar um cartão novo
// (SetupIntent).

const APARENCIA: Appearance = {
  theme: "flat",
  variables: {
    colorPrimary: "#4f46e5",
    colorBackground: "#f4f4f5",
    colorText: "#18181b",
    colorTextSecondary: "#71717a",
    colorDanger: "#dc2626",
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif",
    fontSizeBase: "15px",
    borderRadius: "10px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { border: "1px solid #e4e4e7", backgroundColor: "#ffffff", boxShadow: "none" },
    ".Input:focus": { border: "1px solid #4f46e5", boxShadow: "0 0 0 3px rgba(79,70,229,.15)" },
    ".Label": { fontWeight: "500", color: "#3f3f46" },
    ".Tab": { border: "1px solid #e4e4e7", backgroundColor: "#ffffff", boxShadow: "none" },
    ".Tab--selected": { borderColor: "#4f46e5", boxShadow: "0 0 0 1px #4f46e5" },
  },
};

const FONTES = [{ cssSrc: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" }];

let promessa: ReturnType<typeof loadStripe> | null = null;
function carregar(chave: string) {
  promessa ??= loadStripe(chave);
  return promessa;
}

export type Textos = {
  botao: string;
  aProcessar: string;
  seguro: string;
  erro: string;
};

export function FormularioCartao(props: {
  chavePublica: string;
  clientSecret: string;
  modo: "pagamento" | "cartao";
  locale: string;
  retorno: string;
  textos: Textos;
  onConcluido: (id: string) => void | Promise<void>;
  antesDeEnviar?: () => Promise<string | null>;
  children?: React.ReactNode;
}) {
  const stripePromise = useMemo(() => carregar(props.chavePublica), [props.chavePublica]);
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: props.clientSecret,
        appearance: APARENCIA,
        fonts: FONTES,
        locale: props.locale as StripeElementLocale,
      }}
    >
      <Interior {...props} />
    </Elements>
  );
}

function Interior(props: {
  modo: "pagamento" | "cartao";
  retorno: string;
  textos: Textos;
  onConcluido: (id: string) => void | Promise<void>;
  antesDeEnviar?: () => Promise<string | null>;
  children?: React.ReactNode;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [aEnviar, setAEnviar] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setErro(null);
    setAEnviar(true);
    if (props.antesDeEnviar) {
      const problema = await props.antesDeEnviar();
      if (problema) {
        setErro(problema);
        setAEnviar(false);
        return;
      }
    }
    const retorno = new URL(props.retorno, window.location.origin).toString();
    if (props.modo === "pagamento") {
      const r = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: retorno },
        redirect: "if_required",
      });
      if (r.error) {
        setErro(r.error.message ?? props.textos.erro);
        setAEnviar(false);
        return;
      }
      await props.onConcluido(r.paymentIntent.id);
    } else {
      const r = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: retorno },
        redirect: "if_required",
      });
      if (r.error) {
        setErro(r.error.message ?? props.textos.erro);
        setAEnviar(false);
        return;
      }
      await props.onConcluido(r.setupIntent.id);
    }
    setAEnviar(false);
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      {props.children}
      <PaymentElement
        onReady={() => setPronto(true)}
        options={{
          layout: { type: "tabs", defaultCollapsed: false },
          wallets: { link: "never" },
          terms: { card: "never" },
        }}
      />
      {erro ? (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {erro}
        </div>
      ) : null}
      <Button type="submit" className="h-11 w-full bg-indigo-600 text-base text-white hover:bg-indigo-700" disabled={!stripe || !pronto || aEnviar}>
        {aEnviar ? <Loader2 className="animate-spin" /> : <Lock />}
        {aEnviar ? props.textos.aProcessar : props.textos.botao}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3" /> {props.textos.seguro}
      </p>
    </form>
  );
}
