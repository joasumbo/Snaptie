import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Legacy public URL. QRs are now served at /{empresa}/{codigo}; redirect old
// links (and QR images already printed) to the canonical address.
export default async function LegacyScanPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const qr = await prisma.qrCode.findFirst({
    where: { slug, publicado: true },
    select: { codigo: true, company: { select: { slug: true } } },
  });
  if (!qr?.codigo) notFound();
  redirect(`/${qr.company.slug}/${qr.codigo}`);
}
