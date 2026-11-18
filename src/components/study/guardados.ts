// Os estudos deste aparelho, para os retomar sem conta. Se o browser não
// guardar nada (janela privada), o estudo continua a funcionar pelo link.

export type EstudoGuardado = { id: string; criado: number; tema?: string };

const CHAVE = "study-estudos";

export function lerGuardados(): EstudoGuardado[] {
  try {
    const l = JSON.parse(localStorage.getItem(CHAVE) ?? "[]");
    return Array.isArray(l) ? l.filter((x) => x && typeof x.id === "string") : [];
  } catch {
    return [];
  }
}

export function guardarEstudo(e: EstudoGuardado) {
  try {
    const l = lerGuardados();
    const i = l.findIndex((x) => x.id === e.id);
    if (i >= 0) l[i] = { ...l[i], ...e, criado: l[i].criado };
    else l.unshift(e);
    localStorage.setItem(CHAVE, JSON.stringify(l.slice(0, 20)));
  } catch {}
}

// Reduz a fotografia no próprio telemóvel: a IA lê bem a 1600 px e o envio
// fica dez vezes mais leve.
export async function reduzir(f: File): Promise<string> {
  const bmp = await createImageBitmap(f);
  const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * escala);
  c.height = Math.round(bmp.height * escala);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL("image/jpeg", 0.82).split(",")[1];
}
