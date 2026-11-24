import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Eye, Mail, Package, Pencil, Printer, QrCode, ShoppingBag, Truck } from "lucide-react";
import { modelosAVenda } from "@/lib/loja";
import { MAX_QUANTIDADE, produtosAVenda } from "@/lib/envios";
import { euros } from "@/lib/pagamentos";
import { comprar, comprarEnvio } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Loja · Snaptie",
  description: "Compre o seu Snaptie: pague online e receba por email o QR code e o acesso para editar a página.",
};

const PASSOS = [
  { icone: ShoppingBag, titulo: "Escolha e pague", texto: "Pagamento seguro com cartão ou MB WAY." },
  { icone: Mail, titulo: "Receba por email", texto: "O QR code em anexo e o link da sua página." },
  { icone: Pencil, titulo: "Personalize", texto: "Mude fotografias e textos com o código de edição." },
  { icone: Printer, titulo: "Imprima", texto: "PNG para imprimir em casa, SVG para a gráfica." },
];

export default async function LojaPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const [{ erro }, modelos, produtos] = await Promise.all([searchParams, modelosAVenda(), produtosAVenda()]);

  return (
    <main className="min-h-screen px-6 py-14">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Snaptie
        </Link>

        <header className="mt-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-card/60 px-3 py-1 text-sm text-muted-foreground backdrop-blur">
            <ShoppingBag className="size-4" />
            Loja
          </div>
          <h1 className="mt-6 bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
            Compre o seu Snaptie
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Escolha o modelo, pague aqui mesmo e receba logo por email o seu QR code, o link da página e o código para a
            editar. Não precisa de criar conta.
          </p>
        </header>

        <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PASSOS.map((p, i) => (
            <li key={p.titulo} className="flex gap-3 rounded-2xl border border-foreground/10 bg-card/60 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600">
                <p.icone className="size-4" />
              </span>
              <div>
                <div className="text-sm font-semibold">
                  {i + 1}. {p.titulo}
                </div>
                <div className="mt-0.5 text-sm text-muted-foreground">{p.texto}</div>
              </div>
            </li>
          ))}
        </ol>

        {erro ? (
          <p className="mt-8 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-600">
            Não foi possível começar a compra. Tente de novo dentro de alguns minutos.
          </p>
        ) : null}

        {modelos.length === 0 && produtos.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-foreground/15 p-10 text-center text-muted-foreground">
            <QrCode className="mx-auto size-8" />
            <p className="mt-3">Ainda não há produtos à venda. Volte em breve.</p>
          </div>
        ) : (
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {modelos.map((m) => (
              <article
                key={m.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-card/60 transition hover:border-foreground/20"
              >
                <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-indigo-500/10 to-indigo-500/0">
                  {m.imagem ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.imagem} alt="" className="size-full object-cover" />
                  ) : (
                    <QrCode className="size-12 text-indigo-600/70" />
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="font-semibold">{m.nome}</h2>
                  {m.descricao ? <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{m.descricao}</p> : <div className="flex-1" />}
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <span className="text-2xl font-semibold tracking-tight">{euros(m.precoCentimos, "eur")}</span>
                    <div className="flex gap-2">
                      {m.exemplo ? (
                        <a
                          href={m.exemplo}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-foreground/15 px-3 text-sm transition hover:bg-foreground/5"
                        >
                          <Eye className="size-4" />
                          Exemplo
                        </a>
                      ) : null}
                      <form action={comprar}>
                        <input type="hidden" name="modelo" value={m.id} />
                        <button
                          type="submit"
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition hover:bg-indigo-700"
                        >
                          Comprar
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {produtos.length > 0 ? (
          <section className="mt-16">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Truck className="size-4" />
              Enviamos por correio
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Produtos com o seu QR</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Pague aqui e enviamos para a morada que indicar, em Portugal. Os produtos com QR levam a sua página: recebe logo
              por email o link e o código para a editar.
            </p>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {produtos.map((p) => (
                <article
                  key={p.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-card/60 transition hover:border-foreground/20"
                >
                  <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-indigo-500/10 to-indigo-500/0">
                    {p.imagem ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imagem} alt={p.nome} className="size-full object-cover" />
                    ) : (
                      <Package className="size-12 text-indigo-600/70" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-semibold">{p.nome}</h3>
                    {p.descricao ? (
                      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{p.descricao}</p>
                    ) : (
                      <div className="flex-1" />
                    )}
                    <div className="mt-4 flex items-baseline justify-between gap-3">
                      <span className="text-2xl font-semibold tracking-tight">{euros(p.precoCentimos, "eur")}</span>
                      <span className="text-sm text-muted-foreground">
                        {p.portesCentimos ? `+ ${euros(p.portesCentimos, "eur")} de portes` : "Portes incluídos"}
                      </span>
                    </div>
                    {p.esgotado ? (
                      <div className="mt-4 rounded-lg bg-muted px-3 py-2 text-center text-sm text-muted-foreground">Esgotado</div>
                    ) : (
                      <form action={comprarEnvio} className="mt-4 flex gap-2">
                        <input type="hidden" name="produto" value={p.id} />
                        <select
                          name="quantidade"
                          aria-label="Quantidade"
                          defaultValue="1"
                          className="h-9 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm"
                        >
                          {Array.from({ length: MAX_QUANTIDADE }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                              {i + 1}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition hover:bg-indigo-700"
                        >
                          Comprar
                        </button>
                      </form>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <footer className="mt-20 border-t border-foreground/10 pt-8 text-sm text-muted-foreground">
          Precisa de vários QR codes para uma empresa?{" "}
          <Link href="/produtos" className="underline underline-offset-4">
            Veja o que pode fazer com o Snaptie
          </Link>{" "}
          ou fale connosco.
        </footer>
      </div>
    </main>
  );
}
