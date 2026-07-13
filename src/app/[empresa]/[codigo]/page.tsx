import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { accessCookieName, hasAccess } from "@/lib/auth/qr-access";
import { type QrPageBlock } from "@/components/qr/qr-page";
import PublicQrView from "@/components/qr/public-qr-view";
import QrGate from "@/components/qr/qr-gate";

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
  params: Promise<{ codigo: string }>;
}): Promise<Metadata> {
  const { codigo } = await params;
  const qr = await prisma.qrCode.findFirst({
    where: { codigo, publicado: true },
    select: { nome: true, descricao: true },
  });
  if (!qr) return { title: "Snaptie" };
  return { title: qr.nome, description: qr.descricao ?? undefined };
}

export default async function ScanPage({
  params,
}: {
  params: Promise<{ empresa: string; codigo: string }>;
}) {
  const { empresa, codigo } = await params;

  const qr = await prisma.qrCode.findFirst({
    where: { codigo, publicado: true },
    include: {
      company: true,
      blocks: {
        where: { ativo: true },
        orderBy: { ordem: "asc" },
        // The wall shows the most recent messages; older ones stay in the
        // database but do not turn the page into an endless scroll.
        include: {
          mensagens: { orderBy: { createdAt: "desc" }, take: 30 },
        },
      },
    },
  });
  if (!qr) notFound();

  // Keep the URL canonical: /{empresa}/{codigo} where empresa is the company slug.
  if (qr.company.slug !== empresa) {
    redirect(`/${qr.company.slug}/${codigo}`);
  }

  // A QR that is not open stops here: the visitor sees the gate, and the scan is
  // not recorded, because the page was never shown.
  //   ativacao — open once someone activated it with the PIN
  //   privado  — open to whoever proved the PIN on this device
  if (qr.acessoModo === "ativacao" && !qr.ativadoEm) {
    return <QrGate codigo={qr.codigo ?? ""} modo="ativacao" nome={qr.nome} />;
  }
  if (qr.acessoModo === "privado") {
    const token = (await cookies()).get(accessCookieName(qr.id))?.value;
    if (!(await hasAccess(token, qr.id))) {
      return <QrGate codigo={qr.codigo ?? ""} modo="privado" nome={qr.nome} />;
    }
  }

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
    editavelPublico: b.editavelPublico,
    mensagens: b.mensagens.map((m) => ({
      id: m.id,
      nome: m.nome,
      mensagem: m.mensagem,
      createdAt: m.createdAt.toISOString(),
    })),
  }));

  return (
    <main className="min-h-screen">
      <PublicQrView
        codigo={qr.codigo ?? ""}
        edicaoPublica={qr.edicaoPublica}
        edicaoPersonalizacao={qr.edicaoPersonalizacao}
        data={{
          nome: qr.nome,
          descricao: qr.descricao,
          logo: qr.logo ?? qr.company.logo,
          imagemCapa: qr.imagemCapa,
          logoTamanho: qr.logoTamanho,
          logoForma: qr.logoForma,
          nomeTamanho: qr.nomeTamanho,
          mostrarLogo: qr.mostrarLogo,
          mostrarNome: qr.mostrarNome,
          corPrimaria: qr.corPrimaria ?? qr.company.corPrimaria,
          companyNome: qr.company.nome,
          blocks,
        }}
      />
    </main>
  );
}
