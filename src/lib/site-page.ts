import { prisma } from "@/lib/prisma";
import { qrScanInclude } from "@/components/qr/qr-scan-page";

// As páginas do próprio site — a inicial e a dos produtos — são Snapties como
// os outros, geridos no painel pela empresa abaixo. Assim o conteúdo muda sem
// passar por uma alteração de código.
//
// A ligação é por convenção de slug, e não por uma coluna nova: dentro desta
// empresa, o QR com slug "home" alimenta mysnaptie.com e o "produtos" alimenta
// mysnaptie.com/produtos.
export const SITE_COMPANY_SLUG = "snaptie-admin";

export type SitePageSlug = "home" | "produtos";

// Devolve null quando o QR não existe ou não está publicado — e nesse caso a
// rota mostra a página original. Sem esta salvaguarda, despublicar por engano
// deixava a entrada do site em branco.
export async function findSitePage(slug: SitePageSlug) {
  return prisma.qrCode.findFirst({
    where: {
      slug,
      publicado: true,
      company: { slug: SITE_COMPANY_SLUG, deletedAt: null },
    },
    include: qrScanInclude,
  });
}
