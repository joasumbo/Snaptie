import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import QrBuilder from "@/components/qr/qr-builder";

function conteudoToString(value: unknown): string {
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.url === "string") return obj.url;
    if (typeof obj.texto === "string") return obj.texto;
  }
  return "";
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
    include: { blocks: { orderBy: { ordem: "asc" } } },
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
        publicado: qr.publicado,
      }}
      blocks={qr.blocks.map((b) => ({
        id: b.id,
        tipo: b.tipo,
        titulo: b.titulo,
        conteudo: conteudoToString(b.conteudo),
        ativo: b.ativo,
        ordem: b.ordem,
      }))}
      publicUrl={publicUrl}
    />
  );
}
