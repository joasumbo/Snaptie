import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// As estatísticas do dono dos QRs: leituras, dispositivos diferentes e quem,
// depois de ler, interagiu (carregou num botão ou deixou uma mensagem).
//
// "Dispositivo" é a combinação IP + navegador. Não há cookies de seguimento,
// por isso é uma aproximação: o mesmo telemóvel que muda de rede conta duas
// vezes. Para a ordem de grandeza que interessa ao dono, chega.
//
// Tudo é contado na hora de Lisboa: "hoje" é o dia do relógio de quem lê.

export const PERIODOS = {
  "24h": { nome: "24 horas", unidade: "hour", passo: "1 hour", n: 24, formato: "YYYY-MM-DD HH24:00" },
  "5d": { nome: "5 dias", unidade: "day", passo: "1 day", n: 5, formato: "YYYY-MM-DD" },
  "10d": { nome: "10 dias", unidade: "day", passo: "1 day", n: 10, formato: "YYYY-MM-DD" },
  "30d": { nome: "30 dias", unidade: "day", passo: "1 day", n: 30, formato: "YYYY-MM-DD" },
  "12m": { nome: "12 meses", unidade: "month", passo: "1 month", n: 12, formato: "YYYY-MM" },
} as const;

export type PeriodoId = keyof typeof PERIODOS;

export function periodoValido(v: unknown): PeriodoId {
  return typeof v === "string" && v in PERIODOS ? (v as PeriodoId) : "10d";
}

export type Escopo = { companyId: string | null; qrId: string | null };

export type Totais = { leituras: number; dispositivos: number; interacoes: number; interagiram: number };

export type Estatisticas = {
  serie: { chave: string; leituras: number; dispositivos: number; interacoes: number }[];
  atual: Totais;
  anterior: Totais;
  porQr: { id: string; nome: string; leituras: number; dispositivos: number; interacoes: number }[];
  elementos: { titulo: string; tipo: string; qr: string; total: number }[];
  aparelhos: { tipo: string; total: number }[];
};

const LX = Prisma.raw(`'Europe/Lisbon'`);

// Que QRs entram nas contas: um, os de uma empresa, ou todos (administrador).
function filtroQr(coluna: Prisma.Sql, e: Escopo): Prisma.Sql {
  if (e.qrId) return Prisma.sql`${coluna} = ${e.qrId}`;
  if (e.companyId) return Prisma.sql`${coluna} in (select id from qr_codes where company_id = ${e.companyId})`;
  return Prisma.sql`true`;
}

// Hora de Lisboa de uma coluna guardada em UTC (timestamp sem fuso).
function local(coluna: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`((${coluna} at time zone 'UTC') at time zone ${LX})`;
}

const chaveDispositivo = Prisma.sql`coalesce(ip, '') || '|' || coalesce(navegador, '')`;

export async function obterEstatisticas(periodoId: PeriodoId, e: Escopo): Promise<Estatisticas> {
  const p = PERIODOS[periodoId];
  const unidade = Prisma.raw(`'${p.unidade}'`);
  const passo = Prisma.raw(`interval '${p.passo}'`);
  const formato = Prisma.raw(`'${p.formato}'`);
  // Constantes da tabela acima, nunca do pedido: entram direto no SQL.
  const n = Prisma.raw(String(p.n));
  const n1 = Prisma.raw(String(p.n - 1));

  // Início do período em hora de Lisboa, e esse instante em UTC para comparar
  // com as colunas (assim os índices por data servem).
  const inicioLocal = Prisma.sql`(date_trunc(${unidade}, now() at time zone ${LX}) - ${passo} * ${n1})`;
  const inicioUtc = Prisma.sql`((${inicioLocal} at time zone ${LX}) at time zone 'UTC')`;
  const anteriorUtc = Prisma.sql`(((${inicioLocal} - ${passo} * ${n}) at time zone ${LX}) at time zone 'UTC')`;

  const fA = filtroQr(Prisma.sql`a.qr_id`, e);
  const fI = filtroQr(Prisma.sql`i.qr_id`, e);
  const fB = filtroQr(Prisma.sql`b.qr_id`, e);

  // Interações = cliques + mensagens deixadas por visitantes. Os registos dos
  // lembretes enviados também vivem em qr_messages, mas não têm IP: ficam de fora.
  const interacoes = (desde: Prisma.Sql, ate: Prisma.Sql | null) => Prisma.sql`
    select i.qr_id, i.block_id, i.data_hora as quando, ${chaveDispositivo} as dispositivo
      from interacoes i
     where ${fI} and i.data_hora >= ${desde} ${ate ? Prisma.sql`and i.data_hora < ${ate}` : Prisma.empty}
    union all
    select b.qr_id, m.block_id, m.created_at, coalesce(m.ip, '') || '|'
      from qr_messages m join qr_blocks b on b.id = m.block_id
     where ${fB} and m.ip is not null and m.created_at >= ${desde} ${ate ? Prisma.sql`and m.created_at < ${ate}` : Prisma.empty}`;

  const [serie, totais, porQr, elementos, aparelhos] = await Promise.all([
    prisma.$queryRaw<{ chave: string; leituras: number; dispositivos: number; interacoes: number }[]>`
      with baldes as (
        select to_char(g, ${formato}) as chave
          from generate_series(${inicioLocal}, ${inicioLocal} + ${passo} * ${n1}, ${passo}) g
      ),
      l as (
        select to_char(date_trunc(${unidade}, ${local(Prisma.sql`a.data_hora`)}), ${formato}) as chave,
               count(*)::int as leituras,
               count(distinct coalesce(a.ip, '') || '|' || coalesce(a.navegador, ''))::int as dispositivos
          from analytics a
         where ${fA} and a.data_hora >= ${inicioUtc}
         group by 1
      ),
      x as (
        select to_char(date_trunc(${unidade}, ${local(Prisma.sql`quando`)}), ${formato}) as chave, count(*)::int as interacoes
          from (${interacoes(inicioUtc, null)}) t
         group by 1
      )
      select baldes.chave, coalesce(l.leituras, 0) as leituras, coalesce(l.dispositivos, 0) as dispositivos,
             coalesce(x.interacoes, 0) as interacoes
        from baldes left join l using (chave) left join x using (chave)
       order by baldes.chave`,

    prisma.$queryRaw<{ periodo: string; leituras: number; dispositivos: number; interacoes: number; interagiram: number }[]>`
      select 'atual' as periodo,
             (select count(*)::int from analytics a where ${fA} and a.data_hora >= ${inicioUtc}) as leituras,
             (select count(distinct coalesce(a.ip, '') || '|' || coalesce(a.navegador, ''))::int
                from analytics a where ${fA} and a.data_hora >= ${inicioUtc}) as dispositivos,
             (select count(*)::int from (${interacoes(inicioUtc, null)}) t) as interacoes,
             (select count(distinct dispositivo)::int from (${interacoes(inicioUtc, null)}) t) as interagiram
      union all
      select 'anterior',
             (select count(*)::int from analytics a where ${fA} and a.data_hora >= ${anteriorUtc} and a.data_hora < ${inicioUtc}),
             (select count(distinct coalesce(a.ip, '') || '|' || coalesce(a.navegador, ''))::int
                from analytics a where ${fA} and a.data_hora >= ${anteriorUtc} and a.data_hora < ${inicioUtc}),
             (select count(*)::int from (${interacoes(anteriorUtc, inicioUtc)}) t),
             (select count(distinct dispositivo)::int from (${interacoes(anteriorUtc, inicioUtc)}) t)`,

    prisma.$queryRaw<{ id: string; nome: string; leituras: number; dispositivos: number; interacoes: number }[]>`
      with l as (
        select a.qr_id, count(*)::int as leituras,
               count(distinct coalesce(a.ip, '') || '|' || coalesce(a.navegador, ''))::int as dispositivos
          from analytics a where ${fA} and a.data_hora >= ${inicioUtc} group by 1
      ),
      x as (select qr_id, count(*)::int as interacoes from (${interacoes(inicioUtc, null)}) t group by 1)
      select q.id, q.nome, coalesce(l.leituras, 0) as leituras, coalesce(l.dispositivos, 0) as dispositivos,
             coalesce(x.interacoes, 0) as interacoes
        from qr_codes q left join l on l.qr_id = q.id left join x on x.qr_id = q.id
       where ${filtroQr(Prisma.sql`q.id`, e)} and (l.leituras > 0 or x.interacoes > 0)
       order by leituras desc, interacoes desc
       limit 15`,

    prisma.$queryRaw<{ titulo: string; tipo: string; qr: string; total: number }[]>`
      select coalesce(nullif(b.titulo, ''), '') as titulo, b.tipo::text as tipo, q.nome as qr, count(*)::int as total
        from (${interacoes(inicioUtc, null)}) t
        join qr_blocks b on b.id = t.block_id
        join qr_codes q on q.id = b.qr_id
       group by b.id, b.titulo, b.tipo, q.nome
       order by total desc
       limit 10`,

    prisma.$queryRaw<{ tipo: string; total: number }[]>`
      select coalesce(a.dispositivo, 'Desconhecido') as tipo, count(*)::int as total
        from analytics a where ${fA} and a.data_hora >= ${inicioUtc}
       group by 1 order by total desc`,
  ]);

  const total = (k: string): Totais => {
    const r = totais.find((t) => t.periodo === k);
    return {
      leituras: r?.leituras ?? 0,
      dispositivos: r?.dispositivos ?? 0,
      interacoes: r?.interacoes ?? 0,
      interagiram: r?.interagiram ?? 0,
    };
  };

  return { serie, atual: total("atual"), anterior: total("anterior"), porQr, elementos, aparelhos };
}
