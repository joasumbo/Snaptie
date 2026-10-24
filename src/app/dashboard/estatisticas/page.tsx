import { requireRole } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { obterEstatisticas, periodoValido, PERIODOS } from "@/lib/estatisticas";
import EstatisticasView from "@/components/estatisticas/estatisticas-view";

export const dynamic = "force-dynamic";

export default async function EstatisticasPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; qr?: string; empresa?: string }>;
}) {
  const actor = await requireRole(["ADMIN", "GESTOR_EMPRESA", "GESTOR_QR"]);
  const sp = await searchParams;
  const periodo = periodoValido(sp.periodo);
  const isAdmin = actor.role === "ADMIN";

  // O gestor vê sempre a sua empresa, diga o endereço o que disser. O
  // administrador escolhe uma empresa, ou vê a plataforma toda.
  // Um gestor sem empresa não vê nada — nunca "tudo", que é o que um null
  // significaria nas contas.
  // O atalho "Estatísticas deste QR" só leva o QR; a empresa tira-se dele.
  const empresaDoQr =
    isAdmin && !sp.empresa && sp.qr
      ? (await prisma.qrCode.findUnique({ where: { id: sp.qr }, select: { companyId: true } }))?.companyId
      : null;
  const companyId = isAdmin
    ? (sp.empresa || empresaDoQr || null)
    : (actor.companyId ?? "__nenhuma__");

  const [empresas, qrs] = await Promise.all([
    isAdmin
      ? prisma.company.findMany({ where: { deletedAt: null }, select: { id: true, nome: true }, orderBy: { nome: "asc" } })
      : Promise.resolve([]),
    companyId
      ? prisma.qrCode.findMany({ where: { companyId }, select: { id: true, nome: true }, orderBy: { nome: "asc" } })
      : Promise.resolve([]),
  ]);

  // Um QR só conta se for da empresa em causa; um id de outra empresa no
  // endereço é ignorado em vez de mostrar números que não são dele.
  const qrId = sp.qr && qrs.some((q) => q.id === sp.qr) ? sp.qr : null;

  const dados = await obterEstatisticas(periodo, { companyId: companyId ?? null, qrId });

  return (
    <EstatisticasView
      dados={dados}
      periodo={periodo}
      periodos={Object.entries(PERIODOS).map(([id, p]) => ({ id, nome: p.nome }))}
      unidade={PERIODOS[periodo].unidade}
      isAdmin={isAdmin}
      empresas={empresas}
      empresaId={companyId}
      qrs={qrs}
      qrId={qrId}
    />
  );
}
