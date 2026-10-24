"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { BLOCK_TYPE_LABELS } from "@/lib/qr";
import type { BlockType } from "@prisma/client";
import type { Estatisticas, Totais } from "@/lib/estatisticas";

type Metrica = "leituras" | "dispositivos" | "interacoes";

const METRICAS: { valor: Metrica; label: string; descricao: string }[] = [
  { valor: "leituras", label: "Leituras", descricao: "Vezes que os QR codes foram abertos" },
  { valor: "dispositivos", label: "Dispositivos", descricao: "Telemóveis e computadores diferentes" },
  { valor: "interacoes", label: "Interações", descricao: "Cliques em botões e mensagens deixadas" },
];

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Rótulo curto do eixo, conforme o tamanho de cada barra.
function rotulo(chave: string, unidade: string): string {
  if (unidade === "hour") return `${chave.slice(11, 13)}h`;
  if (unidade === "month") return MESES[Number(chave.slice(5, 7)) - 1] ?? chave;
  return `${chave.slice(8, 10)}/${chave.slice(5, 7)}`;
}

// Rótulo completo, para a dica e a tabela.
function rotuloLongo(chave: string, unidade: string): string {
  if (unidade === "hour") return `${chave.slice(8, 10)}/${chave.slice(5, 7)}, ${chave.slice(11, 13)}h00`;
  if (unidade === "month") return `${MESES[Number(chave.slice(5, 7)) - 1]} ${chave.slice(0, 4)}`;
  return `${chave.slice(8, 10)}/${chave.slice(5, 7)}/${chave.slice(0, 4)}`;
}

const compacto = new Intl.NumberFormat("pt-PT", { notation: "compact", maximumFractionDigits: 1 });
const inteiro = new Intl.NumberFormat("pt-PT");

// Marcas redondas do eixo: 1, 2, 5 × 10^n, para no máximo ~4 linhas.
function escala(max: number): number[] {
  if (max <= 0) return [0, 1];
  const bruto = max / 4;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? pot * 10;
  const topo = Math.ceil(max / passo) * passo;
  const marcas: number[] = [];
  for (let v = 0; v <= topo + 1e-9; v += passo) marcas.push(Math.round(v));
  return marcas;
}

function taxa(t: Totais): number | null {
  return t.dispositivos > 0 ? (t.interagiram / t.dispositivos) * 100 : null;
}

export default function EstatisticasView({
  dados,
  periodo,
  periodos,
  unidade,
  isAdmin,
  empresas,
  empresaId,
  qrs,
  qrId,
}: {
  dados: Estatisticas;
  periodo: string;
  periodos: { id: string; nome: string }[];
  unidade: string;
  isAdmin: boolean;
  empresas: { id: string; nome: string }[];
  empresaId: string | null;
  qrs: { id: string; nome: string }[];
  qrId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [metrica, setMetrica] = useState<Metrica>("leituras");
  const [verTabela, setVerTabela] = useState(false);

  function filtrar(mudancas: Record<string, string | null>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(mudancas)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.push(`${pathname}?${p.toString()}`);
  }

  const { atual, anterior } = dados;
  const semComparacao = anterior.leituras === 0 && anterior.interacoes === 0;
  const nomePeriodo = periodos.find((p) => p.id === periodo)?.nome ?? "";
  const metricaAtual = METRICAS.find((m) => m.valor === metrica)!;

  return (
    <div className="space-y-6">
      <PageHeader title="Estatísticas" description="Quem lê os seus QR codes e o que faz a seguir." />

      {/* Filtros: uma linha, acima de tudo o que filtram. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="max-w-full overflow-x-auto [&_button]:whitespace-nowrap">
          <Segmented
            value={periodo}
            onChange={(v) => filtrar({ periodo: v })}
            options={periodos.map((p) => ({ value: p.id, label: p.nome }))}
          />
        </div>
        {isAdmin ? (
          <select
            value={empresaId ?? ""}
            onChange={(e) => filtrar({ empresa: e.target.value || null, qr: null })}
            className="h-9 rounded-lg border bg-background px-2 text-sm"
            aria-label="Empresa"
          >
            <option value="">Todas as empresas</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        ) : null}
        {qrs.length > 0 ? (
          <select
            value={qrId ?? ""}
            onChange={(e) => filtrar({ qr: e.target.value || null })}
            className="h-9 max-w-64 rounded-lg border bg-background px-2 text-sm"
            aria-label="QR code"
          >
            <option value="">Todos os QR codes</option>
            {qrs.map((q) => (
              <option key={q.id} value={q.id}>
                {q.nome}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {/* Indicadores */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          label="Leituras"
          valor={inteiro.format(atual.leituras)}
          delta={semComparacao ? null : variacao(atual.leituras, anterior.leituras)}
          nota="vezes que os QR foram abertos"
        />
        <Indicador
          label="Dispositivos diferentes"
          valor={inteiro.format(atual.dispositivos)}
          delta={semComparacao ? null : variacao(atual.dispositivos, anterior.dispositivos)}
          nota="telemóveis e computadores"
        />
        <Indicador
          label="Interações"
          valor={inteiro.format(atual.interacoes)}
          delta={semComparacao ? null : variacao(atual.interacoes, anterior.interacoes)}
          nota="cliques e mensagens"
        />
        <Indicador
          label="Leram e interagiram"
          valor={taxa(atual) === null ? "—" : `${Math.round(taxa(atual)!)}%`}
          delta={
            semComparacao || taxa(atual) === null || taxa(anterior) === null
              ? null
              : { texto: `${Math.abs(Math.round(taxa(atual)! - taxa(anterior)!))} p.p.`, sentido: Math.sign(Math.round(taxa(atual)! - taxa(anterior)!)) }
          }
          nota={`${inteiro.format(atual.interagiram)} de ${inteiro.format(atual.dispositivos)} dispositivos`}
        />
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        {semComparacao
          ? "Sem dados no período anterior para comparar."
          : `Variação face aos ${nomePeriodo} anteriores.`}
      </p>

      {/* Evolução */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-medium">Evolução: {metricaAtual.label.toLowerCase()}</h2>
              <p className="text-sm text-muted-foreground">{metricaAtual.descricao}, nos últimos {nomePeriodo}.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="max-w-full overflow-x-auto [&_button]:whitespace-nowrap">
                <Segmented
                  value={metrica}
                  onChange={setMetrica}
                  options={METRICAS.map((m) => ({ value: m.valor, label: m.label }))}
                />
              </div>
              <button
                type="button"
                onClick={() => setVerTabela((v) => !v)}
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {verTabela ? "Ver gráfico" : "Ver tabela"}
              </button>
            </div>
          </div>
          {verTabela ? (
            <TabelaSerie dados={dados} unidade={unidade} />
          ) : (
            <Grafico
              pontos={dados.serie.map((s) => ({ chave: s.chave, valor: s[metrica] }))}
              unidade={unidade}
              nomeMetrica={metricaAtual.label}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Por QR */}
        {!qrId ? (
          <Card>
            <CardContent className="space-y-3">
              <h2 className="font-medium">Por QR code</h2>
              {dados.porQr.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem leituras neste período.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-normal">QR</th>
                      <th className="pb-2 text-right font-normal">Leituras</th>
                      <th className="pb-2 text-right font-normal">Dispositivos</th>
                      <th className="pb-2 text-right font-normal">Interações</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {dados.porQr.map((q) => (
                      <tr key={q.id} className="border-t">
                        <td className="py-1.5 pr-2">
                          <button
                            type="button"
                            onClick={() => filtrar({ qr: q.id })}
                            className="text-left hover:underline"
                            disabled={!qrs.some((x) => x.id === q.id)}
                          >
                            {q.nome}
                          </button>
                        </td>
                        <td className="py-1.5 text-right">{inteiro.format(q.leituras)}</td>
                        <td className="py-1.5 text-right">{inteiro.format(q.dispositivos)}</td>
                        <td className="py-1.5 text-right">{inteiro.format(q.interacoes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Elementos mais usados */}
        <Card>
          <CardContent className="space-y-3">
            <h2 className="font-medium">Elementos mais usados</h2>
            {dados.elementos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ainda sem cliques nem mensagens neste período. Os cliques nos botões começaram a ser contados a 24/10/2026.
              </p>
            ) : (
              <Barras
                linhas={dados.elementos.map((e) => {
                  const tipo = BLOCK_TYPE_LABELS[e.tipo as BlockType] ?? e.tipo;
                  const rotulo = e.titulo || tipo;
                  // O tipo só aparece quando diz algo que o título não diz.
                  const detalhe = [rotulo === tipo ? null : tipo, qrId ? null : e.qr].filter(Boolean).join(" · ");
                  return { rotulo, detalhe, valor: e.total };
                })}
              />
            )}
          </CardContent>
        </Card>

        {/* Telemóvel ou computador */}
        <Card>
          <CardContent className="space-y-3">
            <h2 className="font-medium">Como leram</h2>
            {dados.aparelhos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem leituras neste período.</p>
            ) : (
              <Barras
                linhas={dados.aparelhos.map((a) => ({
                  rotulo: a.tipo,
                  detalhe: `${Math.round((a.total / Math.max(1, atual.leituras)) * 100)}% das leituras`,
                  valor: a.total,
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Os dispositivos são contados pela rede e pelo navegador, sem cookies: o mesmo telemóvel em redes diferentes
        pode contar mais do que uma vez. Horas de Lisboa.
      </p>
    </div>
  );
}

function variacao(agora: number, antes: number): { texto: string; sentido: number } {
  if (antes === 0) return { texto: agora > 0 ? "novo" : "0%", sentido: agora > 0 ? 1 : 0 };
  const pct = Math.round(((agora - antes) / antes) * 100);
  return { texto: `${Math.abs(pct)}%`, sentido: Math.sign(pct) };
}

function Indicador({
  label,
  valor,
  delta,
  nota,
}: {
  label: string;
  valor: string;
  delta: { texto: string; sentido: number } | null;
  nota: string;
}) {
  const Icone = delta?.sentido === 1 ? ArrowUp : delta?.sentido === -1 ? ArrowDown : Minus;
  return (
    <Card>
      <CardContent>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-semibold">{valor}</span>
          {delta ? (
            <span
              className={`inline-flex items-center gap-0.5 text-sm font-medium ${
                delta.sentido === 1 ? "text-emerald-700" : delta.sentido === -1 ? "text-red-700" : "text-muted-foreground"
              }`}
            >
              <Icone className="size-3.5" aria-hidden />
              <span className="sr-only">{delta.sentido === 1 ? "subiu" : delta.sentido === -1 ? "desceu" : "igual"}</span>
              {delta.texto}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{nota}</div>
      </CardContent>
    </Card>
  );
}

// Colunas de uma só série: sem legenda (o título diz o que é), cor única,
// barras finas com o topo arredondado, linhas de grelha discretas, dica ao
// passar o rato ou ao focar com o teclado.
function Grafico({
  pontos,
  unidade,
  nomeMetrica,
}: {
  pontos: { chave: string; valor: number }[];
  unidade: string;
  nomeMetrica: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(640);
  const [ativo, setAtivo] = useState<number | null>(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const altura = 220;
  const margem = { topo: 12, dir: 8, base: 26, esq: 36 };
  const w = largura - margem.esq - margem.dir;
  const h = altura - margem.topo - margem.base;
  const marcas = escala(Math.max(0, ...pontos.map((p) => p.valor)));
  const topo = marcas[marcas.length - 1] || 1;
  const banda = w / Math.max(1, pontos.length);
  const barra = Math.min(24, Math.max(3, banda - 2));
  const y = (v: number) => margem.topo + h - (v / topo) * h;
  // Rótulos do eixo X espaçados para não se atropelarem (~44 px cada).
  const cada = Math.max(1, Math.ceil(44 / banda));
  const r = Math.min(4, barra / 2);
  const ponto = ativo !== null ? pontos[ativo] : null;

  return (
    <div ref={caixa} className="viz relative w-full">
      <svg width={largura} height={altura} role="img" aria-label={`${nomeMetrica} por período`}>
        {marcas.map((m) => (
          <g key={m}>
            <line x1={margem.esq} x2={largura - margem.dir} y1={y(m)} y2={y(m)} stroke="var(--viz-grelha)" strokeWidth={1} />
            <text x={margem.esq - 6} y={y(m)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--viz-texto)" className="tabular-nums">
              {compacto.format(m)}
            </text>
          </g>
        ))}
        {pontos.map((p, i) => {
          const x = margem.esq + i * banda + (banda - barra) / 2;
          const alto = Math.max(0, y(0) - y(p.valor));
          const raio = Math.min(r, alto);
          return (
            <g
              key={p.chave}
              tabIndex={0}
              role="img"
              aria-label={`${rotuloLongo(p.chave, unidade)}: ${p.valor}`}
              onPointerEnter={() => setAtivo(i)}
              onPointerLeave={() => setAtivo(null)}
              onFocus={() => setAtivo(i)}
              onBlur={() => setAtivo(null)}
              className="outline-none"
            >
              {/* A área de toque é a banda inteira, não só a barra. */}
              <rect x={margem.esq + i * banda} y={margem.topo} width={banda} height={h} fill="transparent" />
              {alto > 0 ? (
                <path
                  d={`M${x},${y(0)} V${y(p.valor) + raio} Q${x},${y(p.valor)} ${x + raio},${y(p.valor)} H${x + barra - raio} Q${x + barra},${y(p.valor)} ${x + barra},${y(p.valor) + raio} V${y(0)} Z`}
                  fill="var(--viz-serie)"
                  opacity={ativo === null || ativo === i ? 1 : 0.55}
                />
              ) : null}
              {i % cada === 0 ? (
                <text x={margem.esq + i * banda + banda / 2} y={altura - 8} textAnchor="middle" fontSize={11} fill="var(--viz-texto)">
                  {rotulo(p.chave, unidade)}
                </text>
              ) : null}
            </g>
          );
        })}
        <line x1={margem.esq} x2={largura - margem.dir} y1={y(0)} y2={y(0)} stroke="var(--viz-eixo)" strokeWidth={1} />
      </svg>
      {ponto ? (
        <div
          className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{
            left: Math.min(largura - 70, Math.max(70, margem.esq + ativo! * banda + banda / 2)),
            top: Math.max(0, y(ponto.valor) - 52),
          }}
        >
          <div className="text-base font-semibold tabular-nums text-foreground">{inteiro.format(ponto.valor)}</div>
          <div className="text-muted-foreground">{rotuloLongo(ponto.chave, unidade)}</div>
        </div>
      ) : null}
    </div>
  );
}

function TabelaSerie({ dados, unidade }: { dados: Estatisticas; unidade: string }) {
  return (
    <div className="max-h-80 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card">
          <tr className="text-left text-xs text-muted-foreground">
            <th className="pb-2 font-normal">Quando</th>
            <th className="pb-2 text-right font-normal">Leituras</th>
            <th className="pb-2 text-right font-normal">Dispositivos</th>
            <th className="pb-2 text-right font-normal">Interações</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {[...dados.serie].reverse().map((s) => (
            <tr key={s.chave} className="border-t">
              <td className="py-1.5">{rotuloLongo(s.chave, unidade)}</td>
              <td className="py-1.5 text-right">{inteiro.format(s.leituras)}</td>
              <td className="py-1.5 text-right">{inteiro.format(s.dispositivos)}</td>
              <td className="py-1.5 text-right">{inteiro.format(s.interacoes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Barras horizontais de uma só série, com o valor na ponta.
function Barras({ linhas }: { linhas: { rotulo: string; detalhe: string; valor: number }[] }) {
  const max = Math.max(1, ...linhas.map((l) => l.valor));
  return (
    <ul className="viz space-y-2.5">
      {linhas.map((l, i) => (
        <li key={`${l.rotulo}-${i}`} title={`${l.rotulo}: ${l.valor}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              {l.rotulo} <span className="text-xs text-muted-foreground">{l.detalhe}</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums">{inteiro.format(l.valor)}</span>
          </div>
          <div className="mt-1 h-2 w-full rounded-sm" style={{ backgroundColor: "var(--viz-trilho)" }}>
            <div
              className="h-2 rounded-r-[4px]"
              style={{ width: `${(l.valor / max) * 100}%`, backgroundColor: "var(--viz-serie)" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
