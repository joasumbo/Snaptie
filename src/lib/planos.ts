import type { Plano } from "@prisma/client";

// Os planos comerciais do Snaptie: Free, Base, Pro e Business.
//
// Na base de dados os valores continuam a ser STARTER e ENTERPRISE. Mudar o
// nome do enum obrigava a uma migração na base Neon, que é partilhada com a
// versão que ainda corre na Vercel — e essa, ao ler um valor que não conhece,
// rebentava. O nome comercial vive aqui; o valor guardado não precisa de mudar.
//
// Os limites e as funcionalidades são uma proposta a confirmar com o cliente.
// Estão todos neste ficheiro para que acertá-los seja mudar números, e não
// procurar condições espalhadas pelo código.

export type Funcionalidade = "serie" | "exportacao" | "idiomaFixo";

export type DefinicaoPlano = {
  nome: string;
  // Máximo de QR codes por empresa. null = sem limite.
  limiteQrs: number | null;
  funcionalidades: readonly Funcionalidade[];
  // O Business não tem tabela de preços: o preço e o limite de QRs acertam-se
  // com cada cliente e ficam guardados na subscrição da empresa.
  precoPersonalizado: boolean;
};

export const PLANOS: Record<Plano, DefinicaoPlano> = {
  FREE: {
    nome: "Free",
    limiteQrs: 3,
    funcionalidades: [],
    precoPersonalizado: false,
  },
  STARTER: {
    nome: "Base",
    limiteQrs: 20,
    funcionalidades: ["idiomaFixo"],
    precoPersonalizado: false,
  },
  PRO: {
    nome: "Pro",
    limiteQrs: 100,
    funcionalidades: ["idiomaFixo", "serie", "exportacao"],
    precoPersonalizado: false,
  },
  ENTERPRISE: {
    nome: "Business",
    limiteQrs: null,
    funcionalidades: ["idiomaFixo", "serie", "exportacao"],
    precoPersonalizado: true,
  },
};

export const ORDEM_PLANOS: Plano[] = ["FREE", "STARTER", "PRO", "ENTERPRISE"];

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
