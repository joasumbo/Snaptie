import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { QrPage, type QrPageBlock } from "@/components/qr/qr-page";

export const dynamic = "force-dynamic";

function detectDevice(ua: string): string {
  return /mobile|android|iphone|ipad/i.test(ua) ? "Telemóvel" : "Computador";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
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

  const blocks: QrPageBlock[] = qr.blocks.map((b) => ({
    id: b.id,
    tipo: b.tipo,
    titulo: b.titulo,
    cor: b.cor,
    descricao: b.descricao,
    conteudo: asRecord(b.conteudo),
  }));

  return (
    <main className="min-h-screen">
      <QrPage
        data={{
          nome: qr.nome,
          descricao: qr.descricao,
          logo: qr.logo ?? qr.company.logo,
          imagemCapa: qr.imagemCapa,
          logoTamanho: qr.logoTamanho,
          logoForma: qr.logoForma,
          nomeTamanho: qr.nomeTamanho,
          corPrimaria: qr.corPrimaria ?? qr.company.corPrimaria,
          companyNome: qr.company.nome,
          blocks,
        }}
      />
    </main>
  );
}
