import type { Metadata } from "next";
import QrScanPage from "@/components/qr/qr-scan-page";
import Landing from "@/components/landing";
import { findSitePage } from "@/lib/site-page";
import { metadadosPagina } from "@/lib/qr-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const pagina = await findSitePage("home");
  if (!pagina) return {};
  return metadadosPagina(pagina);
}

export default async function Home() {
  const pagina = await findSitePage("home");
  if (pagina) return <QrScanPage qr={pagina} />;
  return <Landing />;
}
