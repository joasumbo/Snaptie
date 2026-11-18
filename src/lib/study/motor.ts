import "server-only";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { gerar, ler } from "@/lib/study/ia";
import type {
  Atividade,
  AtividadeVista,
  Conceito,
  Etapa,
  Gerada,
  Plano,
  Progresso,
  TipoAtividade,
  VistaEstudo,
} from "@/lib/study/tipos";

// O motor do Study. A IA lê as páginas, faz a lista de conceitos e cria e
// corrige as atividades; é este código, e não a IA, que decide a ordem, garante
// que cada conceito passa pelas quatro etapas e que o aluno só avança quando
// acaba uma.
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

// ---------- Criar e ler as páginas ----------

export async function criarEstudo(imagens: string[], ip: string): Promise<string> {
  const id = novoId(12);
  await prisma.studySessao.create({ data: { id, paginas: imagens.length, ip } });
  acordar(id, () => analisar(id, imagens));
  return id;
}

async function analisar(id: string, imagens: string[]) {
  try {
    const textos: string[] = [];
    const ilegiveis: number[] = [];
    for (let i = 0; i < imagens.length; i++) {
      const t = await ler(imagens[i]);
      if (!t || /^ILEG[IÍ]VEL\.?$/i.test(t.trim()) || t.length < 40) ilegiveis.push(i + 1);
      else textos.push(`--- Página ${i + 1} ---\n${t}`);
      await prisma.studySessao.update({ where: { id }, data: { lidas: i + 1 } });
    }
    if (textos.length === 0) {
      await falhar(id, "Não consegui ler nenhuma das fotografias. Tira-as de novo, com boa luz e a página inteira.");
      return;
    }
    await prisma.studySessao.update({
      where: { id },
      data: { texto: textos.join("\n\n"), estado: "a_planear", plano: { ilegiveis } },
    });
    await planear(id);
  } catch (e) {
    console.error("[study] analisar", id, e);
    await falhar(id, "A leitura das fotografias falhou. Tenta de novo daqui a pouco.");
  }
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
        properties: { nome: { type: "string" }, ideia: { type: "string" } },
        required: ["nome", "ideia"],
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
  const r = await gerar<{ disciplina: string; ano: string; tema: string; resumo: string; conceitos: { nome: string; ideia: string }[] }>(
    "Analisas páginas de manuais escolares portugueses para preparar um plano de estudo. Respondes em português de Portugal e só com base no texto dado.",
    `Estas são as páginas que o aluno fotografou:\n\n${s.texto}\n\n` +
      "Identifica a disciplina, o ano de escolaridade (por exemplo \"6.º ano\"; deixa vazio se não se perceber) e o tema. " +
      "Escreve um resumo de duas frases. " +
      `Depois faz a lista de TODOS os conceitos que o aluno tem de aprender nestas páginas, pela ordem em que aparecem, sem deixar nenhum subtema de fora: cerca de ${alvo} conceitos (nunca mais de 10). ` +
      "Junta num só conceito as ideias muito próximas (por exemplo, um grupo social e os seus privilégios) e põe o vocabulário dentro do conceito a que pertence; não repitas a mesma ideia em dois conceitos. " +
      "Para cada conceito, \"nome\" é curto (até 6 palavras) e \"ideia\" diz numa ou duas frases o essencial que o aluno tem de saber, com os factos tal como estão no texto.",
    ESQUEMA_PLANO,
    0.2,
  );
  const conceitos: Conceito[] = (r.conceitos ?? [])
    .filter((c) => c?.nome?.trim() && c?.ideia?.trim())
    .slice(0, 10)
    .map((c, i) => ({ id: `c${i + 1}`, nome: c.nome.trim(), ideia: c.ideia.trim() }));
  if (conceitos.length < 2) {
    await falhar(id, "Não encontrei matéria suficiente nestas páginas. Experimenta fotografar mais páginas do mesmo tema.");
    return;
  }
  const plano: Plano = {
    disciplina: r.disciplina?.trim() || "",
    ano: r.ano?.trim() || "",
    tema: r.tema?.trim() || "",
    resumo: r.resumo?.trim() || "",
    conceitos,
    ilegiveis,
  };
  const progresso: Progresso = { atividades: percurso(conceitos), atual: 0, pausa: null };
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

// O percurso inteiro: cada conceito passa pelas quatro etapas. Na última, as
// perguntas abertas juntam dois conceitos de cada vez.
function percurso(conceitos: Conceito[]): Atividade[] {
  const l: Atividade[] = [];
  const nova = (etapa: Etapa, tipo: TipoAtividade, ids: string[]): Atividade => ({
    id: novoId(),
    etapa,
    tipo,
    conceitos: ids,
    estado: "por_gerar",
  });
  for (const c of conceitos) l.push(nova(0, "explicacao", [c.id]));
  for (const c of conceitos) l.push(nova(1, "escolha", [c.id]));
  for (const c of conceitos) l.push(nova(2, "completar", [c.id]));
  for (let i = 0; i < conceitos.length; i += 2) l.push(nova(3, "aberta", conceitos.slice(i, i + 2).map((c) => c.id)));
  return l;
}

// ---------- Criar as atividades ----------

function sistema(s: { texto: string | null }, plano: Plano): string {
  const ano = plano.ano ? `do ${plano.ano}` : "do ensino básico";
  return (
    `És um explicador paciente de um aluno ${ano} em Portugal. Escreves em português de Portugal, com frases curtas e palavras simples. ` +
    "Tratas o aluno por tu. Usas só a matéria abaixo, tirada das páginas do manual do aluno: não inventes factos, datas, nomes, números, causas nem pormenores que não estejam lá. " +
    "Os exemplos e comparações podem vir da vida do aluno, mas nunca acrescentam factos sobre a matéria. Usa português de Portugal, nunca do Brasil.\n\n" +
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
      opcoes: { type: "array", items: { type: "string" } },
      correta: { type: "integer" },
      porque: { type: "string" },
    },
    required: ["titulo", "explicacao", "exemplo", "pergunta", "opcoes", "correta", "porque"],
  },
  escolha: {
    type: "object",
    properties: {
      pergunta: { type: "string" },
      opcoes: { type: "array", items: { type: "string" } },
      correta: { type: "integer" },
      porque: { type: "string" },
    },
    required: ["pergunta", "opcoes", "correta", "porque"],
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

function pedido(a: Atividade, conceitos: Conceito[], anteriores: string[]): string {
  const nomes = conceitos.map((c) => `"${c.nome}" (${c.ideia})`).join(" e ");
  const evitar = anteriores.length
    ? `\nNão repitas estas perguntas, que o aluno já viu:\n${anteriores.map((x) => `- ${x}`).join("\n")}`
    : "";
  switch (a.tipo) {
    case "explicacao":
      return (
        `Etapa APRENDER. Ensina o conceito ${nomes}. ` +
        (a.extra
          ? "O aluno errou a pergunta sobre este conceito: explica de outra maneira, ainda mais simples, com outro exemplo. "
          : "") +
        "\"titulo\" é o nome do conceito. \"explicacao\" tem entre 60 e 120 palavras, em 2 ou 3 parágrafos curtos separados por uma linha em branco. " +
        "\"exemplo\" é uma comparação ou um exemplo do dia a dia, numa ou duas frases. " +
        "Depois faz uma pergunta de escolha múltipla simples sobre o que acabaste de explicar: \"opcoes\" tem 4 opções curtas, só uma certa, " +
        "\"correta\" é a posição (0 a 3) da opção certa e \"porque\" explica numa frase porque é a certa, sem falar em letras nem números de opção." +
        evitar
      );
    case "escolha":
      return (
        `Etapa CONSOLIDAR. Faz uma pergunta de escolha múltipla sobre ${nomes}, um pouco mais exigente do que uma pergunta de definição ` +
        "(por exemplo comparar, dar um exemplo, relacionar com outro conceito). A opção certa tem de se poder confirmar no texto da matéria, sem conclusões que lá não estejam. " +
        "\"opcoes\" tem 4 opções plausíveis e curtas, só uma certa; " +
        "as erradas devem ser enganos que um aluno costuma fazer. \"correta\" é a posição (0 a 3) da certa e \"porque\" explica numa frase, sem falar em letras nem números de opção." +
        evitar
      );
    case "completar":
      return (
        `Etapa COMPLETAR. Escreve uma frase sobre ${nomes}, baseada na matéria, em que falte uma palavra ou expressão curta (no máximo 3 palavras) que seja importante. ` +
        "Na frase, põe ____ no lugar do que falta (só um espaço). \"resposta\" é o que falta. \"aceites\" são outras formas certas de o escrever (sinónimos, singular ou plural); pode ficar vazia. " +
        "\"dica\" ajuda sem dar a resposta. \"porque\" explica numa frase." +
        evitar
      );
    case "aberta":
      return (
        `Etapa DOMINAR. Faz uma pergunta aberta sobre ${nomes}, que obrigue o aluno a explicar por palavras suas (por exemplo \"Explica porquê...\", \"Compara...\", \"Descreve...\").A pergunta é sobre a matéria, não sobre a vida ou os sentimentos do aluno, e a resposta tem de estar no texto. ` +
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

function validar(tipo: TipoAtividade, d: Record<string, unknown>): Gerada {
  const txt = (v: unknown) => (typeof v === "string" ? limpar(v) : "");
  if (tipo === "explicacao" || tipo === "escolha") {
    const opcoes = Array.isArray(d.opcoes) ? (d.opcoes as unknown[]).map(txt).filter(Boolean).slice(0, 4) : [];
    const correta = Number(d.correta);
    if (opcoes.length < 3 || !Number.isInteger(correta) || correta < 0 || correta >= opcoes.length || !txt(d.pergunta))
      throw new Error("pergunta de escolha múltipla incompleta");
    const base = { pergunta: txt(d.pergunta), opcoes, correta, porque: txt(d.porque) };
    if (tipo === "escolha") return baralhar({ tipo, ...base });
    if (!txt(d.explicacao)) throw new Error("explicação vazia");
    return baralhar({ tipo, titulo: txt(d.titulo), explicacao: txt(d.explicacao), exemplo: txt(d.exemplo), ...base });
  }
  if (tipo === "completar") {
    let frase = txt(d.frase);
    const resposta = txt(d.resposta);
    if (!resposta || !frase) throw new Error("frase incompleta");
    if (!frase.includes("____")) {
      // A IA às vezes deixa a palavra na frase: tira-se aqui.
      const i = frase.toLowerCase().indexOf(resposta.toLowerCase());
      if (i < 0) throw new Error("frase sem espaço");
      frase = frase.slice(0, i) + "____" + frase.slice(i + resposta.length);
    }
    frase = frase.replace(/_{2,}/g, "____");
    const aceites = Array.isArray(d.aceites) ? (d.aceites as unknown[]).map(txt).filter(Boolean).slice(0, 6) : [];
    return { tipo, frase, resposta, aceites, dica: txt(d.dica), porque: txt(d.porque) };
  }
  const pontos = Array.isArray(d.pontos) ? (d.pontos as unknown[]).map(txt).filter(Boolean).slice(0, 4) : [];
  if (!txt(d.pergunta) || pontos.length === 0) throw new Error("pergunta aberta incompleta");
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
  try {
    const bruto = await gerar<Record<string, unknown>>(sistema(s, plano), pedido(a, conceitos, anteriores), ESQUEMAS[a.tipo]);
    const dados = validar(a.tipo, bruto);
    await mudarProgresso(id, (q) => {
      const x = q.atividades.find((y) => y.id === atividadeId);
      if (x && x.estado === "por_gerar") Object.assign(x, { dados, estado: "pronta" });
    });
  } catch (e) {
    console.error("[study] atividade", id, atividadeId, e);
    await mudarProgresso(id, (q) => {
      const x = q.atividades.find((y) => y.id === atividadeId);
      if (!x) return;
      x.tentativas = (x.tentativas ?? 0) + 1;
      if (x.tentativas >= 3) x.estado = "erro";
    });
  }
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
          "Diz se a resposta do aluno está certa: aceita sinónimos, outra forma de dizer o mesmo e pequenos erros de ortografia, mas não aceita uma ideia diferente. " +
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
          "Não contes ideias que estejam erradas. " +
          "\"feedback\" fala com o aluno em 2 ou 3 frases: diz o que está bem e, se faltar alguma coisa, o que falta, sem dar a resposta toda. Vai direto ao assunto: sem \"Olá\" e sem elogios feitos como \"És um bom aluno\".",
        {
          type: "object",
          properties: { presentes: { type: "array", items: { type: "boolean" } }, feedback: { type: "string" } },
          required: ["presentes", "feedback"],
        },
        0,
      );
      const total = a.dados.pontos.length;
      const tem = (r.presentes ?? []).slice(0, total).filter(Boolean).length;
      // Certa com pelo menos 70% das ideias essenciais.
      const certo = tem >= Math.ceil(total * 0.7);
      resultado = { certo, parcial: !certo && tem > 0, feedback: limpar(r.feedback ?? "") };
    } else return;
  } catch (e) {
    console.error("[study] corrigir", id, atividadeId, e);
    await mudarProgresso(id, (q) => {
      const x = q.atividades.find((y) => y.id === atividadeId);
      if (!x) return;
      x.tentativas = (x.tentativas ?? 0) + 1;
      if (x.tentativas >= 3) Object.assign(x, { estado: "corrigida", certo: false, feedback: "Não consegui corrigir esta resposta. Compara com a resposta modelo." });
    });
    return;
  }
  await mudarProgresso(id, (q) => {
    const x = q.atividades.find((y) => y.id === atividadeId);
    if (x && x.estado === "a_corrigir") {
      Object.assign(x, { estado: "corrigida", ...resultado });
      reforcar(q, x);
    }
  });
}

// Quando o aluno erra, entra uma atividade a mais sobre o mesmo conceito no
// fim da mesma etapa (só uma por conceito e etapa, para não ficar preso).
function reforcar(p: Progresso, a: Atividade) {
  if (a.certo || a.extra) return;
  const ja = p.atividades.some((x) => x.extra && x.etapa === a.etapa && x.conceitos.join() === a.conceitos.join());
  if (ja) return;
  let fim = p.atividades.length - 1;
  while (fim >= 0 && p.atividades[fim].etapa !== a.etapa) fim--;
  p.atividades.splice(fim + 1, 0, {
    id: novoId(),
    etapa: a.etapa,
    tipo: a.tipo,
    conceitos: a.conceitos,
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
        await corrigir(id, corrigirA.id);
        continue;
      }
      const proxima = p.atividades.slice(p.atual, p.atual + 3).find((a) => a.estado === "por_gerar");
      if (!proxima) return;
      await criarAtividade(id, proxima.id);
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
    if (s.estado === "a_planear") acordar(id, () => planear(id).catch(() => falhar(id, "Não consegui preparar o plano. Tenta de novo.")));
    if (s.estado === "pronto") acordarAtividades(id);
  }

  const plano = s.estado === "pronto" ? (s.plano as unknown as Plano) : null;
  const p = s.progresso as unknown as Progresso | null;
  const atual = p?.atividades[p.atual] ?? null;
  return {
    id: s.id,
    estado: s.estado as VistaEstudo["estado"],
    paginas: s.paginas,
    lidas: s.lidas,
    erro: s.erro,
    plano,
    atual: p?.atual ?? 0,
    total: p?.atividades.length ?? 0,
    pausa: p?.pausa ?? null,
    atividade: atual ? esconder(atual) : null,
    resumo: (p?.atividades ?? []).map((a) => ({
      etapa: a.etapa,
      conceitos: a.conceitos,
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
    const d = a.dados;
    if (d.tipo === "explicacao" || d.tipo === "escolha") {
      a.certo = Number(texto) === d.correta;
      a.estado = "corrigida";
      a.feedback = d.porque;
      reforcar(p, a);
    } else if (d.tipo === "completar" && [d.resposta, ...d.aceites].some((x) => normalizar(x) === normalizar(texto))) {
      a.certo = true;
      a.estado = "corrigida";
      a.feedback = d.porque;
    } else {
      // Respostas escritas que não batem certo à letra vão à IA.
      a.estado = "a_corrigir";
      a.tentativas = 0;
    }
  });
  acordarAtividades(id);
}

export async function avancar(id: string, atividadeId: string) {
  await mudarProgresso(id, (p) => {
    const a = p.atividades[p.atual];
    if (!a || a.id !== atividadeId || (a.estado !== "corrigida" && a.estado !== "erro")) return;
    p.atual++;
    const seguinte = p.atividades[p.atual];
    if (!seguinte || seguinte.etapa !== a.etapa) p.pausa = a.etapa;
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
