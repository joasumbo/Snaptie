import type { Metadata } from "next";
import QrScanPage from "@/components/qr/qr-scan-page";
import Landing from "@/components/landing";
import { findSitePage } from "@/lib/site-page";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const pagina = await findSitePage("home");
  if (!pagina) return {};
  return { title: pagina.nome, description: pagina.descricao ?? undefined };
}

export default async function Home() {
  const pagina = await findSitePage("home");
  if (pagina) return <QrScanPage qr={pagina} />;
  return <Landing />;
}
