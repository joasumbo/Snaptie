import type { Metadata } from "next";

// O que aparece quando o link de uma página é partilhado (WhatsApp, Facebook,
// mensagens). Sem imagem própria, o WhatsApp ia buscar o ícone do site; agora
// mostra a capa da página, ou o logótipo dela, ou o da empresa.
export function metadadosPagina(p: {
  nome: string;
  descricao: string | null;
  imagemCapa?: string | null;
  logo?: string | null;
  company?: { nome: string; logo: string | null } | null;
}): Metadata {
  const imagem = p.imagemCapa || p.logo || p.company?.logo || null;
  const descricao = p.descricao || (p.company ? p.company.nome : undefined);
  return {
    title: p.nome,
    description: descricao,
    openGraph: {
      title: p.nome,
      description: descricao,
      siteName: "Snaptie",
      type: "website",
      // Sem imagem própria fica a imagem do Snaptie (app/opengraph-image).
      images: imagem ? [{ url: imagem }] : ["/opengraph-image"],
    },
    twitter: { card: imagem ? "summary_large_image" : "summary" },
  };
}
