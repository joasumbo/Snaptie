// Tipos do Snaptie Study, partilhados entre o servidor e o ecrã.

export const ETAPAS = ["Aprender", "Consolidar", "Completar", "Dominar"] as const;
export type Etapa = 0 | 1 | 2 | 3;

export const DESCRICAO_ETAPAS = [
  "Uma explicação curta de cada tema, com uma pergunta logo a seguir.",
  "Perguntas de escolha múltipla, um pouco mais difíceis.",
  "Frases da matéria com uma palavra em falta.",
  "Perguntas para responder por palavras tuas.",
] as const;

export type Conceito = { id: string; nome: string; ideia: string };

export type Plano = {
  disciplina: string;
  ano: string;
  tema: string;
  resumo: string;
  conceitos: Conceito[];
  ilegiveis: number[];
};

export type Gerada =
  | {
      tipo: "explicacao";
      titulo: string;
      explicacao: string;
      exemplo: string;
      pergunta: string;
      opcoes: string[];
      correta: number;
      porque: string;
    }
  | { tipo: "escolha"; pergunta: string; opcoes: string[]; correta: number; porque: string }
  | { tipo: "completar"; frase: string; resposta: string; aceites: string[]; dica: string; porque: string }
  | { tipo: "aberta"; pergunta: string; pontos: string[]; modelo: string };

export type TipoAtividade = Gerada["tipo"];

export type EstadoAtividade = "por_gerar" | "pronta" | "a_corrigir" | "corrigida" | "erro";

export type Atividade = {
  id: string;
  etapa: Etapa;
  tipo: TipoAtividade;
  conceitos: string[];
  extra?: boolean;
  estado: EstadoAtividade;
  tentativas?: number;
  dados?: Gerada;
  resposta?: string;
  certo?: boolean;
  parcial?: boolean;
  feedback?: string;
};

export type Progresso = {
  atividades: Atividade[];
  atual: number;
  // Etapa acabada cujo relatório o aluno ainda não fechou.
  pausa?: Etapa | null;
};

// O que o ecrã recebe: a atividade atual sem as respostas antes de o aluno
// responder, e um resumo das outras.
export type AtividadeVista = Omit<Atividade, "dados"> & { dados?: Partial<Gerada> & { tipo: TipoAtividade } };

export type VistaEstudo = {
  id: string;
  estado: "a_ler" | "a_planear" | "pronto" | "erro";
  paginas: number;
  lidas: number;
  erro: string | null;
  plano: Plano | null;
  atual: number;
  total: number;
  pausa: Etapa | null;
  atividade: AtividadeVista | null;
  resumo: { etapa: Etapa; conceitos: string[]; certo?: boolean; parcial?: boolean; respondida: boolean; extra?: boolean }[];
};
