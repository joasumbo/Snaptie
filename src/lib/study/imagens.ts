import "server-only";

import https from "node:https";
import type { Imagem } from "@/lib/study/tipos";
import { gerar } from "@/lib/study/ia";

// Imagens das explicações: gravuras, pinturas, fotografias e esquemas reais da
// Wikipédia e do Wikimedia Commons, de uso livre, com a fonte por baixo. A IA
// não desenha nada (para não inventar): escolhe o que procurar e depois olha
// para cada candidata e só a aceita se mostrar mesmo o conceito, da época e do
// contexto certos. Sem imagem boa, a explicação segue sem imagem.

const AGENTE = "SnaptieStudy/1.0 (https://mysnaptie.com/study)";

// Pedido HTTPS por IPv4 e com tempo para ligar: o fetch do Node desiste ao fim
// de 250 ms por endereço e daqui o Wikimedia às vezes demora mais.
function pedir(url: string, tentativas = 3): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const r = https.get(url, { family: 4, timeout: 15_000, headers: { "User-Agent": AGENTE } }, (res) => {
      if ((res.statusCode ?? 500) >= 400) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const partes: Buffer[] = [];
      let tamanho = 0;
      res.on("data", (c: Buffer) => {
        tamanho += c.length;
        if (tamanho > 6_000_000) r.destroy(new Error("grande demais"));
        else partes.push(c);
      });
      res.on("end", () => resolve(Buffer.concat(partes)));
      res.on("error", reject);
    });
    r.on("timeout", () => r.destroy(new Error("tempo esgotado")));
    r.on("error", reject);
  }).catch((e) => (tentativas > 1 ? pedir(url, tentativas - 1) : Promise.reject(e)));
}

async function pedirJson<T>(url: string): Promise<T> {
  return JSON.parse((await pedir(url)).toString("utf8")) as T;
}

function semHtml(s: unknown, max = 120): string {
  if (typeof s !== "string") return "";
  const t = s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

type Candidata = { url: string; ficheiro: string; titulo: string; pagina: string };

// Primeiro as imagens principais dos artigos da Wikipédia em português (são as
// mais certeiras), depois a pesquisa no Commons.
async function candidatas(termo: string): Promise<Candidata[]> {
  const l: Candidata[] = [];
  try {
    const d = await pedirJson<{ query?: { pages?: Record<string, { index: number; title: string; pageimage?: string; thumbnail?: { source: string } }> } }>(
      "https://pt.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=4" +
        `&gsrsearch=${encodeURIComponent(termo)}&prop=pageimages&piprop=thumbnail|name&pithumbsize=900&pilicense=free`,
    );
    for (const p of Object.values(d.query?.pages ?? {}).sort((a, b) => a.index - b.index))
      if (p.thumbnail?.source && p.pageimage && !/\.svg$/i.test(p.pageimage))
        l.push({ url: p.thumbnail.source, ficheiro: p.pageimage, titulo: p.title, pagina: `https://pt.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}` });
  } catch (e) {
    console.warn("[study] wikipedia", termo, String(e));
  }
  try {
    const d = await pedirJson<{ query?: { pages?: Record<string, { index: number; title: string; imageinfo?: { thumburl?: string; mime?: string; width?: number; descriptionurl?: string }[] }> } }>(
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=6" +
        `&gsrsearch=${encodeURIComponent(`${termo} filetype:bitmap`)}&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=900`,
    );
    for (const p of Object.values(d.query?.pages ?? {}).sort((a, b) => a.index - b.index)) {
      const i = p.imageinfo?.[0];
      if (i?.thumburl && /image\/(jpeg|png)/.test(i.mime ?? "") && (i.width ?? 0) >= 400 && !/logo|icon|flag|coat of arms|signature/i.test(p.title))
        l.push({ url: i.thumburl, ficheiro: p.title.replace(/^File:/, ""), titulo: p.title.replace(/^File:|\.\w+$/g, ""), pagina: i.descriptionurl ?? "" });
    }
  } catch (e) {
    console.warn("[study] commons", termo, String(e));
  }
  const vistos = new Set<string>();
  return l.filter((c) => !vistos.has(c.ficheiro) && vistos.add(c.ficheiro));
}

// O autor e a licença, do Commons (as imagens da Wikipédia vêm de lá).
async function creditos(ficheiro: string): Promise<{ autor: string; licenca: string }> {
  try {
    const d = await pedirJson<{ query?: { pages?: Record<string, { imageinfo?: { extmetadata?: Record<string, { value?: string }> }[] }> } }>(
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata" +
        `&titles=${encodeURIComponent(`File:${ficheiro}`)}`,
    );
    const m = Object.values(d.query?.pages ?? {})[0]?.imageinfo?.[0]?.extmetadata ?? {};
    return { autor: semHtml(m.Artist?.value, 60), licenca: semHtml(m.LicenseShortName?.value, 30) };
  } catch {
    return { autor: "", licenca: "" };
  }
}

// A IA olha para a imagem e diz se serve para explicar o conceito.
async function serve(c: Candidata, conceito: string, contexto: string): Promise<boolean> {
  // O Wikimedia só serve miniaturas em tamanhos fixos (250, 500, 960...).
  const img = await pedir(c.url.replace(/\/\d+px-/, "/500px-"));
  const r = await gerar<{ descricao: string; serve: boolean }>(
    "Escolhes imagens para explicações de manuais escolares. Respondes em português de Portugal.",
    `Esta imagem vai aparecer ao lado de uma explicação para um aluno sobre "${conceito}", no tema "${contexto}". ` +
      "Em \"descricao\", diz numa frase o que a imagem mostra. " +
      "Em \"serve\", responde true só se a imagem mostra claramente o conceito, na época e no contexto certos e sem passar informação errada. " +
      "Responde false se é uma fotografia moderna para um tema histórico, se mostra outra coisa, se é um logótipo, um texto, um mapa sem relação ou se não se percebe.",
    { type: "object", properties: { descricao: { type: "string" }, serve: { type: "boolean" } }, required: ["descricao", "serve"] },
    0,
    [img.toString("base64")],
  );
  console.info("[study] imagem", c.ficheiro, r.serve, r.descricao);
  return Boolean(r.serve);
}

// A primeira imagem boa, saltando as já usadas no estudo. Vê no máximo duas, para o aluno não esperar.
export async function procurarImagem(termo: string, conceito: string, contexto: string, usadas: string[] = []): Promise<Imagem | null> {
  const q = termo.trim();
  if (!q) return null;
  const l = (await candidatas(q)).filter((c) => !usadas.includes(c.url)).slice(0, 2);
  for (const c of l) {
    try {
      if (!(await serve(c, conceito, contexto))) continue;
      const { autor, licenca } = await creditos(c.ficheiro);
      return { url: c.url, pagina: c.pagina, legenda: c.titulo, autor, licenca };
    } catch (e) {
      console.warn("[study] imagem", c.ficheiro, String(e));
    }
  }
  return null;
}
