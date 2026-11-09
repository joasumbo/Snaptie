import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stripe, stripeConfigurado } from "@/lib/stripe";

// O painel de faturação: o dinheiro que entrou pelo Snaptie, contado na hora
// de Lisboa. Só conta o que está pago; a data é a do pagamento.

const QUANDO = Prisma.sql`(coalesce(pago_em, updated_at) AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Lisbon')`;
const AGORA = Prisma.sql`(now() AT TIME ZONE 'Europe/Lisbon')`;

export type Totais = {
  hoje: number;
  ontem: number;
  semana: number;
  semanaPassada: number;
  mes: number;
  mesPassado: number;
  ano: number;
  anoPassado: number;
  total: number;
  pagamentosMes: number;
};

export async function totais(): Promise<Totais> {
  const [r] = await prisma.$queryRaw<Record<keyof Totais, bigint | null>[]>`
    SELECT
      sum(valor_centimos) FILTER (WHERE ${QUANDO}::date = ${AGORA}::date) AS hoje,
      sum(valor_centimos) FILTER (WHERE ${QUANDO}::date = ${AGORA}::date - 1) AS ontem,
      sum(valor_centimos) FILTER (WHERE ${QUANDO} >= date_trunc('week', ${AGORA})) AS semana,
      sum(valor_centimos) FILTER (WHERE ${QUANDO} >= date_trunc('week', ${AGORA}) - interval '7 days'
                                   AND ${QUANDO} < date_trunc('week', ${AGORA})) AS "semanaPassada",
      sum(valor_centimos) FILTER (WHERE ${QUANDO} >= date_trunc('month', ${AGORA})) AS mes,
      sum(valor_centimos) FILTER (WHERE ${QUANDO} >= date_trunc('month', ${AGORA}) - interval '1 month'
                                   AND ${QUANDO} < date_trunc('month', ${AGORA})) AS "mesPassado",
      sum(valor_centimos) FILTER (WHERE ${QUANDO} >= date_trunc('year', ${AGORA})) AS ano,
      sum(valor_centimos) FILTER (WHERE ${QUANDO} >= date_trunc('year', ${AGORA}) - interval '1 year'
                                   AND ${QUANDO} < date_trunc('year', ${AGORA})) AS "anoPassado",
      sum(valor_centimos) AS total,
      count(*) FILTER (WHERE ${QUANDO} >= date_trunc('month', ${AGORA})) AS "pagamentosMes"
    FROM pagamentos WHERE estado = 'pago'`;
  const n = (v: bigint | null | undefined) => Number(v ?? 0);
  return {
    hoje: n(r?.hoje),
    ontem: n(r?.ontem),
    semana: n(r?.semana),
    semanaPassada: n(r?.semanaPassada),
    mes: n(r?.mes),
    mesPassado: n(r?.mesPassado),
    ano: n(r?.ano),
    anoPassado: n(r?.anoPassado),
    total: n(r?.total),
    pagamentosMes: n(r?.pagamentosMes),
  };
}

export type Ponto = { chave: string; valor: number };

// Últimos 30 dias, dia a dia, e últimos 12 meses, mês a mês. Os dias sem
// pagamentos aparecem a zero, para o gráfico não saltar datas.
export async function series(): Promise<{ dias: Ponto[]; meses: Ponto[] }> {
  const dias = await prisma.$queryRaw<{ chave: string; valor: bigint }[]>`
    SELECT to_char(d, 'YYYY-MM-DD') AS chave, coalesce(sum(p.valor_centimos), 0) AS valor
    FROM generate_series(${AGORA}::date - 29, ${AGORA}::date, interval '1 day') d
    LEFT JOIN pagamentos p ON p.estado = 'pago' AND ${Prisma.sql`(coalesce(p.pago_em, p.updated_at) AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Lisbon')`}::date = d::date
    GROUP BY d ORDER BY d`;
  const meses = await prisma.$queryRaw<{ chave: string; valor: bigint }[]>`
    SELECT to_char(m, 'YYYY-MM') AS chave, coalesce(sum(p.valor_centimos), 0) AS valor
    FROM generate_series(date_trunc('month', ${AGORA}) - interval '11 months', date_trunc('month', ${AGORA}), interval '1 month') m
    LEFT JOIN pagamentos p ON p.estado = 'pago'
      AND date_trunc('month', ${Prisma.sql`(coalesce(p.pago_em, p.updated_at) AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Lisbon')`}) = m
    GROUP BY m ORDER BY m`;
  const conv = (l: { chave: string; valor: bigint }[]) => l.map((x) => ({ chave: x.chave, valor: Number(x.valor) }));
  return { dias: conv(dias), meses: conv(meses) };
}

// Quanto as subscrições ativas rendem por mês (as anuais contam 1/12).
export async function recorrente(): Promise<{ mensal: number; empresas: number }> {
  const ativas = await prisma.company.findMany({
    where: { deletedAt: null, subscricaoEstado: { in: ["ativa", "em_falta"] }, subscricaoCancela: false },
    select: { pacote: { select: { precoCentimos: true, intervalo: true } } },
  });
  let mensal = 0;
  for (const c of ativas) {
    if (!c.pacote) continue;
    if (c.pacote.intervalo === "mes") mensal += c.pacote.precoCentimos;
    else if (c.pacote.intervalo === "ano") mensal += Math.round(c.pacote.precoCentimos / 12);
  }
  return { mensal, empresas: ativas.length };
}

export type Saldo = {
  disponivel: number;
  aCaminho: number;
  proximaTransferencia: { valor: number; data: string } | null;
} | null;

// O saldo é o da conta Stripe inteira, que é partilhada com outros projetos
// da Inpulse: o painel diz isso ao lado do número.
export async function saldo(): Promise<Saldo> {
  if (!stripeConfigurado()) return null;
  try {
    const s = stripe();
    const [b, transf] = await Promise.all([
      s.balance.retrieve(),
      s.payouts.list({ limit: 5 }),
    ]);
    const soma = (l: { amount: number; currency: string }[]) =>
      l.filter((x) => x.currency === "eur").reduce((t, x) => t + x.amount, 0);
    const proxima = transf.data
      .filter((p) => p.status === "pending" || p.status === "in_transit")
      .sort((a, b) => a.arrival_date - b.arrival_date)[0];
    return {
      disponivel: soma(b.available),
      aCaminho: soma(b.pending),
      proximaTransferencia: proxima
        ? { valor: proxima.amount, data: new Date(proxima.arrival_date * 1000).toISOString() }
        : null,
    };
  } catch (e) {
    console.error("[faturacao] saldo", e);
    return null;
  }
}

export type Filtros = {
  de: string;
  ate: string;
  tipo: string;
  estado: string;
  q: string;
  pagina: number;
};

export function lerFiltros(sp: Record<string, string | undefined>): Filtros {
  const data = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
  return {
    de: data(sp.de),
    ate: data(sp.ate),
    tipo: ["pacote", "renovacao", "link", "botao"].includes(sp.tipo ?? "") ? sp.tipo! : "",
    estado: ["pago", "pendente", "falhou", "expirado"].includes(sp.estado ?? "") ? sp.estado! : "pago",
    q: (sp.q ?? "").trim().slice(0, 80),
    pagina: Math.max(1, Math.min(1000, Number(sp.pagina) || 1)),
  };
}

// A data de um dia em Lisboa, como instante UTC (o que está na base).
function inicioDoDia(dia: string): Date {
  const [a, m, d] = dia.split("-").map(Number);
  const meioDia = new Date(Date.UTC(a!, m! - 1, d!, 12));
  const fuso = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", timeZoneName: "shortOffset" })
    .formatToParts(meioDia)
    .find((p) => p.type === "timeZoneName")?.value;
  const horas = Number(fuso?.replace("GMT", "") || 0);
  return new Date(Date.UTC(a!, m! - 1, d!, -horas));
}

function onde(f: Filtros): Prisma.PagamentoWhereInput {
  const where: Prisma.PagamentoWhereInput = {};
  if (f.estado) where.estado = f.estado;
  if (f.tipo) where.tipo = f.tipo;
  const quando: Prisma.DateTimeFilter = {};
  if (f.de) quando.gte = inicioDoDia(f.de);
  if (f.ate) quando.lt = new Date(inicioDoDia(f.ate).getTime() + 86_400_000);
  // Pagos contam pela data do pagamento; os restantes, pela data em que foram criados.
  if (f.de || f.ate) {
    if (f.estado === "pago") where.OR = [{ pagoEm: quando }, { pagoEm: null, updatedAt: quando }];
    else where.createdAt = quando;
  }
  if (f.q) {
    where.AND = [{ OR: [
      { descricao: { contains: f.q, mode: "insensitive" } },
      { email: { contains: f.q, mode: "insensitive" } },
      { nomeCliente: { contains: f.q, mode: "insensitive" } },
      { numero: { contains: f.q, mode: "insensitive" } },
      { company: { nome: { contains: f.q, mode: "insensitive" } } },
      { moloniFatura: { contains: f.q, mode: "insensitive" } },
      { nifCliente: { contains: f.q } },
    ] }];
  }
  return where;
}

export const POR_PAGINA = 50;

export async function listaPagamentos(f: Filtros, todos = false) {
  const where = onde(f);
  const [linhas, contagem, soma] = await Promise.all([
    prisma.pagamento.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: todos ? 10_000 : POR_PAGINA,
      skip: todos ? 0 : (f.pagina - 1) * POR_PAGINA,
      include: { company: { select: { nome: true, email: true, nif: true } }, pacote: { select: { nome: true } } },
    }),
    prisma.pagamento.count({ where }),
    prisma.pagamento.aggregate({ where, _sum: { valorCentimos: true } }),
  ]);
  return { linhas, contagem, soma: soma._sum.valorCentimos ?? 0 };
}

// O total do período escolhido, dividido por tipo de pagamento.
export async function porTipo(f: Filtros): Promise<{ tipo: string; valor: number; n: number }[]> {
  const g = await prisma.pagamento.groupBy({
    by: ["tipo"],
    where: onde(f),
    _sum: { valorCentimos: true },
    _count: { _all: true },
  });
  return g
    .map((x) => ({ tipo: x.tipo, valor: x._sum.valorCentimos ?? 0, n: x._count._all }))
    .sort((a, b) => b.valor - a.valor);
}

// Pagamentos pagos sem fatura emitida (a Moloni falhou ou ainda não chegou
// a vez), desde que a faturação foi ligada.
export async function faturasPorEmitir(desde: Date | null): Promise<number> {
  if (!desde) return 0;
  return prisma.pagamento.count({
    where: { estado: "pago", pagoEm: { gte: desde }, OR: [{ moloniFaturaPdf: null }, { moloniFaturaId: null }] },
  });
}

// O que está por receber: pagamentos falhados e empresas em falta ou suspensas.
export async function emFalta() {
  const empresas = await prisma.company.findMany({
    where: { deletedAt: null, OR: [{ suspensaPagamento: true }, { emFaltaDesde: { not: null } }] },
    select: { id: true, nome: true, suspensaPagamento: true, emFaltaDesde: true },
    orderBy: { emFaltaDesde: "asc" },
  });
  const porPagar = await prisma.pagamento.findMany({
    where: { tipo: "renovacao", estado: { in: ["falhou", "pendente"] } },
    select: { companyId: true, valorCentimos: true, id: true },
  });
  return empresas.map((e) => {
    const p = porPagar.filter((x) => x.companyId === e.id);
    return {
      id: e.id,
      nome: e.nome,
      suspensa: e.suspensaPagamento,
      desde: e.emFaltaDesde?.toISOString() ?? null,
      valor: p.reduce((t, x) => t + x.valorCentimos, 0),
      link: p[0] ? `/pagar/${p[0].id}` : null,
    };
  });
}
