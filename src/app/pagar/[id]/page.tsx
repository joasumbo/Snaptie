import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { lerPagamentoParaPagar } from "@/lib/stripe-pagamentos";
import PaginaPagar from "./pagina-pagar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pagamento · Snaptie",
  robots: { index: false, follow: false },
};

export default async function PagarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/.test(id)) notFound();
  const dados = await lerPagamentoParaPagar(id).catch(() => null);
  if (!dados) notFound();

  const t = await getTranslations("Pagar");
  const locale = await getLocale();
  const valor = new Intl.NumberFormat(locale, { style: "currency", currency: dados.moeda.toUpperCase() }).format(
    dados.valorCentimos / 100,
  );
  const periodo = dados.intervalo === "mes" ? t("perMonth") : dados.intervalo === "ano" ? t("perYear") : "";

  return (
    <main className="relative flex min-h-screen flex-col items-center bg-gradient-to-b from-indigo-50/70 via-white to-white px-4 py-10">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="mb-8">
        <Logo markClassName="size-7" />
      </div>

      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl shadow-indigo-950/5 ring-1 ring-zinc-900/10 sm:p-8">
        <div className="text-sm text-zinc-500">{dados.empresa ?? "Snaptie"}</div>
        <h1 className="mt-1 text-lg font-semibold text-zinc-900">{dados.descricao || t("title")}</h1>
        <div className="mt-4 flex items-baseline gap-2 border-b border-zinc-100 pb-5">
          <span className="text-3xl font-semibold tracking-tight text-zinc-900">{valor}</span>
          {periodo ? <span className="text-sm text-zinc-500">{periodo}</span> : null}
        </div>

        <div className="mt-6">
          <PaginaPagar
            id={dados.id}
            estado={dados.estado}
            clientSecret={dados.clientSecret}
            chavePublica={process.env.STRIPE_PUBLISHABLE_KEY ?? ""}
            locale={locale}
            retorno={dados.retorno}
            pedeDados={dados.tipo === "botao" || dados.tipo === "link"}
            fatura={dados.fatura}
            dados={{
              email: dados.email ?? "",
              nome: dados.nomeCliente ?? "",
              nif: dados.nifCliente ?? "",
              morada: dados.moradaCliente ?? "",
              codigoPostal: dados.cpCliente ?? "",
              cidade: dados.cidadeCliente ?? "",
            }}
            textos={{
              botao: periodo ? t("subscribe", { valor }) : t("pay", { valor }),
              aProcessar: t("processing"),
              seguro: t("secure"),
              erro: t("error"),
              pagoTitulo: t("paidTitle"),
              pagoTexto: t("paidText"),
              pendente: t("pending"),
              expirado: t("expired"),
              voltar: t("back"),
              email: t("email"),
              emailHint: t("emailHint"),
              nome: t("name"),
              nif: t("nif"),
              morada: t("address"),
              codigoPostal: t("postcode"),
              cidade: t("city"),
              opcional: t("optional"),
              comprovativo: t("receipt"),
              fatura: t("invoice"),
              enviadoPara: t("sentInvoice", { email: "{email}" }),
              passo1: t("step1"),
              passo2: t("step2"),
              continuar: t("next"),
              alterar: t("change"),
              faturaEm: t("invoiceTo"),
              nifDica: t("nifHint"),
              erros: {
                email: t("emailInvalid"),
                nome: t("nameRequired"),
                nif: t("nifInvalid"),
                codigoPostal: t("postcodeInvalid"),
                geral: t("error"),
              },
            }}
          />
        </div>
      </div>
      <p className="mt-6 text-xs text-zinc-400">mysnaptie.com</p>
    </main>
  );
}
