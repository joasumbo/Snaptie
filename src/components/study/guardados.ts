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
