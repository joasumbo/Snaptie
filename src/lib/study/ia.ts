import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "@/lib/prisma";

// A IA do Study, num sítio só. É a JOAs: um Ollama no servidor de GPU, a que o
// Jserver chega por um túnel SSH (joas.internal). Trocar de IA é mudar este
// ficheiro; o resto do Study só usa ler() e gerar().
//
// O orquestrador escolhe o modelo pelo trabalho:
//   ler e plano            -> o forte (gemma3:12b, parte na placa): uma vez por
//                             estudo, onde a qualidade mais conta;
//   atividades, correções  -> o rápido (gemma3:4b, inteiro na placa): cerca de
//   e imagens                 100 palavras por segundo contra 9 do forte, e
//                             ocupa menos placa (2,7 GB contra 3,5 GB).
// A JOAs só tem um modelo carregado de cada vez, por isso a troca acontece
// uma vez por estudo, entre o plano e a primeira atividade.

const URL_IA = process.env.STUDY_IA_URL || "http://joas.internal:11500";
const MODELO_FORTE = process.env.STUDY_IA_MODELO || "joas-gemma";
const MODELO_RAPIDO = process.env.STUDY_IA_MODELO_RAPIDO || "gemma3:4b";
const TRABALHO_FORTE = new Set(["ler", "plano"]);

function modeloPara(tipo: string | undefined): { model: string; options: Record<string, number> } {
  if (tipo && !TRABALHO_FORTE.has(tipo) && MODELO_RAPIDO) return { model: MODELO_RAPIDO, options: { num_gpu: 99 } };
  return { model: MODELO_FORTE, options: {} };
}

// A placa é partilhada e responde a um pedido de cada vez: um pedido pode ter
// de esperar pelos outros na fila.
const TEMPO_MAXIMO = 300_000;

type Mensagem = { role: "system" | "user"; content: string; images?: string[] };

// Para o registo de consumo: o motor diz a que estudo e a que trabalho
// pertencem os pedidos que corre dentro de comUso().
const contexto = new AsyncLocalStorage<{ sessaoId: string; tipo: string }>();

export function comUso<T>(sessaoId: string, tipo: string, fn: () => Promise<T>): Promise<T> {
  return contexto.run({ sessaoId, tipo }, fn);
}

async function conversar(mensagens: Mensagem[], formato?: object, temperatura = 0.4): Promise<string> {
  const c = contexto.getStore();
  const { model, options } = modeloPara(c?.tipo);
  const r = await fetch(`${URL_IA}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: mensagens,
      stream: false,
      ...(formato ? { format: formato } : {}),
      options: { temperature: temperatura, ...options },
    }),
    signal: AbortSignal.timeout(TEMPO_MAXIMO),
  });
  if (!r.ok) throw new Error(`IA respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = (await r.json()) as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number; total_duration?: number };
  if (c)
    await prisma.studyUso
      .create({
        data: {
          sessaoId: c.sessaoId,
          tipo: c.tipo,
          entrada: d.prompt_eval_count ?? 0,
          saida: d.eval_count ?? 0,
          ms: Math.round((d.total_duration ?? 0) / 1e6),
        },
      })
      .catch((e) => console.warn("[study] uso", String(e)));
  return d.message?.content?.trim() ?? "";
}

// Transcreve uma fotografia de uma página (JPEG em base64).
export async function ler(imagemBase64: string): Promise<string> {
  return conversar(
    [
      {
        role: "user",
        content:
          "Transcreve todo o texto desta página de manual escolar, tal como está, em português: títulos, texto, legendas, caixas e vocabulário. " +
          "Se houver imagens, descreve cada uma numa linha começada por [Imagem: ...]. Só a transcrição, sem comentários. " +
          "Se a página estiver ilegível ou não for de um manual, responde só ILEGIVEL.",
        images: [imagemBase64],
      },
    ],
    undefined,
    0,
  );
}

// Pede uma resposta em JSON com a forma do esquema. O sistema vem primeiro e
// é igual entre pedidos do mesmo estudo, para a IA reaproveitar o que já leu.
export async function gerar<T>(sistema: string, pedido: string, esquema: object, temperatura = 0.4, imagens?: string[]): Promise<T> {
  let ultimo: unknown;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const texto = await conversar(
      [
        { role: "system", content: sistema },
        { role: "user", content: pedido, ...(imagens?.length ? { images: imagens } : {}) },
      ],
      esquema,
      temperatura,
    );
    try {
      return JSON.parse(texto) as T;
    } catch (e) {
      ultimo = e;
    }
  }
  throw new Error(`A IA não devolveu JSON válido: ${String(ultimo)}`);
}
