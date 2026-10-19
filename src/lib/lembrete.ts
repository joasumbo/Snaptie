// O elemento Lembrete: o dono da página escolhe quando quer ser avisado e o
// servidor manda o email nesse dia. Três regras:
//   data   — uma vez, numa data certa
//   mes    — todos os meses, num dia do mês
//   semana — todas as semanas, num dia da semana
//
// As contas fazem-se na hora de Lisboa: "dia 5 às 9:00" é o que o dono vê no
// relógio, não o do servidor.

export const FUSO = "Europe/Lisbon";

export type RegraLembrete = "data" | "mes" | "semana";

export type Lembrete = {
  regra: RegraLembrete;
  data: string; // AAAA-MM-DD, para a regra "data"
  diaMes: number; // 1–31, para a regra "mes"
  diaSemana: number; // 0 = domingo … 6 = sábado, para a regra "semana"
  hora: string; // HH:MM
  mensagem: string;
  emails: string[];
  // Mostra na página pública quando é o próximo lembrete.
  mostrar: boolean;
};

export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function str(c: Record<string, unknown>, k: string): string {
  return typeof c[k] === "string" ? (c[k] as string) : "";
}
function int(c: Record<string, unknown>, k: string, min: number, max: number, padrao: number): number {
  const n = Math.floor(Number(c[k]));
  return Number.isFinite(n) && n >= min && n <= max ? n : padrao;
}

export function lerLembrete(c: Record<string, unknown>): Lembrete {
  const regra = c.regra === "data" || c.regra === "semana" ? c.regra : "mes";
  const hora = /^\d{2}:\d{2}$/.test(str(c, "hora")) ? str(c, "hora") : "09:00";
  return {
    regra,
    data: /^\d{4}-\d{2}-\d{2}$/.test(str(c, "data")) ? str(c, "data") : "",
    diaMes: int(c, "diaMes", 1, 31, 1),
    diaSemana: int(c, "diaSemana", 0, 6, 1),
    hora,
    mensagem: str(c, "mensagem").slice(0, 1000),
    emails: (Array.isArray(c.emails) ? c.emails : [])
      .filter((e): e is string => typeof e === "string")
      .map((e) => e.trim())
      .filter(Boolean)
      .slice(0, 2),
    mostrar: c.mostrar === true,
  };
}

// Data e hora de agora em Lisboa, já partidas.
export function agoraEmLisboa(agora = new Date()) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: FUSO,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(agora)
      .map((p) => [p.type, p.value]),
  );
  const dia = `${partes.year}-${partes.month}-${partes.day}`;
  return { dia, hora: `${partes.hour}:${partes.minute}` };
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

// O dia (AAAA-MM-DD) é dia de lembrete? Um "dia 31" cai no último dia dos
// meses mais curtos, senão fevereiro ficava sem aviso.
export function calhaNoDia(l: Lembrete, dia: string): boolean {
  const [ano, mes, d] = dia.split("-").map(Number);
  switch (l.regra) {
    case "data":
      return l.data === dia;
    case "mes":
      return d === Math.min(l.diaMes, ultimoDiaDoMes(ano, mes));
    case "semana":
      return new Date(Date.UTC(ano, mes - 1, d)).getUTCDay() === l.diaSemana;
  }
}

// O próximo dia de lembrete a partir de hoje (inclusive), ou null se a data
// única já passou. Serve para mostrar ao dono e na página.
export function proximoDia(l: Lembrete, hoje: string, horaAgora: string): string | null {
  const [ano, mes, d] = hoje.split("-").map(Number);
  const base = Date.UTC(ano, mes - 1, d);
  for (let i = 0; i <= 400; i++) {
    const data = new Date(base + i * 86_400_000);
    const dia = data.toISOString().slice(0, 10);
    if (i === 0 && horaAgora >= l.hora) continue;
    if (calhaNoDia(l, dia)) return dia;
    if (l.regra === "data" && dia > l.data) return null;
  }
  return null;
}

export function descreverRegra(l: Lembrete): string {
  switch (l.regra) {
    case "data":
      return l.data ? `a ${l.data.split("-").reverse().join("/")} às ${l.hora}` : "sem data";
    case "mes":
      return `todos os meses, dia ${l.diaMes}, às ${l.hora}`;
    case "semana":
      return `todas as semanas, ${DIAS_SEMANA[l.diaSemana].toLowerCase()}, às ${l.hora}`;
  }
}
