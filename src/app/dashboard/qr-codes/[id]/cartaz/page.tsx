import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { baseUrl, publicUrl } from "@/lib/qr-export";
import { lerCartaz } from "@/lib/cartaz-render";
import CartazEditor from "@/components/qr/cartaz-editor";

export default async function CartazPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRole(["ADMIN", "GESTOR_EMPRESA", "GESTOR_QR"]);
  const { id } = await params;

  const qr = await prisma.qrCode.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      codigo: true,
      lote: true,
      companyId: true,
      corPrimaria: true,
      cartaz: true,
      company: { select: { nome: true, slug: true, logo: true } },
    },
  });
  if (!qr) notFound();
  if (actor.role !== "ADMIN" && qr.companyId !== actor.companyId) notFound();

  const cor = qr.corPrimaria && /^#[0-9a-fA-F]{6}$/.test(qr.corPrimaria) ? qr.corPrimaria : "#18181b";
  const link = publicUrl(await baseUrl(), qr.company.slug, qr.codigo);
  const [totalLote, totalEmpresa] = await Promise.all([
    qr.lote ? prisma.qrCode.count({ where: { lote: qr.lote, companyId: qr.companyId } }) : 0,
    prisma.qrCode.count({ where: { companyId: qr.companyId } }),
  ]);

  return (
    <CartazEditor
      qr={{ id: qr.id, nome: qr.nome, lote: qr.lote, companyId: qr.companyId }}
      inicial={lerCartaz(qr.cartaz, { cor, logo: qr.company.logo })}
      cor={cor}
      logo={qr.company.logo}
      variaveis={{ nome: qr.nome, empresa: qr.company.nome, link, codigo: qr.codigo ?? "" }}
      totalLote={totalLote}
      totalEmpresa={totalEmpresa}
    />
  );
}
