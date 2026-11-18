import "server-only";

// A IA do Study, num sítio só. Por agora é a JOAs: um Ollama com o gemma3:12b
// no servidor de GPU, a que o Jserver chega por um túnel SSH (joas.internal).
// Trocar de IA (por exemplo para a API do Claude) é mudar este ficheiro; o
// resto do Study só usa ler() e gerar().

const URL_IA = process.env.STUDY_IA_URL || "http://joas.internal:11500";
const MODELO = process.env.STUDY_IA_MODELO || "joas-gemma";

// A placa é partilhada e responde a um pedido de cada vez: um pedido pode ter
// de esperar pelos outros na fila.
const TEMPO_MAXIMO = 300_000;

type Mensagem = { role: "system" | "user"; content: string; images?: string[] };

async function conversar(mensagens: Mensagem[], formato?: object, temperatura = 0.4): Promise<string> {
  const r = await fetch(`${URL_IA}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELO,
      messages: mensagens,
      stream: false,
      ...(formato ? { format: formato } : {}),
      options: { temperature: temperatura },
    }),
    signal: AbortSignal.timeout(TEMPO_MAXIMO),
  });
  if (!r.ok) throw new Error(`IA respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = (await r.json()) as { message?: { content?: string } };
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
