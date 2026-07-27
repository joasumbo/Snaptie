import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// A página pública da empresa: /{empresa}. Lista os QR codes que qualquer
// pessoa pode abrir, para que uma empresa tenha um endereço próprio para
// partilhar sem depender do código de um QR específico.
async function findCompany(slug: string) {
  return prisma.company.findFirst({
    where: { slug, deletedAt: null },
    select: {
      nome: true,
      slug: true,
      logo: true,
      website: true,
      corPrimaria: true,
      qrCodes: {
        // Só entram os que estão realmente abertos. Um QR em modo "privado"
        // pede PIN em cada visita e um em modo "ativacao" ainda por activar
        // não deve ser anunciado — listá-los aqui contornaria a barreira que
        // o dono lhes pôs de propósito.
        where: {
          publicado: true,
          OR: [
            { acessoModo: "aberto" },
            { acessoModo: "ativacao", ativadoEm: { not: null } },
          ],
          codigo: { not: null },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          nome: true,
          descricao: true,
          codigo: true,
          logo: true,
          imagemCapa: true,
        },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ empresa: string }>;
}): Promise<Metadata> {
  const { empresa } = await params;
  const company = await findCompany(empresa);
  if (!company) return { title: "Snaptie" };
  return {
    title: company.nome,
    description: `Páginas de ${company.nome} no Snaptie.`,
  };
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ empresa: string }>;
}) {
  const { empresa } = await params;
  const company = await findCompany(empresa);
  if (!company) notFound();

  const primary = company.corPrimaria || "#6366f1";

  return (
    <div
      className="min-h-full bg-white"
      style={{
        background: `radial-gradient(120% 55% at 50% 0%, ${primary}22, #ffffff 60%)`,
      }}
    >
      <div className="mx-auto flex max-w-md flex-col items-center px-5 py-10 text-center">
        {company.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.logo}
            alt={company.nome}
            className="h-20 w-20 rounded-full object-cover shadow-sm"
          />
        ) : (
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white shadow-sm"
            style={{ backgroundColor: primary }}
          >
            {company.nome.charAt(0)}
          </div>
        )}

        <h1 className="mt-4 text-2xl font-semibold text-zinc-900">
          {company.nome}
        </h1>

        {company.website ? (
          <a
            href={company.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 text-sm text-zinc-500 underline-offset-4 hover:underline"
          >
            {company.website.replace(/^https?:\/\//, "")}
          </a>
        ) : null}

        <div className="mt-8 flex w-full flex-col gap-3">
          {company.qrCodes.length === 0 ? (
            <p className="text-sm text-zinc-400">
              Ainda não há páginas publicadas.
            </p>
          ) : (
            company.qrCodes.map((qr) => (
              <Link
                key={qr.id}
                href={`/${company.slug}/${qr.codigo}`}
                className="flex items-center gap-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-3 text-left shadow-sm transition hover:border-zinc-300 hover:shadow"
              >
                {qr.logo || qr.imagemCapa ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qr.logo ?? qr.imagemCapa ?? ""}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
                    style={{ backgroundColor: primary }}
                  >
                    {qr.nome.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-900">{qr.nome}</p>
                  {qr.descricao ? (
                    <p className="truncate text-sm text-zinc-500">
                      {qr.descricao}
                    </p>
                  ) : null}
                </div>
              </Link>
            ))
          )}
        </div>

        <Link
          href="/"
          className="mt-10 text-xs text-zinc-400 underline-offset-4 hover:text-zinc-600 hover:underline"
        >
          Powered by Snaptie
        </Link>
      </div>
    </div>
  );
}
