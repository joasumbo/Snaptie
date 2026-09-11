import { cookies, headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { accessCookieName, hasAccess } from "@/lib/auth/qr-access";
import { type QrPageBlock } from "@/components/qr/qr-page";
import PublicQrView from "@/components/qr/public-qr-view";
import QrGate from "@/components/qr/qr-gate";

// A consulta que traz tudo o que uma página pública precisa. Exportada para que
// as rotas possam usar exatamente a mesma forma de dados.
export const qrScanInclude = {
  company: true,
  blocks: {
    where: { ativo: true },
    orderBy: { ordem: "asc" as const },
    include: {
      mensagens: { orderBy: { createdAt: "desc" as const }, take: 30 },
    },
  },
} as const;

export type QrComRelacoes = Prisma.QrCodeGetPayload<{
  include: typeof qrScanInclude;
}>;

function detectDevice(ua: string): string {
  return /mobile|android|iphone|ipad/i.test(ua) ? "Telemóvel" : "Computador";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

// O que acontece quando alguém abre uma página de QR: barreira de acesso,
// registo do scan e render. Vive aqui, e não numa rota, porque duas rotas
// mostram a mesma página — /{empresa}/{codigo} e /{empresa}, esta última
// quando a empresa tem uma página principal.
export default async function QrScanPage({ qr }: { qr: QrComRelacoes }) {
  // Um QR fechado pára aqui: o visitante vê a barreira e o scan não é
  // registado, porque a página nunca chegou a ser mostrada.
  if (qr.acessoModo === "ativacao" && !qr.ativadoEm) {
    return <QrGate codigo={qr.codigo ?? ""} modo="ativacao" nome={qr.nome} />;
  }
  if (qr.acessoModo === "privado") {
    const token = (await cookies()).get(accessCookieName(qr.id))?.value;
    if (!(await hasAccess(token, qr.id))) {
      return <QrGate codigo={qr.codigo ?? ""} modo="privado" nome={qr.nome} />;
    }
  }

  // Registar o scan. Uma falha aqui não pode partir a página do visitante.
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
    // analítica não é crítica
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
      imagem: m.imagem,
      estado: m.estado,
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
