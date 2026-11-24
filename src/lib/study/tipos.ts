// Tipos do Snaptie Study, partilhados entre o servidor e o ecrã.

export const ETAPAS = ["Aprender", "Consolidar", "Completar", "Dominar"] as const;
export type Etapa = 0 | 1 | 2 | 3;

export const DESCRICAO_ETAPAS = [
  "Uma explicação curta de cada tema, com uma pergunta logo a seguir.",
  "Perguntas de escolha múltipla, cada vez mais difíceis.",
  "Frases da matéria com uma palavra em falta.",
  "Perguntas para responder por palavras tuas.",
] as const;

// 1 fácil (reconhecer), 2 médio (compreender, comparar), 3 difícil (aplicar, relacionar).
export type Nivel = 1 | 2 | 3;

// peso: 1 ideia simples, 2 várias informações, 3 complexo ou muito para memorizar.
export type Conceito = { id: string; nome: string; ideia: string; peso: Nivel; imagem?: string };

export type Plano = {
  disciplina: string;
  ano: string;
  tema: string;
  resumo: string;
  conceitos: Conceito[];
  ilegiveis: number[];
};

export type Imagem = { url: string; pagina: string; legenda: string; autor: string; licenca: string };

export type Gerada =
  | {
      tipo: "explicacao";
      titulo: string;
      explicacao: string;
      exemplo: string;
      imagem?: Imagem | null;
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
  nivel: Nivel;
  extra?: boolean;
  estado: EstadoAtividade;
  tentativas?: number;
  dados?: Gerada;
  resposta?: string;
  certo?: boolean;
  parcial?: boolean;
  feedback?: string;
  // Para medir a espera do aluno: quando a atividade ficou pronta, quando
  // ele chegou a ela e quando respondeu.
  prontaEm?: string;
  vistaEm?: string;
  respondidaEm?: string;
  // Dominar: respostas anteriores, quando o aluno melhora a resposta.
  anteriores?: { resposta: string; feedback: string }[];
};

// Registo de erros: atividades que o aluno marcou como erradas e falhas da IA.
export type Ocorrencia = { quando: string; atividadeId?: string; tipo: "reportada" | "falha"; motivo: string; dados?: unknown };

export type Progresso = {
  atividades: Atividade[];
  atual: number;
  // Atividades previstas em cada etapa no plano inicial.
  previstas: number[];
  // Etapa acabada cujo relatório o aluno ainda não fechou.
  pausa?: Etapa | null;
  // Respostas certas seguidas na etapa atual, para subir a dificuldade.
  seguidas?: number;
  registo?: Ocorrencia[];
  // Quando o plano ficou pronto (o estudo começou antes, ao enviar as fotos).
  planoEm?: string;
};

// Quantas vezes o aluno pode melhorar uma resposta da etapa Dominar.
export const MELHORIAS = 2;

// O que o ecrã recebe: a atividade atual sem as respostas antes de o aluno
// responder, e um resumo das outras.
export type AtividadeVista = Omit<Atividade, "dados"> & { dados?: Partial<Gerada> & { tipo: TipoAtividade } };

export type ResumoAtividade = {
  etapa: Etapa;
  conceitos: string[];
  nivel: Nivel;
  certo?: boolean;
  parcial?: boolean;
  respondida: boolean;
  extra?: boolean;
};

export type VistaEstudo = {
  id: string;
  // fotos: há páginas ilegíveis e o aluno pode fotografá-las de novo.
  estado: "a_ler" | "fotos" | "a_planear" | "pronto" | "erro";
  paginas: number;
  lidas: number;
  ilegiveis: number[];
  erro: string | null;
  plano: Plano | null;
  atual: number;
  total: number;
  previstas: number[];
  pausa: Etapa | null;
  atividade: AtividadeVista | null;
  resumo: ResumoAtividade[];
};
