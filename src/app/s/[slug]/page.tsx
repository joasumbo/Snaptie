import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function conteudoToString(value: unknown): string {
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.url === "string") return obj.url;
    if (typeof obj.texto === "string") return obj.texto;
  }
  return "";
}

function detectDevice(ua: string): string {
  return /mobile|android|iphone|ipad/i.test(ua) ? "Telemóvel" : "Computador";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const qr = await prisma.qrCode.findFirst({
    where: { slug, publicado: true },
    select: { nome: true, descricao: true },
  });
  if (!qr) return { title: "Snaptie" };
  return { title: qr.nome, description: qr.descricao ?? undefined };
}

export default async function ScanPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const qr = await prisma.qrCode.findFirst({
    where: { slug, publicado: true },
    include: {
      company: true,
      blocks: { where: { ativo: true }, orderBy: { ordem: "asc" } },
    },
  });
  if (!qr) notFound();

  // Record the scan. Failures here must not break the visitor's page.
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null;
  const idioma = (h.get("accept-language") ?? "").split(",")[0]?.trim() || null;
  try {
    await prisma.$transaction([
      prisma.qrCode.update({
        where: { id: qr.id },
        data: { scansTotal: { increment: 1 }, ultimoScan: new Date() },
      }),
      prisma.analytics.create({
        data: {
          qrId: qr.id,
          dispositivo: detectDevice(ua),
          navegador: ua.slice(0, 255) || null,
          idioma,
          ip,
        },
      }),
    ]);
  } catch {
    // ignore analytics failures
  }

  const primary = qr.corPrimaria ?? qr.company.corPrimaria ?? "#6366f1";

  return (
    <main
      className="min-h-screen px-5 py-12"
      style={{
        background: `radial-gradient(120% 60% at 50% 0%, ${primary}22, transparent 60%)`,
      }}
    >
      <div className="mx-auto flex max-w-md flex-col items-center text-center duration-700 animate-in fade-in">
        {qr.company.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr.company.logo}
            alt={qr.company.nome}
            className="mb-4 max-h-16 object-contain"
          />
        ) : (
          <div
            className="mb-4 flex size-14 items-center justify-center rounded-2xl text-xl font-bold text-white"
            style={{ backgroundColor: primary }}
          >
            {qr.company.nome.charAt(0)}
          </div>
        )}

        <h1 className="text-xl font-semibold">{qr.nome}</h1>
        {qr.descricao ? (
          <p className="mt-1 text-sm text-muted-foreground">{qr.descricao}</p>
        ) : null}

        <div className="mt-8 flex w-full flex-col gap-3">
          {qr.blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem conteúdos.</p>
          ) : (
            qr.blocks.map((block, i) => {
              const content = conteudoToString(block.conteudo);
              const delay = { animationDelay: `${i * 70}ms` } as const;
              if (block.tipo === "TEXTO") {
                return (
                  <div
                    key={block.id}
                    style={delay}
                    className="rounded-xl border bg-card p-4 text-left duration-500 animate-in fade-in slide-in-from-bottom-3"
                  >
                    <div className="font-medium">{block.titulo}</div>
                    <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                      {content}
                    </p>
                  </div>
                );
              }
              return (
                <a
                  key={block.id}
                  href={content}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl px-4 py-3 font-medium text-white shadow-sm duration-500 animate-in fade-in slide-in-from-bottom-3 hover:scale-[1.02] transition-transform"
                  style={{ backgroundColor: primary, ...delay }}
                >
                  {block.titulo}
                </a>
              );
            })
          )}
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          Powered by Snaptie
        </p>
      </div>
    </main>
  );
}
