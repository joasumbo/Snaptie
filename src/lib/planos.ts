import type { Plano } from "@prisma/client";

// Os planos comerciais do Snaptie, como estão na tabela de preços:
//
//   Free        0 €        1 QR      100 MB
//   Base        4,90 €     5 QR      1 GB
//   Pro         19,90 €    100 QR    10 GB
//   Business    39,90 €    300 QR    30 GB
//   Enterprise  negociado  personalizado
//
// Na base de dados o Base continua a chamar-se STARTER. Os limites, os preços
// e as funcionalidades estão todos aqui: acertá-los é mudar números neste
// ficheiro, e não procurar condições espalhadas pelo código.

export type Funcionalidade = "serie" | "exportacao" | "idiomaFixo";

export type DefinicaoPlano = {
  nome: string;
  // Preço de tabela por mês, em cêntimos. null = negociado.
  precoMensalCentimos: number | null;
  // Máximo de QR codes por empresa. null = sem limite (ou acertado à parte).
  limiteQrs: number | null;
  // Espaço para fotografias, vídeos e PDFs, em MB. null = sem limite.
  armazenamentoMb: number | null;
  funcionalidades: readonly Funcionalidade[];
  // O Enterprise não tem tabela de preços: o preço e o limite de QRs acertam-se
  // com cada cliente e ficam guardados na subscrição da empresa.
  precoPersonalizado: boolean;
};

const GB = 1024;

export const PLANOS: Record<Plano, DefinicaoPlano> = {
  FREE: {
    nome: "Free",
    precoMensalCentimos: 0,
    limiteQrs: 1,
    armazenamentoMb: 100,
    funcionalidades: [],
    precoPersonalizado: false,
  },
  STARTER: {
    nome: "Base",
    precoMensalCentimos: 490,
    limiteQrs: 5,
    armazenamentoMb: 1 * GB,
    funcionalidades: ["idiomaFixo"],
    precoPersonalizado: false,
  },
  PRO: {
    nome: "Pro",
    precoMensalCentimos: 1990,
    limiteQrs: 100,
    armazenamentoMb: 10 * GB,
    funcionalidades: ["idiomaFixo", "serie", "exportacao"],
    precoPersonalizado: false,
  },
  BUSINESS: {
    nome: "Business",
    precoMensalCentimos: 3990,
    limiteQrs: 300,
    armazenamentoMb: 30 * GB,
    funcionalidades: ["idiomaFixo", "serie", "exportacao"],
    precoPersonalizado: false,
  },
  ENTERPRISE: {
    nome: "Enterprise",
    precoMensalCentimos: null,
    limiteQrs: null,
    armazenamentoMb: null,
    funcionalidades: ["idiomaFixo", "serie", "exportacao"],
    precoPersonalizado: true,
  },
};

export const ORDEM_PLANOS: Plano[] = ["FREE", "STARTER", "PRO", "BUSINESS", "ENTERPRISE"];

// Os planos que um pacote pago pode dar.
export const PLANOS_PAGOS: Plano[] = ["STARTER", "PRO", "BUSINESS", "ENTERPRISE"];

export const NOMES_FUNCIONALIDADES: Record<Funcionalidade, string> = {
  serie: "Criação em série",
  exportacao: "Exportação",
  idiomaFixo: "Idioma fixo da página",
};

export function temFuncionalidade(plano: Plano, f: Funcionalidade): boolean {
  return PLANOS[plano].funcionalidades.includes(f);
}

// O plano mais barato que inclui a funcionalidade, para a mensagem dizer ao
// cliente o que tem de mudar em vez de só lhe dizer que não pode.
export function planoMinimo(f: Funcionalidade): string {
  const plano = ORDEM_PLANOS.find((p) => temFuncionalidade(p, f));
  return plano ? PLANOS[plano].nome : PLANOS.ENTERPRISE.nome;
}

export function mensagemSemFuncionalidade(f: Funcionalidade): string {
  return `${NOMES_FUNCIONALIDADES[f]} está disponível a partir do plano ${planoMinimo(f)}.`;
}

// 100 MB, 1 GB, 30 GB...
export function textoEspaco(mb: number | null): string {
  if (mb == null) return "Personalizado";
  if (mb >= GB) return `${Number((mb / GB).toFixed(1)).toLocaleString("pt-PT")} GB`;
  return `${Math.round(mb).toLocaleString("pt-PT")} MB`;
}

export function textoPreco(p: DefinicaoPlano): string {
  if (p.precoMensalCentimos == null) return "Negociado";
  if (p.precoMensalCentimos === 0) return "0 €";
  return `${(p.precoMensalCentimos / 100).toFixed(2).replace(".", ",")} €/mês`;
}

// Resumo de uma linha, para formulários e listas.
export function resumoPlano(plano: Plano): string {
  const p = PLANOS[plano];
  if (p.precoPersonalizado) return "Preço, QR codes e espaço acertados com o cliente.";
  return `${textoPreco(p)} · até ${p.limiteQrs} QR ${p.limiteQrs === 1 ? "code" : "codes"} · ${textoEspaco(p.armazenamentoMb)} de espaço`;
}
