import Link from "next/link";
import type { Metadata } from "next";
import * as Icons from "lucide-react";
import { ArrowLeft, ArrowRight, QrCode } from "lucide-react";
import { CATEGORIAS, TOTAL_PRODUTOS, type Categoria } from "@/lib/produtos";
import QrScanPage from "@/components/qr/qr-scan-page";
import { findSitePage } from "@/lib/site-page";

export const dynamic = "force-dynamic";

const METADATA_CATALOGO: Metadata = {
  title: "Produtos — Snaptie",
  description:
    "O que podes fazer com um QR code Snaptie: souvenirs, eventos, hotelaria, restauração, empresas, emergência e mais.",
};

export async function generateMetadata(): Promise<Metadata> {
  const pagina = await findSitePage("produtos");
  if (!pagina) return METADATA_CATALOGO;
  return { title: pagina.nome, description: pagina.descricao ?? undefined };
}

// O catálogo usa nomes de ícones em texto para que a lista de produtos continue
// a ser dados simples. Se um nome não existir, cai no ícone genérico em vez de
// rebentar a página.
function CategoryIcon({ nome, className }: { nome: string; className?: string }) {
  const icons = Icons as unknown as Record<
    string,
    React.ComponentType<{ className?: string }>
  >;
  const Icon = icons[nome] ?? QrCode;
  return <Icon className={className} />;
}

function CategoriaSection({ categoria }: { categoria: Categoria }) {
  return (
    <section id={categoria.slug} className="scroll-mt-24">
      <div className="flex items-center gap-3">
        <span
          className="flex size-11 items-center justify-center rounded-2xl text-white"
          style={{ backgroundColor: categoria.cor }}
        >
          <CategoryIcon nome={categoria.icone} className="size-5" />
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {categoria.nome}
          </h2>
          <p className="text-sm text-muted-foreground">{categoria.descricao}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categoria.produtos.map((produto) => (
          <article
            key={produto.slug}
            className="flex flex-col rounded-2xl border border-foreground/10 bg-card/60 p-5 backdrop-blur transition hover:border-foreground/20"
          >
            <span
              className="flex size-9 items-center justify-center rounded-xl"
              style={{
                backgroundColor: `${categoria.cor}1a`,
                color: categoria.cor,
              }}
            >
              <CategoryIcon nome={categoria.icone} className="size-4" />
            </span>

            <h3 className="mt-4 font-medium">{produto.nome}</h3>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">
              {produto.descricao}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {produto.demo ? (
                <Link
                  href={`/demo/${produto.demo}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-foreground/15 px-3 py-1.5 text-sm transition hover:border-foreground/30"
                >
                  Ver exemplo
                  <ArrowRight className="size-3.5" />
                </Link>
              ) : null}
              <Link
                href={`/login?next=${encodeURIComponent("/dashboard/qr-codes")}`}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground"
              >
                Criar este Snaptie
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default async function ProdutosPage() {
  // Gerida no painel pela snaptie-admin; sem ela, mostra o catálogo de origem.
  const pagina = await findSitePage("produtos");
  if (pagina) return <QrScanPage qr={pagina} />;
  return <Catalogo />;
}

function Catalogo() {
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
            <QrCode className="size-4" />
            {TOTAL_PRODUTOS} formas de usar um QR
          </div>
          <h1 className="mt-6 bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
            Produtos Snaptie
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Um único código substitui um folheto, uma placa de receção ou uma
            etiqueta — e o conteúdo muda a qualquer momento, sem reimprimir nada.
          </p>
        </header>

        <nav className="mt-8 flex flex-wrap gap-2">
          {CATEGORIAS.map((c) => (
            <a
              key={c.slug}
              href={`#${c.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 px-3 py-1.5 text-sm text-muted-foreground transition hover:border-foreground/25 hover:text-foreground"
            >
              <CategoryIcon nome={c.icone} className="size-3.5" />
              {c.nome}
            </a>
          ))}
        </nav>

        <div className="mt-14 space-y-14">
          {CATEGORIAS.map((c) => (
            <CategoriaSection key={c.slug} categoria={c} />
          ))}
        </div>

        <footer className="mt-20 border-t border-foreground/10 pt-8 text-sm text-muted-foreground">
          Não encontras o teu caso?{" "}
          <Link href="/login" className="underline underline-offset-4">
            Entra e cria a tua página
          </Link>{" "}
          — todos estes produtos usam os mesmos blocos.
        </footer>
      </div>
    </main>
  );
}
