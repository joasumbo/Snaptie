import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { metadadosPagina } from "@/lib/qr-metadata";
import QrScanPage, { qrScanInclude } from "@/components/qr/qr-scan-page";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ codigo: string }>;
}): Promise<Metadata> {
  const { codigo } = await params;
  const qr = await prisma.qrCode.findFirst({
    where: { codigo, publicado: true },
    select: {
      nome: true,
      descricao: true,
      imagemCapa: true,
      logo: true,
      company: { select: { nome: true, logo: true } },
    },
  });
  if (!qr) return { title: "Snaptie" };
  return metadadosPagina(qr);
}

export default async function ScanPage({
  params,
}: {
  params: Promise<{ empresa: string; codigo: string }>;
}) {
  const { empresa, codigo } = await params;

  const qr = await prisma.qrCode.findFirst({
    where: { codigo, publicado: true },
    include: qrScanInclude,
  });
  if (!qr) notFound();

  // Manter o URL canónico: /{empresa}/{codigo}, onde empresa é o slug da
  // empresa. Um código impresso com o slug errado continua a chegar aqui.
  if (qr.company.slug !== empresa) {
    redirect(`/${qr.company.slug}/${codigo}`);
  }

  return <QrScanPage qr={qr} />;
}
