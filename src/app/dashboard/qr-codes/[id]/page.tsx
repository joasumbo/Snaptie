import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import QrBuilder from "@/components/qr/qr-builder";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export default async function QrBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireRole(["ADMIN", "GESTOR_EMPRESA", "GESTOR_QR"]);
  const { id } = await params;

  const qr = await prisma.qrCode.findUnique({
    where: { id },
    include: {
      company: { select: { nome: true, logo: true, corPrimaria: true } },
      blocks: { orderBy: { ordem: "asc" } },
    },
  });
  if (!qr) notFound();
  if (actor.role !== "ADMIN" && qr.companyId !== actor.companyId) notFound();

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const publicUrl = `${proto}://${host}/s/${qr.slug}`;

  return (
    <QrBuilder
      qr={{
        id: qr.id,
        nome: qr.nome,
        slug: qr.slug,
        descricao: qr.descricao,
        corPrimaria: qr.corPrimaria,
        corSecundaria: qr.corSecundaria,
        logo: qr.logo,
        imagemCapa: qr.imagemCapa,
        logoTamanho: qr.logoTamanho,
        logoForma: qr.logoForma,
        nomeTamanho: qr.nomeTamanho,
        publicado: qr.publicado,
      }}
      company={{
        nome: qr.company.nome,
        logo: qr.company.logo,
        corPrimaria: qr.company.corPrimaria,
      }}
      blocks={qr.blocks.map((b) => ({
        id: b.id,
        tipo: b.tipo,
        titulo: b.titulo,
        cor: b.cor,
        descricao: b.descricao,
        conteudo: asRecord(b.conteudo),
        ativo: b.ativo,
        ordem: b.ordem,
      }))}
      publicUrl={publicUrl}
    />
  );
}
