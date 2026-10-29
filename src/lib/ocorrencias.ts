import "server-only";

import { prisma } from "@/lib/prisma";
import { estadoManutencao, imagensDaMensagem } from "@/lib/qr";
import { gerarXlsx, type Celula } from "@/lib/xlsx";

// As ocorrências de manutenção de uma empresa (ou de todas), lidas num só
// sítio: o botão do painel, o elemento "Lista de ocorrências" da página e o
// Excel que ele descarrega mostram exatamente o mesmo.

export type Ocorrencia = {
  id: string;
  data: Date;
  empresa: string;
  loja: string;
  mural: string;
  nome: string;
  mensagem: string;
  estado: string;
  imagens: number;
};

export async function lerOcorrencias(companyId: string | null, limite?: number): Promise<Ocorrencia[]> {
  const mensagens = await prisma.qrMessage.findMany({
    where: { block: { tipo: "MANUTENCAO", qr: companyId ? { companyId } : {} } },
    orderBy: { createdAt: "desc" },
    take: limite,
    select: {
      id: true,
      nome: true,
      mensagem: true,
      estado: true,
      imagem: true,
      imagens: true,
      createdAt: true,
      block: { select: { titulo: true, qr: { select: { nome: true, company: { select: { nome: true } } } } } },
    },
  });
  return mensagens.map((m) => ({
    id: m.id,
    data: m.createdAt,
    empresa: m.block.qr.company.nome,
    loja: m.block.qr.nome,
    mural: m.block.titulo || "Manutenção",
    nome: m.nome,
    mensagem: m.mensagem,
    estado: estadoManutencao(m.estado).valor,
    imagens: imagensDaMensagem(m).length,
  }));
}

// Com todas as empresas, a empresa vai numa coluna própria.
export function ocorrenciasXlsx(lista: Ocorrencia[], comEmpresa: boolean): Uint8Array {
  return gerarXlsx({
    folha: "Ocorrências",
    colunas: [
      { titulo: "Data", largura: 17 },
      ...(comEmpresa ? [{ titulo: "Empresa", largura: 20 }] : []),
      { titulo: "Loja / QR", largura: 24 },
      { titulo: "Mural", largura: 18 },
      { titulo: "Nome", largura: 20 },
      { titulo: "Mensagem", largura: 60 },
      { titulo: "Estado", largura: 14 },
      { titulo: "Imagens", largura: 9 },
    ],
    linhas: lista.map((o): Celula[] => [
      o.data,
      ...(comEmpresa ? [o.empresa] : []),
      o.loja,
      o.mural,
      o.nome,
      o.mensagem,
      estadoManutencao(o.estado).rotulo,
      // Sem as fotos, como pedido; fica só quantas tem, para saber onde há.
      o.imagens,
    ]),
  });
}

export function respostaXlsx(xlsx: Uint8Array, nome: string): Response {
  const dia = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(xlsx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ocorrencias-${nome}-${dia}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
