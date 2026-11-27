import "server-only";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { comUso, gerar, ler } from "@/lib/study/ia";
import { procurarImagem } from "@/lib/study/imagens";
import type {
  Atividade,
  AtividadeVista,
  Conceito,
  Etapa,
  Gerada,
  Nivel,
  Ocorrencia,
  Plano,
  Progresso,
  TipoAtividade,
  VistaEstudo,
} from "@/lib/study/tipos";
import { MELHORIAS } from "@/lib/study/tipos";

// O motor do Study. A IA lê as páginas, faz a lista de conceitos (com o peso
// de cada um) e cria e corrige as atividades; é este código, e não a IA, que
// decide quantas atividades há, a ordem, a dificuldade, garante que cada
// conceito passa pelas quatro etapas e que o aluno só avança quando acaba uma.
//
// Todo o trabalho da IA corre em segundo plano (pode levar minutos e o proxy
// corta pedidos aos 60 segundos). O ecrã pergunta pelo estado de poucos em
// poucos segundos, e cada pergunta acorda o trabalho se estiver parado, por
// exemplo depois de o servidor reiniciar.

export const MAX_PAGINAS = 5;

// ---------- Trabalho em segundo plano, um de cada vez por estudo ----------

const aTrabalhar = new Map<string, Promise<void>>();
const filas = new Map<string, Promise<unknown>>();

// Mudanças ao progresso, uma de cada vez por estudo, para o trabalho da IA e
// as respostas do aluno não se apagarem um ao outro.
function emFila<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const antes = filas.get(id) ?? Promise.resolve();
  const agora = antes.then(fn, fn);
  const fim = agora.catch(() => undefined);
  filas.set(id, fim);
  void fim.then(() => {
    if (filas.get(id) === fim) filas.delete(id);
  });
  return agora;
}

async function mudarProgresso(id: string, fn: (p: Progresso) => void): Promise<Progresso> {
  return emFila(id, async () => {
    const s = await prisma.studySessao.findUniqueOrThrow({ where: { id } });
    const p = s.progresso as unknown as Progresso;
    fn(p);
    await prisma.studySessao.update({ where: { id }, data: { progresso: p as unknown as Prisma.InputJsonValue } });
    return p;
  });
}

function acordar(id: string, trabalho: () => Promise<void>) {
  if (aTrabalhar.has(id)) return;
  const t = trabalho()
    .catch((e) => console.error("[study]", id, e))
    .finally(() => aTrabalhar.delete(id));
  aTrabalhar.set(id, t);
}

function novoId(bytes = 6) {
  return randomBytes(bytes).toString("base64url");
}

// O registo de erros: o que o aluno marca como errado e o que a IA falha.
// Fica no próprio estudo e também no registo do servidor, para melhorar as
// instruções da IA.
function registar(p: Progresso, o: Omit<Ocorrencia, "quando">) {
  const r: Ocorrencia = { quando: new Date().toISOString(), ...o };
  p.registo = [...(p.registo ?? []), r].slice(-100);
  console.warn("[study] registo", JSON.stringify(r).slice(0, 2000));
}

// ---------- Criar e ler as páginas ----------

// Enquanto se lê, o texto de cada página fica no plano (vazio se ilegível),
// para se poder fotografar de novo só as que falharam.
type Leitura = { textos: string[] };

function ilegivel(t: string) {
  return !t || /^ILEG[IÍ]VEL\.?$/i.test(t.trim()) || t.trim().length < 40;
}

export async function criarEstudo(imagens: string[], ip: string): Promise<string> {
  const id = novoId(12);
  await prisma.studySessao.create({
    data: { id, paginas: imagens.length, ip, plano: { textos: imagens.map(() => "") } },
  });
  acordar(id, () => lerPaginas(id, imagens.map((imagem, i) => ({ pagina: i + 1, imagem }))));
  return id;
}

async function lerPaginas(id: string, paginas: { pagina: number; imagem: string }[]) {
  try {
    const s = await prisma.studySessao.findUniqueOrThrow({ where: { id } });
    const textos = [...((s.plano as unknown as Leitura | null)?.textos ?? [])];
    let lidas = s.paginas - paginas.length;
    for (const { pagina, imagem } of paginas) {
      const t = await comUso(id, "ler", () => ler(imagem));
      textos[pagina - 1] = ilegivel(t) ? "" : t;
      lidas++;
      await prisma.studySessao.update({ where: { id }, data: { lidas, plano: { textos } } });
    }
    if (textos.every((t) => !t)) {
      await falhar(id, "Não consegui ler nenhuma das fotografias. Tira-as de novo, com boa luz e a página inteira.");
      return;
    }
    // Se alguma página falhou, pede-se ao aluno uma fotografia nova antes do plano.
    if (textos.some((t) => !t)) {
      await prisma.studySessao.update({ where: { id }, data: { estado: "fotos" } });
      return;
    }
    await comecarPlano(id);
  } catch (e) {
    console.error("[study] ler", id, e);
    await falhar(id, "A leitura das fotografias falhou. Tenta de novo daqui a pouco.");
  }
}

// O aluno manda fotografias novas das páginas ilegíveis.
export async function novasFotos(id: string, paginas: { pagina: number; imagem: string }[]) {
  const s = await prisma.studySessao.findUniqueOrThrow({ where: { id } });
  if (s.estado !== "fotos") throw new Error("Este estudo já não está à espera de fotografias.");
  const validas = paginas.filter((p) => Number.isInteger(p.pagina) && p.pagina >= 1 && p.pagina <= s.paginas);
  if (validas.length === 0) throw new Error("Escolhe uma fotografia.");
  await prisma.studySessao.update({ where: { id }, data: { estado: "a_ler", lidas: s.paginas - validas.length } });
  acordar(id, () => lerPaginas(id, validas));
}

// O aluno decide seguir sem as páginas que não se leram.
export async function seguirSemFotos(id: string) {
  const s = await prisma.studySessao.findUniqueOrThrow({ where: { id } });
  if (s.estado !== "fotos") return;
  acordar(id, () => comecarPlano(id));
}

async function comecarPlano(id: string) {
  const s = await prisma.studySessao.findUniqueOrThrow({ where: { id } });
  const textos = (s.plano as unknown as Leitura | null)?.textos ?? [];
  const ilegiveis = textos.map((t, i) => (t ? 0 : i + 1)).filter(Boolean);
  await prisma.studySessao.update({
    where: { id },
    data: {
      texto: textos.map((t, i) => (t ? `--- Página ${i + 1} ---\n${t}` : "")).filter(Boolean).join("\n\n"),
      estado: "a_planear",
      plano: { ilegiveis },
    },
  });
  await comUso(id, "plano", () => planear(id));
}

async function falhar(id: string, erro: string) {
  await prisma.studySessao.update({ where: { id }, data: { estado: "erro", erro } });
}

// ---------- O plano: a lista fixa de conceitos ----------

const ESQUEMA_PLANO = {
  type: "object",
  properties: {
    disciplina: { type: "string" },
    ano: { type: "string" },
    tema: { type: "string" },
    resumo: { type: "string" },
    conceitos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nome: { type: "string" },
          ideia: { type: "string" },
          peso: { type: "integer" },
          imagem: { type: "string" },
        },
        required: ["nome", "ideia", "peso", "imagem"],
      },
    },
  },
  required: ["disciplina", "ano", "tema", "resumo", "conceitos"],
};

async function planear(id: string) {
  const s = await prisma.studySessao.findUniqueOrThrow({ where: { id } });
  const ilegiveis = ((s.plano as { ilegiveis?: number[] } | null)?.ilegiveis ?? []) as number[];
  // Cerca de três conceitos por página lida, entre 4 e 10.
  const alvo = Math.min(10, Math.max(4, (s.paginas - ilegiveis.length) * 3));
  const r = await gerar<{
    disciplina: string;
    ano: string;
    tema: string;
    resumo: string;
    conceitos: { nome: string; ideia: string; peso: number; imagem: string }[];
  }>(
    "Analisas páginas de manuais escolares portugueses para preparar um plano de estudo. Respondes em português de Portugal. " +
      "Partes sempre do que está nas páginas; quando a página é só um esquema, um diagrama ou uma lista de nomes, completas com conhecimento escolar fiável e consensual para o ano do aluno, sem nunca contradizer o manual.",
    `Estas são as páginas que o aluno fotografou:\n\n${s.texto}\n\n` +
      "Identifica a disciplina, o ano de escolaridade (por exemplo \"6.º ano\"; deixa vazio se não se perceber) e o tema. " +
      "Escreve um resumo de duas frases. " +
      `Depois faz a lista de TODOS os conceitos do tema que o aluno tem de aprender nestas páginas, pela ordem em que aparecem, sem deixar nenhum subtema de fora: cerca de ${alvo} conceitos (nunca mais de 10). ` +
      "Num esquema com legendas, os conceitos são as partes que pertencem ao tema (num esquema do sistema digestivo, os órgãos da digestão, e não o cérebro ou os pulmões). " +
      "Junta num só conceito as ideias muito próximas (por exemplo, um grupo social e os seus privilégios) e põe o vocabulário dentro do conceito a que pertence; não repitas a mesma ideia em dois conceitos. " +
      "Para cada conceito: \"nome\" é curto (até 6 palavras); \"ideia\" diz numa ou duas frases o essencial que o aluno tem de saber (o que é, para que serve, como funciona), com os factos do texto ou, se o texto não os tiver, com conhecimento escolar fiável; " +
      "a \"ideia\" nunca pode ser vaga como \"é uma parte do corpo\" nem falar do texto, do diagrama ou da imagem; " +
      "\"peso\" é 1 se é uma ideia simples, 2 se tem várias informações, 3 se é complexo ou tem muita informação para memorizar; " +
      "\"imagem\" é o que procurar na Wikipédia em português para encontrar uma gravura, pintura, fotografia, mapa ou esquema que ajude a perceber o conceito: " +
      "o título provável de um artigo, com a época ou o contexto (por exemplo \"Nobreza medieval\", \"Clero na Idade Média\" ou \"Ciclo hidrológico\"), ou vazio se uma imagem não ajudar.",
    ESQUEMA_PLANO,
    0.2,
  );
  const conceitos: Conceito[] = (r.conceitos ?? [])
    .filter((c) => c?.nome?.trim() && c?.ideia?.trim())
    .slice(0, 10)
    .map((c, i) => ({
      id: `c${i + 1}`,
      nome: c.nome.trim(),
      ideia: c.ideia.trim(),
      peso: (Math.min(3, Math.max(1, Math.round(Number(c.peso) || 2))) as Nivel),
      imagem: c.imagem?.trim().slice(0, 80) || undefined,
    }));
  if (conceitos.length < 2) {
    await falhar(id, "Não encontrei matéria suficiente nestas páginas. Experimenta fotografar mais páginas do mesmo tema.");
    return;
  }
  const plano: Plano = {
    disciplina: r.disciplina?.trim() || "",
    ano: /n[aã]o|desconhec|indefin/i.test(r.ano ?? "") ? "" : r.ano?.trim() || "",
    tema: r.tema?.trim() || "",
    resumo: r.resumo?.trim() || "",
    conceitos,
    ilegiveis,
  };
  const atividades = percurso(conceitos);
  const progresso: Progresso = {
    atividades,
    atual: 0,
    previstas: [0, 1, 2, 3].map((e) => atividades.filter((a) => a.etapa === e).length),
    planoEm: new Date().toISOString(),
    pausa: null,
    seguidas: 0,
    registo: [],
  };
  await prisma.studySessao.update({
    where: { id },
    data: {
      estado: "pronto",
      plano: plano as unknown as Prisma.InputJsonValue,
      progresso: progresso as unknown as Prisma.InputJsonValue,
    },
  });
  acordarAtividades(id);
}

// O percurso inteiro. Quantas atividades cada conceito tem em cada etapa
// depende do peso que a IA lhe deu; dentro de cada etapa as atividades vão por
// rondas, e cada ronda é mais difícil do que a anterior.
//
//   peso        1   2   3
//   Aprender    1   1   2   (a segunda aprofunda)
//   Consolidar  2   3   4
//   Completar   1   2   2
//   Dominar     um por cada conceito de peso 3; os outros dois a dois
function percurso(conceitos: Conceito[]): Atividade[] {
  const l: Atividade[] = [];
  const nova = (etapa: Etapa, tipo: TipoAtividade, ids: string[], nivel: number): Atividade => ({
    id: novoId(),
    etapa,
    tipo,
    conceitos: ids,
    nivel: Math.min(3, Math.max(1, nivel)) as Nivel,
    estado: "por_gerar",
  });
  const porRondas = (etapa: Etapa, tipo: TipoAtividade, quantas: (c: Conceito) => number) => {
    const max = Math.max(...conceitos.map(quantas));
    for (let ronda = 1; ronda <= max; ronda++)
      for (const c of conceitos) if (quantas(c) >= ronda) l.push(nova(etapa, tipo, [c.id], ronda));
  };
  porRondas(0, "explicacao", (c) => (c.peso === 3 ? 2 : 1));
  porRondas(1, "escolha", (c) => c.peso + 1);
  porRondas(2, "completar", (c) => (c.peso >= 2 ? 2 : 1));
  let par: string[] = [];
  for (const c of conceitos) {
    if (c.peso === 3) l.push(nova(3, "aberta", [c.id], 2));
    else {
      par.push(c.id);
      if (par.length === 2) (l.push(nova(3, "aberta", par, 2)), (par = []));
    }
  }
  if (par.length) l.push(nova(3, "aberta", par, 2));
  return l;
}

// ---------- Criar as atividades ----------

function sistema(s: { texto: string | null }, plano: Plano): string {
  const ano = plano.ano ? `do ${plano.ano}` : "do ensino básico";
  return (
    `És um explicador paciente de um aluno ${ano} em Portugal. Escreves em português de Portugal, com frases curtas e palavras simples, sem linguagem infantilizada. ` +
    "Tratas o aluno por tu. Usas a matéria abaixo, tirada das páginas do manual do aluno, e as ideias dos conceitos do estudo; quando a matéria é só um esquema ou uma lista de nomes, " +
    "usas também conhecimento escolar fiável e consensual para este ano, sem nunca contradizer o manual e sem inventar datas, nomes ou números. " +
    "As perguntas são sobre o que cada coisa é, para que serve e como funciona: nunca perguntes se algo aparece no texto, no diagrama ou na imagem, nem aceites como resposta \"é uma parte do corpo\" ou outra resposta vaga. " +
    "Os exemplos e comparações podem vir da vida do aluno. Usa português de Portugal, nunca do Brasil.\n\n" +
    `MATÉRIA (${[plano.disciplina, plano.tema].filter(Boolean).join(", ")}):\n"""\n${s.texto}\n"""\n\n` +
    `CONCEITOS DO ESTUDO:\n${plano.conceitos.map((c) => `- ${c.nome}: ${c.ideia}`).join("\n")}`
  );
}

const ESQUEMAS: Record<TipoAtividade, object> = {
  explicacao: {
    type: "object",
    properties: {
      titulo: { type: "string" },
      explicacao: { type: "string" },
      exemplo: { type: "string" },
      pergunta: { type: "string" },
      certa: { type: "string" },
      erradas: { type: "array", items: { type: "string" } },
      porque: { type: "string" },
    },
    required: ["titulo", "explicacao", "exemplo", "pergunta", "certa", "erradas", "porque"],
  },
  escolha: {
    type: "object",
    properties: {
      pergunta: { type: "string" },
      certa: { type: "string" },
      erradas: { type: "array", items: { type: "string" } },
      porque: { type: "string" },
    },
    required: ["pergunta", "certa", "erradas", "porque"],
  },
  completar: {
    type: "object",
    properties: {
      frase: { type: "string" },
      resposta: { type: "string" },
      aceites: { type: "array", items: { type: "string" } },
      dica: { type: "string" },
      porque: { type: "string" },
    },
    required: ["frase", "resposta", "aceites", "dica", "porque"],
  },
  aberta: {
    type: "object",
    properties: {
      pergunta: { type: "string" },
      pontos: { type: "array", items: { type: "string" } },
      modelo: { type: "string" },
    },
    required: ["pergunta", "pontos", "modelo"],
  },
};

const NIVEIS: Record<Nivel, string> = {
  1: "Nível fácil: reconhecer uma definição ou um facto que está diretamente no texto.",
  2: "Nível médio: compreender, comparar ou reconhecer um exemplo.",
  3: "Nível difícil: aplicar, relacionar dois conceitos ou tirar uma conclusão que o texto permite.",
};

function pedido(a: Atividade, conceitos: Conceito[], anteriores: string[], segunda: boolean): string {
  const nomes = conceitos.map((c) => `"${c.nome}" (${c.ideia})`).join(" e ");
  const evitar = anteriores.length
    ? `\nNão repitas estas perguntas, que o aluno já viu, nem perguntes a mesma coisa por outras palavras:\n${anteriores.map((x) => `- ${x}`).join("\n")}`
    : "";
  const nivel = ` ${NIVEIS[a.nivel]} `;
  switch (a.tipo) {
    case "explicacao":
      return (
        `Etapa APRENDER. Ensina o conceito ${nomes}. ` +
        (a.extra
          ? "O aluno errou a pergunta sobre este conceito: explica de outra maneira, ainda mais simples, com outro exemplo. "
          : segunda
            ? "O aluno já teve uma primeira explicação deste conceito: agora aprofunda a parte que ficou por explicar, sem repetir a anterior. "
            : "") +
        "\"titulo\" é o nome do conceito. \"explicacao\" é curta: entre 30 e 60 palavras, no máximo 2 parágrafos pequenos separados por uma linha em branco, só com o essencial do conceito " +
        "(é para uma criança ler num telemóvel; os pormenores aparecem depois nas perguntas). " +
        "\"exemplo\" é uma comparação ou um exemplo do dia a dia numa só frase curta. " +
        "Depois faz uma pergunta de escolha múltipla simples sobre o que acabaste de explicar: \"certa\" é a resposta certa, sem dúvida possível, e \"erradas\" são 3 respostas erradas mas plausíveis, " +
        "\"pergunta\" é só a pergunta, uma frase curta que acaba em ponto de interrogação, sem as opções lá dentro; não faças perguntas pela negativa (com NÃO ou EXCETO). " +
        
        "todas curtas e sem letras nem números à frente. \"porque\" explica numa frase porque a certa é a certa." +
        evitar
      );
    case "escolha":
      return (
        `Etapa CONSOLIDAR. Faz uma pergunta de escolha múltipla sobre ${nomes}, sem explicação antes. ` +
        "\"pergunta\" é só a pergunta, uma frase curta que acaba em ponto de interrogação, sem as opções lá dentro; não faças perguntas pela negativa (com NÃO ou EXCETO). " +
        nivel +
        "A opção certa tem de estar de acordo com a matéria e com as ideias dos conceitos, sem conclusões inventadas, e só uma opção pode estar certa. " +
        "\"certa\" é a resposta certa e \"erradas\" são 3 respostas erradas plausíveis, enganos que um aluno costuma fazer; todas curtas e sem letras nem números à frente. " +
        "\"porque\" explica numa frase porque a certa é a certa." +
        evitar
      );
    case "completar":
      return (
        `Etapa COMPLETAR. Escreve uma frase sobre ${nomes}, baseada na matéria, em que falte uma palavra ou expressão curta (no máximo 3 palavras) que seja importante.` +
        (a.nivel >= 2
          ? " Como é a segunda vez, a frase é mais exigente: em vez de copiar o manual, junta duas ideias ou pede o termo exato. "
          : " ") +
        "Na frase, põe ____ no lugar do que falta (só um espaço). \"resposta\" é o que falta. \"aceites\" são outras formas certas de o escrever (sinónimos, singular ou plural); pode ficar vazia. " +
        "\"dica\" ajuda sem dar a resposta. \"porque\" explica numa frase." +
        evitar
      );
    case "aberta":
      return (
        `Etapa DOMINAR. Faz uma pergunta aberta sobre ${nomes}, que obrigue o aluno a explicar por palavras suas (por exemplo "Explica porquê...", "Compara...", "Descreve..."). ` +
        "A pergunta é sobre a matéria, não sobre a vida ou os sentimentos do aluno, e a resposta tem de estar no texto. " +
        "A resposta certa deve caber em 2 a 4 frases. \"pontos\" são as 2 a 4 ideias essenciais que a resposta tem de ter, cada uma numa frase curta. " +
        "\"modelo\" é uma boa resposta de um aluno, em 2 a 4 frases." +
        evitar
      );
  }
}

// As opções vêm muitas vezes com a certa em primeiro lugar: baralham-se aqui.
function baralhar<T extends { opcoes: string[]; correta: number }>(d: T): T {
  const certa = d.opcoes[d.correta];
  const opcoes = [...d.opcoes];
  for (let i = opcoes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [opcoes[i], opcoes[j]] = [opcoes[j], opcoes[i]];
  }
  return { ...d, opcoes, correta: opcoes.indexOf(certa) };
}

// O ecrã mostra texto simples: tiram-se os asteriscos de negrito que a IA põe.
function limpar(s: string) {
  return s.replace(/\*+/g, "").trim();
}

// Perguntas e respostas que não ensinam nada: falar do texto, do diagrama ou
// da imagem em vez da matéria, ou respostas como "é uma parte do corpo".
const VAGA =
  /\b(no|do|pelo|na|da) (texto|diagrama|manual|esquema|imagem|página)\b|identificad[oa]s? n[oa]|confirmad[oa] no|parte do corpo humano|é uma parte importante/i;

function validar(tipo: TipoAtividade, d: Record<string, unknown>): Gerada {
  const txt = (v: unknown) => (typeof v === "string" ? limpar(v) : "");
  if (tipo === "explicacao" || tipo === "escolha") {
    // A IA escreve a certa e as erradas à parte e é o código que as junta:
    // assim a resposta certa nunca fica trocada por um número mal dado.
    const opcao = (v: unknown) => txt(v).replace(/^\(?[A-Da-d1-4][).:-]\s+/, "").replace(/\s*\(\d\)\s*$/, "").trim();
    const certa = opcao(d.certa);
    const erradas = Array.isArray(d.erradas) ? (d.erradas as unknown[]).map(opcao).filter(Boolean).slice(0, 3) : [];
    const opcoes = [certa, ...erradas];
    const correta = 0;
    // O modelo pequeno às vezes copia os rótulos "Certa / Erradas" para dentro
    // da pergunta: tiram-se essas linhas, e uma pergunta que ainda mostre a
    // resposta é recusada (pede-se outra).
    const linhas = txt(d.pergunta)
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l && !/^(certa|erradas?|respostas?)\b/i.test(l) && !/^\d+[.)]?$/.test(l) && !/^\(?[a-dA-D]\)\s/.test(l));
    // Se o modelo meteu as opções no campo da pergunta, aproveita-se a linha
    // que é mesmo uma pergunta; sem nenhuma, a atividade é pedida de novo.
    const comPergunta = linhas.filter((l) => /\?$/.test(l));
    const pergunta = (comPergunta.length ? comPergunta[comPergunta.length - 1] : linhas.join(" ")).trim();
    // Perguntas pela negativa enganam o modelo pequeno (marca como certa a
    // opção verdadeira): não se aceitam.
    if (/\bN[ÃA]O\b|\bEXCETO\b/.test(pergunta) || /\b(qual|quais) (destas|destes|das seguintes|dos seguintes)[^?]*\b(não|exceto)\b/i.test(pergunta))
      throw new Error("pergunta pela negativa");
    if (!certa || erradas.length < 2 || !pergunta) throw new Error("pergunta de escolha múltipla incompleta");
    const certaNorm = normalizar(certa);
    if (/\b(certa|erradas?)\s*:/i.test(pergunta) || (certaNorm.split(" ").length >= 3 && normalizar(pergunta).includes(certaNorm)))
      throw new Error("a pergunta mostra a resposta");
    // Restos do esquema dentro do texto (o modelo pequeno mistura os campos):
    // "Porque:", "Erradas", opções "A) ... B)" na pergunta, ou uma resposta
    // que é só uma letra ou um rótulo.
    const rotulo = (t: string) => /^(\(?[A-Da-d]\)?|certa|erradas?|errid\w*|op[cç][aã]o \w)$/i.test(t.trim());
    if (/\b(porque|certa|erradas?|errid\w*)\s*:/i.test(pergunta) || /\berrid/i.test(pergunta))
      throw new Error("a pergunta traz restos do esquema");
    if (VAGA.test(pergunta) || VAGA.test(certa) || erradas.some((e) => VAGA.test(e)))
      throw new Error("pergunta sobre o texto ou resposta vaga");
    if (/(^|\s)\(?[A-Da-d]\)\s/.test(pergunta) || rotulo(certa) || erradas.some(rotulo))
      throw new Error("a pergunta traz as opções ou um rótulo");
    // Opções repetidas dão perguntas com duas respostas possíveis.
    if (new Set(opcoes.map((o) => normalizar(o))).size !== opcoes.length) throw new Error("opções repetidas");
    const base = { pergunta, opcoes, correta, porque: txt(d.porque) };
    if (tipo === "escolha") return baralhar({ tipo, ...base });
    if (!txt(d.explicacao)) throw new Error("explicação vazia");
    return baralhar({ tipo, titulo: txt(d.titulo), explicacao: txt(d.explicacao), exemplo: txt(d.exemplo), ...base });
  }
  if (tipo === "completar") {
    let frase = txt(d.frase);
    const resposta = txt(d.resposta);
    if (!resposta || !frase) throw new Error("frase incompleta");
    if (VAGA.test(frase) || frase.replace(/_+/g, " ").trim().split(/\s+/).length < 6) throw new Error("frase vaga");
    if (!frase.includes("____")) {
      // A IA às vezes deixa a palavra na frase: tira-se aqui.
      const i = frase.toLowerCase().indexOf(resposta.toLowerCase());
      if (i < 0) throw new Error("frase sem espaço");
      frase = frase.slice(0, i) + "____" + frase.slice(i + resposta.length);
    }
    frase = frase.replace(/_{2,}/g, "____");
    if (frase.split("____").length !== 2) throw new Error("frase com mais de um espaço");
    const aceites = Array.isArray(d.aceites) ? (d.aceites as unknown[]).map(txt).filter(Boolean).slice(0, 6) : [];
    return { tipo, frase, resposta, aceites, dica: txt(d.dica), porque: txt(d.porque) };
  }
  const pontos = Array.isArray(d.pontos) ? (d.pontos as unknown[]).map(txt).filter(Boolean).slice(0, 4) : [];
  if (!txt(d.pergunta) || pontos.length === 0) throw new Error("pergunta aberta incompleta");
  if (VAGA.test(txt(d.pergunta))) throw new Error("pergunta sobre o texto");
  return { tipo, pergunta: txt(d.pergunta), pontos, modelo: txt(d.modelo) };
}

function textoPergunta(d?: Gerada): string | null {
  if (!d) return null;
  return d.tipo === "completar" ? d.frase : d.pergunta;
}

async function criarAtividade(id: string, atividadeId: string) {
  const s = await prisma.studySessao.findUniqueOrThrow({ where: { id } });
  const plano = s.plano as unknown as Plano;
  const p = s.progresso as unknown as Progresso;
  const a = p.atividades.find((x) => x.id === atividadeId);
  if (!a || a.estado !== "por_gerar") return;
  const conceitos = plano.conceitos.filter((c) => a.conceitos.includes(c.id));
  const anteriores = p.atividades
    .filter((x) => x.id !== a.id && x.dados && x.conceitos.some((c) => a.conceitos.includes(c)))
    .map((x) => textoPergunta(x.dados))
    .filter((x): x is string => Boolean(x));
  // Explicações anteriores do mesmo conceito (para a segunda aprofundar e
  // para a imagem não ser a mesma).
  const jaExplicado = p.atividades.filter((x) => x.id !== a.id && x.tipo === "explicacao" && x.dados && x.conceitos.join() === a.conceitos.join()).length;
  let bruto: Record<string, unknown> | null = null;
  try {
    // Cada nova tentativa sai mais variada, para não repetir a pergunta que
    // acabou de ser recusada.
    const temperatura = Math.min(0.95, 0.4 + 0.25 * (a.tentativas ?? 0));
    bruto = await gerar<Record<string, unknown>>(sistema(s, plano), pedido(a, conceitos, anteriores, jaExplicado > 0), ESQUEMAS[a.tipo], temperatura);
    const dados = validar(a.tipo, bruto);
    // A imagem procura-se depois, para a explicação não esperar por ela:
    // sem a chave "imagem" está por procurar, null é que não há.
    // Os reforços não levam imagem, para chegarem depressa.
    if (dados.tipo === "explicacao" && (!conceitos[0]?.imagem || a.extra)) dados.imagem = null;
    // Uma pergunta igual a outra que o aluno já viu não serve: pede-se outra
    // (à terceira tentativa aceita-se, para o estudo não parar).
    const nova = normalizar(textoPergunta(dados) ?? "");
    if ((a.tentativas ?? 0) < 2 && anteriores.some((x) => normalizar(x) === nova)) throw new Error("pergunta repetida");
    await mudarProgresso(id, (q) => {
      const x = q.atividades.find((y) => y.id === atividadeId);
      if (x && x.estado === "por_gerar") Object.assign(x, { dados, estado: "pronta", prontaEm: new Date().toISOString() });
    });
  } catch (e) {
    console.error("[study] atividade", id, atividadeId, e);
    await mudarProgresso(id, (q) => {
      const x = q.atividades.find((y) => y.id === atividadeId);
      if (!x) return;
      x.tentativas = (x.tentativas ?? 0) + 1;
      registar(q, { tipo: "falha", atividadeId, motivo: `criar ${x.tipo}: ${e instanceof Error ? e.message : String(e)}`, dados: bruto ?? undefined });
      if (x.tentativas >= 3) x.estado = "erro";
    });
  }
}

async function juntarImagem(id: string, atividadeId: string) {
  const s = await prisma.studySessao.findUniqueOrThrow({ where: { id } });
  const plano = s.plano as unknown as Plano;
  const p = s.progresso as unknown as Progresso;
  const a = p.atividades.find((x) => x.id === atividadeId);
  const c = plano.conceitos.find((x) => x.id === a?.conceitos[0]);
  if (!a || a.dados?.tipo !== "explicacao" || a.dados.imagem !== undefined) return;
  const usadas = p.atividades.flatMap((x) => (x.dados?.tipo === "explicacao" && x.dados.imagem ? [x.dados.imagem.url] : []));
  const imagem = c?.imagem ? await procurarImagem(c.imagem, `${c.nome}: ${c.ideia}`, plano.tema, usadas).catch(() => null) : null;
  await mudarProgresso(id, (q) => {
    const x = q.atividades.find((y) => y.id === atividadeId);
    if (x?.dados?.tipo === "explicacao" && x.dados.imagem === undefined) x.dados.imagem = imagem;
  });
}

// ---------- Corrigir ----------

function normalizar(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(o|a|os|as|um|uma)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function corrigir(id: string, atividadeId: string) {
  const s = await prisma.studySessao.findUniqueOrThrow({ where: { id } });
  const plano = s.plano as unknown as Plano;
  const p = s.progresso as unknown as Progresso;
  const a = p.atividades.find((x) => x.id === atividadeId);
  if (!a || a.estado !== "a_corrigir" || !a.dados) return;
  let resultado: { certo: boolean; parcial: boolean; feedback: string };
  try {
    if (a.dados.tipo === "completar") {
      const r = await gerar<{ certo: boolean; feedback: string }>(
        sistema(s, plano),
        `O aluno tinha de completar esta frase: "${a.dados.frase}". A resposta esperada era "${a.dados.resposta}". ` +
          `O aluno escreveu: "${a.resposta}". ` +
          "Diz se a resposta do aluno está certa pelo significado: aceita sinónimos, outra forma de dizer o mesmo e pequenos erros de ortografia, mas não aceita uma ideia diferente nem incompleta. " +
          "\"feedback\" fala com o aluno numa ou duas frases: se errou, diz qual era a resposta e porquê. Vai direto ao assunto, sem \"Olá\" nem elogios feitos.",
        { type: "object", properties: { certo: { type: "boolean" }, feedback: { type: "string" } }, required: ["certo", "feedback"] },
        0,
      );
      resultado = { certo: Boolean(r.certo), parcial: false, feedback: limpar(r.feedback ?? "") };
    } else if (a.dados.tipo === "aberta") {
      const r = await gerar<{ presentes: boolean[]; feedback: string }>(
        sistema(s, plano),
        `Pergunta: "${a.dados.pergunta}"\n` +
          `Ideias essenciais que a resposta tem de ter:\n${a.dados.pontos.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n` +
          `Resposta do aluno: "${a.resposta}"\n\n` +
          "Para cada ideia essencial, pela mesma ordem, diz em \"presentes\" se a resposta do aluno a tem (true ou false), mesmo que dita por outras palavras. " +
          "Não contes ideias que estejam erradas. Não exijas as palavras do manual. " +
          "\"feedback\" fala com o aluno em 2 ou 3 frases: diz se os conteúdos estão certos, o que falta, e se a explicação está clara e organizada e usa o vocabulário da matéria, sem dar a resposta toda. " +
          "Vai direto ao assunto: sem \"Olá\" e sem elogios feitos como \"És um bom aluno\".",
        {
          type: "object",
          properties: { presentes: { type: "array", items: { type: "boolean" } }, feedback: { type: "string" } },
          required: ["presentes", "feedback"],
        },
        0,
      );
      const total = a.dados.pontos.length;
      const tem = (r.presentes ?? []).slice(0, total).filter(Boolean).length;
      // Certa só com todas as ideias essenciais (com 4, aceita-se uma em falta):
      // uma resposta incompleta não conta como totalmente certa.
      const certo = tem >= (total >= 4 ? total - 1 : total);
      resultado = { certo, parcial: !certo && tem > 0, feedback: limpar(r.feedback ?? "") };
    } else return;
  } catch (e) {
    console.error("[study] corrigir", id, atividadeId, e);
    await mudarProgresso(id, (q) => {
      const x = q.atividades.find((y) => y.id === atividadeId);
      if (!x) return;
      x.tentativas = (x.tentativas ?? 0) + 1;
      registar(q, { tipo: "falha", atividadeId, motivo: `corrigir: ${e instanceof Error ? e.message : String(e)}` });
      if (x.tentativas >= 3)
        Object.assign(x, { estado: "corrigida", certo: false, feedback: "Não consegui corrigir esta resposta. Compara com a resposta modelo." });
    });
    return;
  }
  await mudarProgresso(id, (q) => {
    const x = q.atividades.find((y) => y.id === atividadeId);
    if (x && x.estado === "a_corrigir") {
      Object.assign(x, { estado: "corrigida", ...resultado });
      // Na Dominar o aluno ainda pode melhorar a resposta: o reforço só entra
      // quando ele decide continuar.
      if (x.tipo !== "aberta") depoisDeCorrigir(q, x);
    }
  });
}

// Depois de cada correção: sobe a dificuldade a quem está a acertar e reforça
// o conceito a quem errou.
function depoisDeCorrigir(p: Progresso, a: Atividade) {
  if (a.certo) {
    p.seguidas = (p.seguidas ?? 0) + 1;
    // Três certas seguidas: as próximas desta etapa ficam um nível acima.
    if (p.seguidas >= 3) {
      for (const x of p.atividades)
        if (x.etapa === a.etapa && x.estado === "por_gerar" && x.tipo !== "aberta" && x.nivel < 3) x.nivel = (x.nivel + 1) as Nivel;
      p.seguidas = 0;
    }
    return;
  }
  p.seguidas = 0;
  reforcar(p, a);
}

// Quando o aluno erra, entra uma atividade a mais sobre o mesmo conceito no
// fim da mesma etapa (no máximo duas por conceito e etapa, para não ficar
// preso), um nível abaixo.
function reforcar(p: Progresso, a: Atividade) {
  if (a.certo) return;
  const ja = p.atividades.filter((x) => x.extra && x.etapa === a.etapa && x.conceitos.join() === a.conceitos.join()).length;
  if (ja >= 2) return;
  let fim = p.atividades.length - 1;
  while (fim >= 0 && p.atividades[fim].etapa !== a.etapa) fim--;
  p.atividades.splice(fim + 1, 0, {
    id: novoId(),
    etapa: a.etapa,
    tipo: a.tipo,
    conceitos: a.conceitos,
    nivel: Math.max(1, a.nivel - 1) as Nivel,
    extra: true,
    estado: "por_gerar",
  });
}

// ---------- O trabalho de fundo depois do plano ----------

// Corrige o que está à espera e prepara a atividade atual e as duas seguintes,
// para o aluno quase nunca esperar.
function acordarAtividades(id: string) {
  acordar(id, async () => {
    for (let voltas = 0; voltas < 20; voltas++) {
      const s = await prisma.studySessao.findUnique({ where: { id } });
      if (!s || s.estado !== "pronto") return;
      const p = s.progresso as unknown as Progresso;
      const corrigirA = p.atividades.find((a) => a.estado === "a_corrigir");
      if (corrigirA) {
        await comUso(id, "corrigir", () => corrigir(id, corrigirA.id));
        continue;
      }
      // Primeiro o texto da atividade atual e da seguinte (o aluno nunca fica
      // à espera de uma pergunta), depois as imagens, depois a terceira.
      const semImagem = (a: Atividade) => a.dados?.tipo === "explicacao" && a.dados.imagem === undefined;
      const alvo =
        p.atividades.slice(p.atual, p.atual + 2).find((a) => a.estado === "por_gerar") ??
        p.atividades.slice(p.atual, p.atual + 3).find(semImagem) ??
        p.atividades.slice(p.atual + 2, p.atual + 3).find((a) => a.estado === "por_gerar");
      if (!alvo) return;
      // Duas falhas do modelo rápido na mesma atividade: a última tentativa
      // vai para o modelo forte, para a atividade não ficar em erro.
      if (alvo.estado === "por_gerar")
        await comUso(id, (alvo.tentativas ?? 0) >= 2 ? "atividade_forte" : "atividade", () => criarAtividade(id, alvo.id));
      else await comUso(id, "imagem", () => juntarImagem(id, alvo.id));
    }
  });
}

// ---------- O que o ecrã pede ----------

export async function verEstudo(id: string): Promise<VistaEstudo | null> {
  const s = await prisma.studySessao.findUnique({ where: { id } });
  if (!s) return null;

  if (!aTrabalhar.has(id)) {
    // O servidor reiniciou a meio: as fotografias perderam-se, mas o texto
    // lido fica e o plano pode ser refeito.
    if (s.estado === "a_ler") {
      await falhar(id, "A leitura foi interrompida. Envia as fotografias de novo.");
      return verEstudo(id);
    }
    if (s.estado === "a_planear") acordar(id, () => comUso(id, "plano", () => planear(id)).catch(() => falhar(id, "Não consegui preparar o plano. Tenta de novo.")));
    if (s.estado === "pronto") acordarAtividades(id);
  }

  const plano = s.estado === "pronto" ? (s.plano as unknown as Plano) : null;
  const textos = (s.plano as unknown as Leitura | null)?.textos;
  const p = s.estado === "pronto" ? (s.progresso as unknown as Progresso | null) : null;
  let atual = p?.atividades[p.atual] ?? null;
  // A primeira vez que o aluno chega a uma atividade fica registada: com a
  // hora em que ela ficou pronta, dá a espera real.
  if (atual && !atual.vistaEm && p && p.pausa == null) {
    const quando = new Date().toISOString();
    const idAtual = atual.id;
    await mudarProgresso(id, (q) => {
      const x = q.atividades.find((y) => y.id === idAtual);
      if (x && !x.vistaEm) x.vistaEm = quando;
    }).catch(() => undefined);
    atual = { ...atual, vistaEm: quando };
  }
  return {
    id: s.id,
    estado: s.estado as VistaEstudo["estado"],
    paginas: s.paginas,
    lidas: s.lidas,
    ilegiveis: s.estado === "fotos" && textos ? textos.map((t, i) => (t ? 0 : i + 1)).filter(Boolean) : (plano?.ilegiveis ?? []),
    erro: s.erro,
    plano,
    atual: p?.atual ?? 0,
    total: p?.atividades.length ?? 0,
    previstas: p?.previstas ?? [0, 0, 0, 0],
    pausa: p?.pausa ?? null,
    atividade: atual ? esconder(atual) : null,
    resumo: (p?.atividades ?? []).map((a) => ({
      etapa: a.etapa,
      conceitos: a.conceitos,
      nivel: a.nivel,
      certo: a.certo,
      parcial: a.parcial,
      respondida: a.estado === "corrigida",
      extra: a.extra,
    })),
  };
}

// Antes de o aluno responder, a resposta não sai do servidor.
function esconder(a: Atividade): AtividadeVista {
  if (!a.dados || a.estado === "corrigida") return a;
  const d = a.dados;
  const sem: AtividadeVista["dados"] =
    d.tipo === "explicacao" || d.tipo === "escolha"
      ? { ...d, correta: undefined, porque: undefined }
      : d.tipo === "completar"
        ? { ...d, resposta: undefined, aceites: undefined, porque: undefined }
        : { ...d, pontos: undefined, modelo: undefined };
  return { ...a, dados: sem };
}

export async function responder(id: string, atividadeId: string, resposta: string) {
  const texto = resposta.trim().slice(0, 2000);
  if (!texto) throw new Error("Escreve uma resposta.");
  await mudarProgresso(id, (p) => {
    const a = p.atividades[p.atual];
    if (!a || a.id !== atividadeId || a.estado !== "pronta" || !a.dados) throw new Error("Esta atividade já não está à espera de resposta.");
    a.resposta = texto;
    a.respondidaEm ??= new Date().toISOString();
    const d = a.dados;
    if (d.tipo === "explicacao" || d.tipo === "escolha") {
      a.certo = Number(texto) === d.correta;
      a.estado = "corrigida";
      a.feedback = d.porque;
      depoisDeCorrigir(p, a);
    } else if (d.tipo === "completar" && [d.resposta, ...d.aceites].some((x) => normalizar(x) === normalizar(texto))) {
      a.certo = true;
      a.estado = "corrigida";
      a.feedback = d.porque;
      depoisDeCorrigir(p, a);
    } else {
      // Respostas escritas que não batem certo à letra vão à IA.
      a.estado = "a_corrigir";
      a.tentativas = 0;
    }
  });
  acordarAtividades(id);
}

// Dominar: o aluno tenta outra vez, depois de ler o que faltava.
export async function melhorar(id: string, atividadeId: string) {
  await mudarProgresso(id, (p) => {
    const a = p.atividades[p.atual];
    if (!a || a.id !== atividadeId || a.tipo !== "aberta" || a.estado !== "corrigida" || a.certo) return;
    if ((a.anteriores?.length ?? 0) >= MELHORIAS) return;
    a.anteriores = [...(a.anteriores ?? []), { resposta: a.resposta ?? "", feedback: a.feedback ?? "" }];
    Object.assign(a, { estado: "pronta", resposta: undefined, certo: undefined, parcial: undefined, feedback: undefined });
  });
}

export async function avancar(id: string, atividadeId: string) {
  await mudarProgresso(id, (p) => {
    const a = p.atividades[p.atual];
    if (!a || a.id !== atividadeId || (a.estado !== "corrigida" && a.estado !== "erro")) return;
    if (a.tipo === "aberta" && a.estado === "corrigida") depoisDeCorrigir(p, a);
    p.atual++;
    const seguinte = p.atividades[p.atual];
    if (!seguinte || seguinte.etapa !== a.etapa) {
      p.pausa = a.etapa;
      p.seguidas = 0;
    }
  });
  acordarAtividades(id);
}

export async function fecharRelatorio(id: string) {
  await mudarProgresso(id, (p) => {
    p.pausa = null;
  });
}

export async function tentarDeNovo(id: string, atividadeId: string) {
  await mudarProgresso(id, (p) => {
    const a = p.atividades.find((x) => x.id === atividadeId);
    if (a && a.estado === "erro") Object.assign(a, { estado: "por_gerar", tentativas: 0 });
  });
  acordarAtividades(id);
}

// O aluno marca a atividade como errada (pergunta confusa, duas respostas
// certas, imagem que não tem nada a ver...). Fica no registo e, se ainda não
// respondeu, é trocada por outra.
export async function reportar(id: string, atividadeId: string, motivo: string) {
  await mudarProgresso(id, (p) => {
    const a = p.atividades.find((x) => x.id === atividadeId);
    if (!a) return;
    registar(p, { tipo: "reportada", atividadeId, motivo: motivo.trim().slice(0, 300) || "sem motivo", dados: a.dados });
    if (a.estado === "pronta") Object.assign(a, { estado: "por_gerar", dados: undefined, tentativas: 0 });
  });
  acordarAtividades(id);
}
