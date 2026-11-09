"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Download, FileText, Minus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { NOMES_ESTADO_PAGAMENTO, euros } from "@/lib/pagamentos";

type Totais = {
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
type Ponto = { chave: string; valor: number };
type Linha = {
  id: string;
  data: string;
  tipo: string;
  estado: string;
  descricao: string;
  pacote: string;
  empresa: string;
  cliente: string;
  email: string;
  valorCentimos: number;
  moeda: string;
  numero: string | null;
  fatura: boolean;
};
type Filtros = { de: string; ate: string; tipo: string; estado: string; q: string; pagina: number };

const TIPOS: Record<string, string> = {
  pacote: "Pacote",
  renovacao: "Renovação",
  link: "Link de pagamento",
  botao: "Botão na página",
};
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const eurosCurto = (c: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: c % 100 === 0 ? 0 : 2 }).format(c / 100);

function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Lisbon",
  });
}

function variacao(agora: number, antes: number) {
  if (antes === 0) return { texto: agora > 0 ? "novo" : "0%", sentido: agora > 0 ? 1 : 0 };
  const pct = Math.round(((agora - antes) / antes) * 100);
  return { texto: `${Math.abs(pct)}%`, sentido: Math.sign(pct) };
}

function Indicador({ label, valor, nota, delta }: { label: string; valor: string; nota: string; delta?: { texto: string; sentido: number } }) {
  const Icone = delta?.sentido === 1 ? ArrowUp : delta?.sentido === -1 ? ArrowDown : Minus;
  return (
    <Card>
      <CardContent>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums">{valor}</span>
          {delta ? (
            <span
              className={`inline-flex items-center gap-0.5 text-sm font-medium ${
                delta.sentido === 1 ? "text-emerald-700" : delta.sentido === -1 ? "text-red-700" : "text-muted-foreground"
              }`}
            >
              <Icone className="size-3.5" aria-hidden />
              {delta.texto}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{nota}</div>
      </CardContent>
    </Card>
  );
}

function rotulo(chave: string, unidade: "dia" | "mes") {
  if (unidade === "mes") return MESES[Number(chave.slice(5, 7)) - 1] ?? chave;
  return String(Number(chave.slice(8, 10)));
}

function rotuloLongo(chave: string, unidade: "dia" | "mes") {
  if (unidade === "mes") return `${MESES[Number(chave.slice(5, 7)) - 1]} ${chave.slice(0, 4)}`;
  return new Date(`${chave}T12:00:00Z`).toLocaleDateString("pt-PT", { weekday: "short", day: "numeric", month: "short" });
}

function Grafico({ pontos, unidade }: { pontos: Ponto[]; unidade: "dia" | "mes" }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(640);
  const [ativo, setAtivo] = useState<number | null>(null);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.max(280, Math.floor(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const altura = 220;
  const m = { topo: 12, dir: 8, base: 26, esq: 52 };
  const w = largura - m.esq - m.dir;
  const h = altura - m.topo - m.base;
  const max = Math.max(0, ...pontos.map((p) => p.valor));
  const passo = max <= 0 ? 100 : Math.pow(10, Math.floor(Math.log10(max / 4)));
  const topo = max <= 0 ? 400 : Math.ceil(max / 4 / passo) * passo * 4;
  const marcas = [0, topo / 4, topo / 2, (topo * 3) / 4, topo];
  const banda = w / Math.max(1, pontos.length);
  const barra = Math.min(26, Math.max(3, banda - 3));
  const y = (v: number) => m.topo + h - (v / topo) * h;
  const cada = Math.max(1, Math.ceil(30 / banda));
  const ponto = ativo !== null ? pontos[ativo] : null;

  return (
    <div ref={caixa} className="viz relative w-full">
      <svg width={largura} height={altura} role="img" aria-label="Faturação por período">
        {marcas.map((v) => (
          <g key={v}>
            <line x1={m.esq} x2={largura - m.dir} y1={y(v)} y2={y(v)} stroke="var(--viz-grelha)" />
            <text x={m.esq - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--viz-texto)" className="tabular-nums">
              {eurosCurto(v)}
            </text>
          </g>
        ))}
        {pontos.map((p, i) => {
          const x = m.esq + i * banda + (banda - barra) / 2;
          const alto = Math.max(0, y(0) - y(p.valor));
          const r = Math.min(4, barra / 2, alto);
          return (
            <g
              key={p.chave}
              tabIndex={0}
              onPointerEnter={() => setAtivo(i)}
              onPointerLeave={() => setAtivo(null)}
              onFocus={() => setAtivo(i)}
              onBlur={() => setAtivo(null)}
              className="outline-none"
            >
              <rect x={m.esq + i * banda} y={m.topo} width={banda} height={h} fill="transparent" />
              {alto > 0 ? (
                <path
                  d={`M${x},${y(0)} V${y(p.valor) + r} Q${x},${y(p.valor)} ${x + r},${y(p.valor)} H${x + barra - r} Q${x + barra},${y(p.valor)} ${x + barra},${y(p.valor) + r} V${y(0)} Z`}
                  fill="var(--viz-serie)"
                  opacity={ativo === null || ativo === i ? 1 : 0.55}
                />
              ) : null}
              {i % cada === 0 ? (
                <text x={m.esq + i * banda + banda / 2} y={altura - 8} textAnchor="middle" fontSize={11} fill="var(--viz-texto)">
                  {rotulo(p.chave, unidade)}
                </text>
              ) : null}
            </g>
          );
        })}
        <line x1={m.esq} x2={largura - m.dir} y1={y(0)} y2={y(0)} stroke="var(--viz-eixo)" />
      </svg>
      {ponto ? (
        <div
          className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: Math.min(largura - 70, Math.max(70, m.esq + ativo! * banda + banda / 2)), top: Math.max(0, y(ponto.valor) - 52) }}
        >
          <div className="text-base font-semibold tabular-nums">{euros(ponto.valor)}</div>
          <div className="text-muted-foreground">{rotuloLongo(ponto.chave, unidade)}</div>
        </div>
      ) : null}
    </div>
  );
}

export default function FaturacaoView(props: {
  totais: Totais;
  series: { dias: Ponto[]; meses: Ponto[] };
  recorrente: { mensal: number; empresas: number };
  saldo: { disponivel: number; aCaminho: number; proximaTransferencia: { valor: number; data: string } | null } | null;
  emFalta: { id: string; nome: string; suspensa: boolean; desde: string | null; valor: number; link: string | null }[];
  filtros: Filtros;
  porPagina: number;
  contagem: number;
  soma: number;
  linhas: Linha[];
}) {
  const router = useRouter();
  const caminho = usePathname();
  const [vista, setVista] = useState<"dia" | "mes">("dia");
  const [f, setF] = useState(props.filtros);
  const t = props.totais;

  function query(novos: Partial<Filtros>) {
    const v = { ...f, ...novos };
    const q = new URLSearchParams();
    if (v.de) q.set("de", v.de);
    if (v.ate) q.set("ate", v.ate);
    if (v.tipo) q.set("tipo", v.tipo);
    if (v.estado && v.estado !== "pago") q.set("estado", v.estado);
    if (v.q) q.set("q", v.q);
    if (v.pagina > 1) q.set("pagina", String(v.pagina));
    return q.toString();
  }
  function aplicar(novos: Partial<Filtros>) {
    const v = { ...f, ...novos };
    setF(v);
    router.push(`${caminho}?${query(novos)}`, { scroll: false });
  }

  const paginas = Math.max(1, Math.ceil(props.contagem / props.porPagina));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador label="Hoje" valor={euros(t.hoje)} nota={`Ontem: ${euros(t.ontem)}`} delta={variacao(t.hoje, t.ontem)} />
        <Indicador label="Esta semana" valor={euros(t.semana)} nota={`Semana passada: ${euros(t.semanaPassada)}`} delta={variacao(t.semana, t.semanaPassada)} />
        <Indicador
          label="Este mês"
          valor={euros(t.mes)}
          nota={`Mês passado: ${euros(t.mesPassado)} · ${t.pagamentosMes} pagamento${t.pagamentosMes === 1 ? "" : "s"}`}
          delta={variacao(t.mes, t.mesPassado)}
        />
        <Indicador label="Este ano" valor={euros(t.ano)} nota={`Ano passado: ${euros(t.anoPassado)}`} delta={variacao(t.ano, t.anoPassado)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Indicador
          label="Receita recorrente mensal"
          valor={euros(props.recorrente.mensal)}
          nota={`${props.recorrente.empresas} empresa${props.recorrente.empresas === 1 ? "" : "s"} com subscrição ativa`}
        />
        <Card>
          <CardContent>
            <div className="text-sm text-muted-foreground">Saldo no Stripe</div>
            {props.saldo ? (
              <>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{euros(props.saldo.disponivel)}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Disponível · {euros(props.saldo.aCaminho)} a caminho
                  {props.saldo.proximaTransferencia
                    ? ` · próxima transferência ${euros(props.saldo.proximaTransferencia.valor)} a ${new Date(props.saldo.proximaTransferencia.data).toLocaleDateString("pt-PT")}`
                    : ""}
                </div>
                <div className="mt-1 text-xs text-amber-700">A conta Stripe é partilhada com outros projetos da Inpulse.</div>
              </>
            ) : (
              <div className="mt-1 text-sm text-muted-foreground">Indisponível de momento.</div>
            )}
          </CardContent>
        </Card>
        <Indicador label="Total desde o início" valor={euros(t.total)} nota="Tudo o que entrou pelo Snaptie" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Faturação</CardTitle>
            <CardDescription>{vista === "dia" ? "Últimos 30 dias" : "Últimos 12 meses"}</CardDescription>
          </div>
          <Segmented
            value={vista}
            onChange={(v) => setVista(v as "dia" | "mes")}
            options={[
              { value: "dia", label: "Por dia" },
              { value: "mes", label: "Por mês" },
            ]}
          />
        </CardHeader>
        <CardContent>
          <Grafico pontos={vista === "dia" ? props.series.dias : props.series.meses} unidade={vista} />
        </CardContent>
      </Card>

      {props.emFalta.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Por receber</CardTitle>
            <CardDescription>Empresas com a renovação por pagar.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {props.emFalta.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <span>
                    <span className="font-medium">{e.nome}</span>
                    {e.desde ? <span className="text-muted-foreground"> · em falta desde {new Date(e.desde).toLocaleDateString("pt-PT")}</span> : null}
                  </span>
                  <span className="flex items-center gap-2">
                    {e.suspensa ? <Badge variant="destructive">Suspensa</Badge> : <Badge variant="secondary">Em falta</Badge>}
                    <span className="font-medium tabular-nums">{euros(e.valor)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Pagamentos</CardTitle>
            <CardDescription>
              {props.contagem} pagamento{props.contagem === 1 ? "" : "s"} · {euros(props.soma)}
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" nativeButton={false} render={<a href={`/api/faturacao/export?${query({ pagina: 1 })}`} />}>
            <Download /> Excel
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr]"
            onSubmit={(e) => {
              e.preventDefault();
              aplicar({ pagina: 1 });
            }}
          >
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Empresa, cliente, email ou n.º"
                value={f.q}
                onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))}
              />
            </div>
            <Input type="date" aria-label="Desde" value={f.de} onChange={(e) => aplicar({ de: e.target.value, pagina: 1 })} />
            <Input type="date" aria-label="Até" value={f.ate} onChange={(e) => aplicar({ ate: e.target.value, pagina: 1 })} />
            <select
              className="h-9 rounded-md border bg-transparent px-2 text-sm"
              aria-label="Tipo"
              value={f.tipo}
              onChange={(e) => aplicar({ tipo: e.target.value, pagina: 1 })}
            >
              <option value="">Todos os tipos</option>
              {Object.entries(TIPOS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border bg-transparent px-2 text-sm"
              aria-label="Estado"
              value={f.estado}
              onChange={(e) => aplicar({ estado: e.target.value, pagina: 1 })}
            >
              {Object.entries(NOMES_ESTADO_PAGAMENTO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </form>

          {props.linhas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum pagamento com estes filtros.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Data</th>
                    <th className="py-2 pr-3 font-medium">Quem pagou</th>
                    <th className="py-2 pr-3 font-medium">Descrição</th>
                    <th className="py-2 pr-3 font-medium">Tipo</th>
                    <th className="py-2 pr-3 text-right font-medium">Valor</th>
                    <th className="py-2 pr-3 font-medium">Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {props.linhas.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{dataHora(p.data)}</td>
                      <td className="py-2 pr-3">
                        <div className="font-medium">{p.empresa || p.cliente || p.email || "Sem nome"}</div>
                        {p.email && (p.empresa || p.cliente) ? <div className="text-xs text-muted-foreground">{p.email}</div> : null}
                      </td>
                      <td className="py-2 pr-3">
                        {p.descricao}
                        {p.numero ? <div className="text-xs text-muted-foreground">{p.numero}</div> : null}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{TIPOS[p.tipo] ?? p.tipo}</td>
                      <td className="py-2 pr-3 text-right font-medium whitespace-nowrap tabular-nums">{euros(p.valorCentimos, p.moeda)}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={p.estado === "pago" ? "default" : p.estado === "pendente" ? "secondary" : "destructive"}>
                          {NOMES_ESTADO_PAGAMENTO[p.estado] ?? p.estado}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">
                        {p.estado === "pago" ? (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Ver comprovativo"
                            nativeButton={false}
                            render={<a href={`/pagar/${p.id}/${p.fatura ? "fatura" : "comprovativo"}`} target="_blank" rel="noreferrer" />}
                          >
                            <FileText />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {paginas > 1 ? (
            <div className="flex items-center justify-end gap-2 text-sm">
              <Button size="sm" variant="outline" disabled={f.pagina <= 1} onClick={() => aplicar({ pagina: f.pagina - 1 })}>
                Anterior
              </Button>
              <span className="text-muted-foreground">
                Página {f.pagina} de {paginas}
              </span>
              <Button size="sm" variant="outline" disabled={f.pagina >= paginas} onClick={() => aplicar({ pagina: f.pagina + 1 })}>
                Seguinte
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
