"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  FileText,
  Link2,
  Loader2,
  Mail,
  Minus,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { NOMES_ESTADO_PAGAMENTO, euros } from "@/lib/pagamentos";
import { LinkPagamento } from "@/components/pagamentos/pagamentos-admin";
import { emitirFaturaAgora, enviarDocumentoPorEmail, reenviarQrComprado } from "@/app/dashboard/pagamentos/actions";

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
  criado: string;
  tipo: string;
  estado: string;
  descricao: string;
  pacote: string;
  empresa: string;
  cliente: string;
  nif: string;
  morada: string;
  email: string;
  valorCentimos: number;
  moeda: string;
  numero: string | null;
  fatura: boolean;
  proforma: string | null;
  erroFatura: string | null;
  emailEnviado: string | null;
  faturaEnviada: string | null;
  qrPagina: string | null;
  qrEntregue: string | null;
  entregaQr: boolean;
};
type Filtros = { de: string; ate: string; tipo: string; estado: string; q: string; pagina: number };
type PacoteLinkProps = Parameters<typeof LinkPagamento>[0]["pacotes"];

const TIPOS: Record<string, string> = {
  pacote: "Pacote",
  renovacao: "Renovação",
  link: "Link de pagamento",
  botao: "Botão na página",
  qr: "Loja (QR)",
};
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// ---------------------------------------------------------------- datas

// O dia de hoje em Lisboa, como AAAA-MM-DD, e contas simples a partir dele.
function hojeLisboa(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
}
function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

type Periodo = { chave: string; nome: string; de: string; ate: string };

function periodos(): Periodo[] {
  const hoje = hojeLisboa();
  const [a, m] = hoje.split("-").map(Number) as [number, number];
  const inicioMes = `${a}-${String(m).padStart(2, "0")}-01`;
  const fimMesPassado = somarDias(inicioMes, -1);
  const inicioMesPassado = `${fimMesPassado.slice(0, 7)}-01`;
  return [
    { chave: "hoje", nome: "Hoje", de: hoje, ate: hoje },
    { chave: "ontem", nome: "Ontem", de: somarDias(hoje, -1), ate: somarDias(hoje, -1) },
    { chave: "7d", nome: "7 dias", de: somarDias(hoje, -6), ate: hoje },
    { chave: "mes", nome: "Este mês", de: inicioMes, ate: hoje },
    { chave: "mesPassado", nome: "Mês passado", de: inicioMesPassado, ate: fimMesPassado },
    { chave: "ano", nome: "Este ano", de: `${a}-01-01`, ate: hoje },
    { chave: "tudo", nome: "Tudo", de: "", ate: "" },
  ];
}

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

function diaCurto(dia: string) {
  return new Date(`${dia}T12:00:00Z`).toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" });
}

const eurosCurto = (c: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: c % 100 === 0 ? 0 : 2 }).format(c / 100);

function variacao(agora: number, antes: number) {
  if (antes === 0) return { texto: agora > 0 ? "novo" : "0%", sentido: agora > 0 ? 1 : 0 };
  const pct = Math.round(((agora - antes) / antes) * 100);
  return { texto: `${Math.abs(pct)}%`, sentido: Math.sign(pct) };
}

function copiar(texto: string, aviso = "Copiado.") {
  navigator.clipboard.writeText(texto).then(
    () => toast.success(aviso),
    () => toast.error("Não foi possível copiar."),
  );
}

// ---------------------------------------------------------------- peças

function Indicador({
  label,
  valor,
  nota,
  delta,
  ativo,
  onClick,
}: {
  label: string;
  valor: string;
  nota: string;
  delta?: { texto: string; sentido: number };
  ativo?: boolean;
  onClick?: () => void;
}) {
  const Icone = delta?.sentido === 1 ? ArrowUp : delta?.sentido === -1 ? ArrowDown : Minus;
  const corpo = (
    <>
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
    </>
  );
  return (
    <Card className={ativo ? "ring-2 ring-indigo-600" : undefined}>
      <CardContent>
        {onClick ? (
          <button type="button" onClick={onClick} className="w-full text-left" title="Ver estes pagamentos">
            {corpo}
          </button>
        ) : (
          corpo
        )}
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

function Grafico({ pontos, unidade, onEscolher }: { pontos: Ponto[]; unidade: "dia" | "mes"; onEscolher: (p: Ponto) => void }) {
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

  const altura = 240;
  const m = { topo: 12, dir: 8, base: 26, esq: 56 };
  const w = largura - m.esq - m.dir;
  const h = altura - m.topo - m.base;
  const max = Math.max(0, ...pontos.map((p) => p.valor));
  const passo = max <= 0 ? 100 : Math.pow(10, Math.floor(Math.log10(max / 4)));
  const topo = max <= 0 ? 400 : Math.ceil(max / 4 / passo) * passo * 4;
  const marcas = [0, topo / 4, topo / 2, (topo * 3) / 4, topo];
  const banda = w / Math.max(1, pontos.length);
  const barra = Math.min(28, Math.max(3, banda - 3));
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
              role="button"
              aria-label={`${rotuloLongo(p.chave, unidade)}: ${euros(p.valor)}`}
              onPointerEnter={() => setAtivo(i)}
              onPointerLeave={() => setAtivo(null)}
              onFocus={() => setAtivo(i)}
              onBlur={() => setAtivo(null)}
              onClick={() => onEscolher(p)}
              onKeyDown={(e) => e.key === "Enter" && onEscolher(p)}
              className="cursor-pointer outline-none"
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
          style={{ left: Math.min(largura - 80, Math.max(80, m.esq + ativo! * banda + banda / 2)), top: Math.max(0, y(ponto.valor) - 58) }}
        >
          <div className="text-base font-semibold tabular-nums">{euros(ponto.valor)}</div>
          <div className="text-muted-foreground">{rotuloLongo(ponto.chave, unidade)}</div>
          <div className="text-muted-foreground">Clique para ver os pagamentos</div>
        </div>
      ) : null}
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  return (
    <Badge variant={estado === "pago" ? "default" : estado === "pendente" ? "secondary" : "destructive"}>
      {NOMES_ESTADO_PAGAMENTO[estado] ?? estado}
    </Badge>
  );
}

// ---------------------------------------------------------------- ficha

function Ficha({ p, moloni, onClose }: { p: Linha; moloni: boolean; onClose: () => void }) {
  const router = useRouter();
  const [para, setPara] = useState(p.email);
  const [aEnviar, setAEnviar] = useState(false);
  const [aEmitir, iniciarEmitir] = useTransition();
  const [aReenviarQr, iniciarReenviarQr] = useTransition();
  const pago = p.estado === "pago";
  const documento = p.fatura ? "fatura" : "comprovativo";

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setAEnviar(true);
    const r = await enviarDocumentoPorEmail(p.id, para);
    setAEnviar(false);
    if (!r.ok) toast.error(r.message);
    else toast.success(`${r.documento} Para ${para}.`);
  }

  const linha = (rotulo: string, valor: React.ReactNode) =>
    valor ? (
      <div className="flex justify-between gap-4 border-t py-2 text-sm first:border-t-0">
        <span className="text-muted-foreground">{rotulo}</span>
        <span className="text-right font-medium">{valor}</span>
      </div>
    ) : null;

  return (
    <Dialog open onOpenChange={(abrir) => !abrir && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {euros(p.valorCentimos, p.moeda)} <EstadoBadge estado={p.estado} />
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{p.descricao}</p>
        </DialogHeader>

        <div>
          {linha("Data", dataHora(p.data))}
          {linha("Tipo", TIPOS[p.tipo] ?? p.tipo)}
          {linha("Empresa", p.empresa)}
          {linha("Cliente", p.cliente)}
          {linha("NIF", p.nif)}
          {linha("Morada", p.morada)}
          {linha("Email", p.email)}
          {linha(p.fatura ? "Fatura-recibo" : "Comprovativo", p.numero)}
          {linha("Pró-forma", p.proforma)}
          {linha("Confirmação enviada", p.emailEnviado ? dataHora(p.emailEnviado) : null)}
          {linha("Fatura enviada", p.faturaEnviada ? dataHora(p.faturaEnviada) : null)}
          {linha(
            "QR comprado",
            p.qrPagina ? (
              <a href={p.qrPagina} target="_blank" rel="noreferrer" className="text-indigo-600 underline-offset-4 hover:underline">
                Abrir página
              </a>
            ) : null,
          )}
          {linha("QR enviado", p.qrEntregue ? dataHora(p.qrEntregue) : p.entregaQr && pago ? "Ainda não" : null)}
          {linha("Referência", p.id.slice(-10).toUpperCase())}
        </div>

        {p.erroFatura ? (
          <div className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>A fatura ainda não foi emitida: {p.erroFatura}</span>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {pago ? (
            <Button
              className="bg-indigo-600 text-white hover:bg-indigo-700"
              nativeButton={false}
              render={<a href={`/pagar/${p.id}/${documento}`} target="_blank" rel="noreferrer" />}
            >
              <Download /> {p.fatura ? "Fatura-recibo" : "Comprovativo"}
            </Button>
          ) : null}
          {p.proforma ? (
            <Button variant="outline" nativeButton={false} render={<a href={`/pagar/${p.id}/orcamento`} target="_blank" rel="noreferrer" />}>
              <FileText /> Pró-forma
            </Button>
          ) : null}
          {pago && moloni && !p.fatura ? (
            <Button
              variant="outline"
              disabled={aEmitir}
              onClick={() =>
                iniciarEmitir(async () => {
                  const r = await emitirFaturaAgora(p.id);
                  if (!r.ok) toast.error(r.message);
                  else {
                    toast.success("Fatura emitida e enviada.");
                    router.refresh();
                    onClose();
                  }
                })
              }
            >
              {aEmitir ? <Loader2 className="animate-spin" /> : <RefreshCw />} Emitir fatura agora
            </Button>
          ) : null}
          {pago && p.entregaQr ? (
            <Button
              variant="outline"
              disabled={aReenviarQr}
              onClick={() =>
                iniciarReenviarQr(async () => {
                  if (!confirm(`Enviar o QR para ${para}? Vai com um código de edição novo e o anterior deixa de funcionar.`)) return;
                  const r = await reenviarQrComprado(p.id, para);
                  if (!r.ok) toast.error(r.message);
                  else {
                    toast.success(`QR enviado para ${para}.`);
                    router.refresh();
                  }
                })
              }
            >
              {aReenviarQr ? <Loader2 className="animate-spin" /> : <QrCode />} Reenviar QR
            </Button>
          ) : null}
          {!pago && p.estado !== "expirado" && p.tipo !== "botao" ? (
            <Button variant="outline" onClick={() => copiar(`${window.location.origin}/pagar/${p.id}`, "Link copiado.")}>
              <Copy /> Copiar link de pagamento
            </Button>
          ) : null}
        </div>

        {pago ? (
          <form onSubmit={enviar} className="space-y-1.5 rounded-lg border p-3">
            <Label htmlFor="enviar-para">Enviar {p.fatura ? "a fatura-recibo" : "o comprovativo"} por email</Label>
            <div className="flex gap-2">
              <Input id="enviar-para" type="email" required value={para} onChange={(e) => setPara(e.target.value)} placeholder="cliente@empresa.pt" />
              <Button type="submit" variant="outline" disabled={aEnviar}>
                {aEnviar ? <Loader2 className="animate-spin" /> : <Mail />} Enviar
              </Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- ecrã

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
  porTipo: { tipo: string; valor: number; n: number }[];
  porEmitir: number;
  moloni: { serie: string } | null;
  podeCobrar: boolean;
  empresas: { id: string; nome: string }[];
  pacotes: PacoteLinkProps;
  linhas: Linha[];
}) {
  const router = useRouter();
  const caminho = usePathname();
  const [vista, setVista] = useState<"dia" | "mes">("dia");
  const [f, setF] = useState(props.filtros);
  const [ficha, setFicha] = useState<Linha | null>(null);
  const [novoLink, setNovoLink] = useState(false);
  const t = props.totais;
  const lista = periodos();
  const periodoAtivo = lista.find((p) => p.de === f.de && p.ate === f.ate)?.chave ?? (f.de || f.ate ? "outro" : "tudo");

  useEffect(() => setF(props.filtros), [props.filtros]);

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
    setF((x) => ({ ...x, ...novos }));
    router.push(`${caminho}?${query(novos)}`, { scroll: false });
  }
  function irPara(chave: string) {
    const p = lista.find((x) => x.chave === chave);
    if (p) aplicar({ de: p.de, ate: p.ate, estado: "pago", pagina: 1 });
    document.getElementById("pagamentos")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function escolherBarra(p: Ponto) {
    if (vista === "dia") aplicar({ de: p.chave, ate: p.chave, estado: "pago", pagina: 1 });
    else {
      const fim = somarDias(`${p.chave.slice(0, 4)}-${String(Number(p.chave.slice(5, 7)) % 12 + 1).padStart(2, "0")}-01`, -1);
      const ate = p.chave.slice(5, 7) === "12" ? `${p.chave.slice(0, 4)}-12-31` : fim;
      aplicar({ de: `${p.chave}-01`, ate, estado: "pago", pagina: 1 });
    }
    document.getElementById("pagamentos")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const paginas = Math.max(1, Math.ceil(props.contagem / props.porPagina));
  const textoPeriodo =
    periodoAtivo === "tudo"
      ? "Desde o início"
      : f.de === f.ate
        ? diaCurto(f.de)
        : `${f.de ? diaCurto(f.de) : "início"} a ${f.ate ? diaCurto(f.ate) : "hoje"}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {props.moloni ? (
            <Badge variant="secondary" className="gap-1">
              <Receipt className="size-3" /> Faturas Moloni, série {props.moloni.serie}
            </Badge>
          ) : (
            <Badge variant="outline">Faturas Moloni desligadas: segue o comprovativo Snaptie</Badge>
          )}
          {props.porEmitir > 0 ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="size-3" /> {props.porEmitir} fatura{props.porEmitir === 1 ? "" : "s"} por emitir
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" nativeButton={false} render={<a href={`/api/faturacao/export?${query({ pagina: 1 })}`} />}>
            <Download /> Exportar Excel
          </Button>
          <Button className="bg-indigo-600 text-white hover:bg-indigo-700" disabled={!props.podeCobrar} onClick={() => setNovoLink(true)}>
            <Link2 /> Novo link de pagamento
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador label="Hoje" valor={euros(t.hoje)} nota={`Ontem: ${euros(t.ontem)}`} delta={variacao(t.hoje, t.ontem)} ativo={periodoAtivo === "hoje"} onClick={() => irPara("hoje")} />
        <Indicador
          label="Ontem"
          valor={euros(t.ontem)}
          nota="Clique para ver os pagamentos"
          ativo={periodoAtivo === "ontem"}
          onClick={() => irPara("ontem")}
        />
        <Indicador
          label="Este mês"
          valor={euros(t.mes)}
          nota={`Mês passado: ${euros(t.mesPassado)} · ${t.pagamentosMes} pagamento${t.pagamentosMes === 1 ? "" : "s"}`}
          delta={variacao(t.mes, t.mesPassado)}
          ativo={periodoAtivo === "mes"}
          onClick={() => irPara("mes")}
        />
        <Indicador label="Este ano" valor={euros(t.ano)} nota={`Ano passado: ${euros(t.anoPassado)}`} delta={variacao(t.ano, t.anoPassado)} ativo={periodoAtivo === "ano"} onClick={() => irPara("ano")} />
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
                    ? ` · transferência de ${euros(props.saldo.proximaTransferencia.valor)} a ${new Date(props.saldo.proximaTransferencia.data).toLocaleDateString("pt-PT")}`
                    : ""}
                </div>
                <div className="mt-1 text-xs text-amber-700">Inclui os outros projetos da Inpulse que usam a mesma conta.</div>
              </>
            ) : (
              <div className="mt-1 text-sm text-muted-foreground">Indisponível de momento.</div>
            )}
          </CardContent>
        </Card>
        <Indicador label="Total desde o início" valor={euros(t.total)} nota="Tudo o que entrou pelo Snaptie" ativo={periodoAtivo === "tudo"} onClick={() => irPara("tudo")} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Histórico de faturação</CardTitle>
            <CardDescription>{vista === "dia" ? "Últimos 30 dias" : "Últimos 12 meses"} · clique numa barra para ver esses pagamentos</CardDescription>
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
          <Grafico pontos={vista === "dia" ? props.series.dias : props.series.meses} unidade={vista} onEscolher={escolherBarra} />
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
                    {e.link ? (
                      <Button size="sm" variant="ghost" onClick={() => copiar(`${window.location.origin}${e.link}`, "Link copiado.")}>
                        <Copy /> Link
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card id="pagamentos" className="scroll-mt-6">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Pagamentos</CardTitle>
              <CardDescription>
                {textoPeriodo} · {props.contagem} pagamento{props.contagem === 1 ? "" : "s"} ·{" "}
                <strong className="text-foreground">{euros(props.soma)}</strong>
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" nativeButton={false} render={<a href={`/api/faturacao/export?${query({ pagina: 1 })}`} />}>
              <Download /> Excel deste período
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {lista.map((p) => (
              <Button
                key={p.chave}
                size="sm"
                variant={periodoAtivo === p.chave ? "default" : "outline"}
                onClick={() => aplicar({ de: p.de, ate: p.ate, pagina: 1 })}
              >
                {p.nome}
              </Button>
            ))}
          </div>
          {props.porTipo.length > 1 ? (
            <div className="flex flex-wrap gap-2 text-xs">
              {props.porTipo.map((x) => (
                <button
                  key={x.tipo}
                  type="button"
                  onClick={() => aplicar({ tipo: f.tipo === x.tipo ? "" : x.tipo, pagina: 1 })}
                  className={`rounded-full border px-2.5 py-1 ${f.tipo === x.tipo ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "text-muted-foreground hover:bg-muted"}`}
                >
                  {TIPOS[x.tipo] ?? x.tipo}: <strong className="tabular-nums">{euros(x.valor)}</strong> ({x.n})
                </button>
              ))}
            </div>
          ) : null}
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
                placeholder="Empresa, cliente, NIF, email ou n.º de fatura"
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
            <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              Nenhum pagamento neste período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Data</th>
                    <th className="py-2 pr-3 font-medium">Quem pagou</th>
                    <th className="py-2 pr-3 font-medium">Descrição</th>
                    <th className="py-2 pr-3 font-medium">Documento</th>
                    <th className="py-2 pr-3 text-right font-medium">Valor</th>
                    <th className="py-2 pr-3 font-medium">Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {props.linhas.map((p) => (
                    <tr key={p.id} className="cursor-pointer border-t hover:bg-muted/40" onClick={() => setFicha(p)}>
                      <td className="py-2.5 pr-3 whitespace-nowrap tabular-nums">{dataHora(p.data)}</td>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{p.empresa || p.cliente || p.email || "Sem nome"}</div>
                        <div className="text-xs text-muted-foreground">
                          {[p.nif ? `NIF ${p.nif}` : "", p.email && (p.empresa || p.cliente) ? p.email : ""].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        {p.descricao}
                        <div className="text-xs text-muted-foreground">{TIPOS[p.tipo] ?? p.tipo}</div>
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        {p.estado === "pago" ? (
                          <span className={p.fatura ? "font-medium" : "text-muted-foreground"}>
                            {p.numero ?? ""}
                            {p.erroFatura ? <AlertTriangle className="ml-1 inline size-3.5 text-amber-600" aria-label="Fatura por emitir" /> : null}
                          </span>
                        ) : p.proforma ? (
                          <span className="text-muted-foreground">Pró-forma {p.proforma}</span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-medium whitespace-nowrap tabular-nums">{euros(p.valorCentimos, p.moeda)}</td>
                      <td className="py-2.5 pr-3">
                        <EstadoBadge estado={p.estado} />
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {p.estado === "pago" ? (
                          <>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={p.fatura ? "Descarregar fatura-recibo" : "Descarregar comprovativo"}
                              title={p.fatura ? "Descarregar fatura-recibo" : "Descarregar comprovativo"}
                              nativeButton={false}
                              render={<a href={`/pagar/${p.id}/${p.fatura ? "fatura" : "comprovativo"}`} target="_blank" rel="noreferrer" />}
                            >
                              <Download />
                            </Button>
                            <Button size="icon-sm" variant="ghost" aria-label="Enviar por email" title="Enviar por email" onClick={() => setFicha(p)}>
                              <Mail />
                            </Button>
                          </>
                        ) : p.estado !== "expirado" && p.tipo !== "botao" ? (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Copiar link de pagamento"
                            title="Copiar link de pagamento"
                            onClick={() => copiar(`${window.location.origin}/pagar/${p.id}`, "Link copiado.")}
                          >
                            <Copy />
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

      {ficha ? <Ficha p={ficha} moloni={Boolean(props.moloni)} onClose={() => setFicha(null)} /> : null}

      {novoLink ? (
        <Dialog open onOpenChange={(abrir) => !abrir && setNovoLink(false)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Novo link de pagamento</DialogTitle>
            </DialogHeader>
            <LinkPagamento ativo={props.podeCobrar} empresas={props.empresas} pacotes={props.pacotes} onCriado={() => router.refresh()} />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
