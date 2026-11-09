"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bell, CreditCard, FileSpreadsheet, Loader2, Send, Star } from "lucide-react";
import { ESTADOS_MANUTENCAO, estadoManutencao } from "@/lib/qr";
import type { OcorrenciaPublica } from "./qr-page";
import { EstadoChips, type MudarEstado } from "./message-wall";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postOpiniao } from "@/app/[empresa]/[codigo]/wall-actions";
import { agoraEmLisboa, lerLembrete, proximoDia } from "@/lib/lembrete";
import { PAGAMENTO_MAX_CENTIMOS, PAGAMENTO_MIN_CENTIMOS, lerPagamento } from "@/lib/pagamentos";

// Os três elementos que avisam ou levam o visitante para fora: avaliar no
// Google, deixar uma opinião privada e o lembrete do dono.

export function GoogleReview({
  titulo,
  url,
  color,
}: {
  titulo: string;
  url: string;
  color: string;
}) {
  const t = useTranslations("Elementos");
  return (
    <div className="rounded-xl border bg-white p-4 text-center">
      <div className="font-medium text-zinc-900">{titulo || t("googleTitle")}</div>
      <div className="mt-2 flex justify-center gap-1 text-amber-400">
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className="size-6 fill-current" />
        ))}
      </div>
      {url ? (
        <Button
          className="mt-3 w-full text-white"
          style={{ backgroundColor: color }}
          nativeButton={false}
          render={<a href={url} target="_blank" rel="noreferrer" />}
        >
          {t("googleButton")}
        </Button>
      ) : null}
    </div>
  );
}

export function OpiniaoForm({
  blockId,
  titulo,
  codigo,
  color,
}: {
  blockId: string;
  titulo: string;
  codigo?: string;
  color: string;
}) {
  const t = useTranslations("Elementos");
  const tw = useTranslations("Wall");
  const [estrelas, setEstrelas] = useState(0);
  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviar() {
    if (!codigo || (!mensagem.trim() && !estrelas)) return;
    setAEnviar(true);
    try {
      const r = await postOpiniao({ codigo, blockId, nome, mensagem, estrelas: estrelas || null });
      if (!r.ok) {
        toast.error(r.motivo === "muitas" ? tw("tooMany") : tw("failed"));
        return;
      }
      setEnviado(true);
    } catch {
      toast.error(tw("failed"));
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-4 text-left">
      <div className="font-medium text-zinc-900">{titulo || t("opiniaoTitle")}</div>
      <p className="mt-0.5 text-xs text-zinc-500">{t("opiniaoHint")}</p>

      {enviado ? (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{t("opiniaoSent")}</p>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex justify-center gap-1" role="radiogroup" aria-label={t("opiniaoRating")}>
            {Array.from({ length: 5 }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${i + 1}`}
                onClick={() => setEstrelas(estrelas === i + 1 ? 0 : i + 1)}
                className="p-0.5"
              >
                <Star
                  className={`size-7 ${i < estrelas ? "fill-amber-400 text-amber-400" : "text-zinc-300"}`}
                />
              </button>
            ))}
          </div>
          <Input
            placeholder={t("opiniaoName")}
            maxLength={40}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            disabled={!codigo}
          />
          <textarea
            rows={3}
            maxLength={1000}
            placeholder={t("opiniaoMessage")}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            disabled={!codigo}
            className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button
            className="w-full text-white"
            style={{ backgroundColor: color }}
            onClick={enviar}
            disabled={!codigo || aEnviar || (!mensagem.trim() && !estrelas)}
          >
            {aEnviar ? <Loader2 className="animate-spin" /> : <Send />}
            {t("opiniaoSend")}
          </Button>
        </div>
      )}
    </div>
  );
}

// As ocorrências de todas as lojas da empresa, filtráveis por estado, com o
// Excel ao fundo. Na pré-visualização do painel não há dados nem descarga.
export function OcorrenciasLista({
  blockId,
  titulo,
  codigo,
  ocorrencias,
  color,
  onMudarEstado,
}: {
  blockId: string;
  titulo: string;
  codigo?: string;
  ocorrencias?: OcorrenciaPublica[];
  color: string;
  // Presente quando quem vê desbloqueou a edição da página com o código.
  onMudarEstado?: MudarEstado;
}) {
  const t = useTranslations("Elementos");
  const tw = useTranslations("Wall");
  const locale = useLocale();
  const [filtro, setFiltro] = useState<string | null>(null);
  const [mostrar, setMostrar] = useState(30);
  // Estados mudados aqui: a cor e as contagens dos filtros acompanham logo.
  const [estados, setEstados] = useState<Record<string, string>>({});
  const lista = (ocorrencias ?? []).map((o) => (estados[o.id] ? { ...o, estado: estados[o.id] } : o));
  const mudar: MudarEstado | undefined = onMudarEstado
    ? async (id, estado) => {
        const antes = estados[id];
        setEstados((s) => ({ ...s, [id]: estado }));
        const ok = await onMudarEstado(id, estado);
        if (!ok) setEstados((s) => ({ ...s, [id]: antes }));
        return ok;
      }
    : undefined;
  const visiveis = filtro ? lista.filter((o) => o.estado === filtro) : lista;

  return (
    <div className="rounded-xl border bg-white p-4 text-left">
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-zinc-900">{titulo || t("ocorrenciasTitle")}</div>
        {codigo ? (
          <a
            href={`/api/ocorrencias/bloco/${blockId}?codigo=${encodeURIComponent(codigo)}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white"
            style={{ backgroundColor: color }}
          >
            <FileSpreadsheet className="size-4" />
            {t("ocorrenciasExcel")}
          </a>
        ) : null}
      </div>

      {!ocorrencias ? (
        <p className="mt-2 text-sm text-zinc-500">{t("ocorrenciasPreview")}</p>
      ) : lista.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">{t("ocorrenciasVazio")}</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[null, ...ESTADOS_MANUTENCAO.map((e) => e.valor)].map((v) => {
              const n = v ? lista.filter((o) => o.estado === v).length : lista.length;
              const e = v ? estadoManutencao(v) : null;
              const ativo = filtro === v;
              return (
                <button
                  key={v ?? "todas"}
                  type="button"
                  onClick={() => {
                    setFiltro(v);
                    setMostrar(30);
                  }}
                  className="rounded-full border px-2.5 py-1 text-xs font-medium"
                  style={
                    ativo
                      ? { backgroundColor: e?.cor ?? "#18181b", color: e?.texto ?? "#ffffff", borderColor: e?.texto ?? "#18181b" }
                      : { color: "#52525b" }
                  }
                >
                  {v ? tw(`status_${v}`) : t("ocorrenciasTodas")} ({n})
                </button>
              );
            })}
          </div>

          <ul className="mt-3 space-y-2">
            {visiveis.slice(0, mostrar).map((o) => {
              const e = estadoManutencao(o.estado);
              return (
                <li key={o.id} className="rounded-lg px-3 py-2" style={{ backgroundColor: e.cor }}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-zinc-900">{o.loja}</span>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ backgroundColor: "#ffffffcc", color: e.texto }}
                    >
                      {tw(`status_${e.valor}`)}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-600">
                    {o.nome} · {new Date(o.data).toLocaleDateString(locale)}
                  </div>
                  {o.mensagem ? (
                    <p className="mt-0.5 whitespace-pre-line break-words text-sm text-zinc-800">{o.mensagem}</p>
                  ) : null}
                  {mudar ? <EstadoChips messageId={o.id} atual={o.estado} onMudar={mudar} /> : null}
                </li>
              );
            })}
          </ul>
          {visiveis.length > mostrar ? (
            <button
              type="button"
              onClick={() => setMostrar((m) => m + 30)}
              className="mt-3 w-full rounded-lg border px-3 py-2 text-sm text-zinc-700"
            >
              {t("ocorrenciasMais", { n: visiveis.length - mostrar })}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

export function LembreteCard({
  titulo,
  conteudo,
  color,
}: {
  titulo: string;
  conteudo: Record<string, unknown>;
  color: string;
}) {
  const t = useTranslations("Elementos");
  const locale = useLocale();
  const l = lerLembrete(conteudo);
  // O dono decide se o lembrete se vê; por omissão é só para ele.
  if (!l.mostrar) return null;
  const agora = agoraEmLisboa();
  const dia = proximoDia(l, agora.dia, agora.hora);
  if (!dia) return null;
  const data = new Date(`${dia}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-white p-4 text-left">
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: color }}
      >
        <Bell className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="font-medium text-zinc-900">{titulo || t("lembreteTitle")}</div>
        <div className="text-sm text-zinc-600">{t("lembreteNext", { data })}</div>
        {l.mensagem ? <div className="mt-0.5 text-xs text-zinc-500">{l.mensagem}</div> : null}
      </div>
    </div>
  );
}

// O botão de pagamento: abre o checkout do Stripe com o valor do elemento, ou
// com o que o visitante escolheu. Ao voltar do Stripe, a página diz se correu bem.
export function PagamentoBotao({
  blockId,
  titulo,
  codigo,
  conteudo,
  color,
}: {
  blockId: string;
  titulo: string;
  codigo?: string;
  conteudo: Record<string, unknown>;
  color: string;
}) {
  const t = useTranslations("Elementos");
  const locale = useLocale();
  const conf = lerPagamento(conteudo);
  const [valor, setValor] = useState(
    conf.valorCentimos ? String(conf.valorCentimos / 100).replace(".", ",") : "",
  );
  const [aAbrir, setAAbrir] = useState(false);
  const fmt = (c: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(c / 100);

  useEffect(() => {
    const estado = new URLSearchParams(window.location.search).get("pagamento");
    if (!estado) return;
    if (estado === "ok") toast.success(t("payOk"));
    else if (estado === "cancelado") toast(t("payCancel"));
    const url = new URL(window.location.href);
    url.searchParams.delete("pagamento");
    window.history.replaceState(null, "", url.toString());
  }, [t]);

  async function pagar() {
    const centimos = conf.valorLivre
      ? Math.round(Number(valor.replace(",", ".")) * 100)
      : conf.valorCentimos;
    if (!Number.isFinite(centimos) || centimos < PAGAMENTO_MIN_CENTIMOS || centimos > PAGAMENTO_MAX_CENTIMOS) {
      toast.error(t("payInvalid", { min: fmt(PAGAMENTO_MIN_CENTIMOS), max: fmt(PAGAMENTO_MAX_CENTIMOS) }));
      return;
    }
    setAAbrir(true);
    try {
      const r = await fetch(`/api/pagamento/bloco/${blockId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, valor: centimos, locale }),
      });
      const dados = (await r.json().catch(() => ({}))) as { url?: string };
      if (!r.ok || !dados.url) throw new Error();
      window.location.href = dados.url;
    } catch {
      setAAbrir(false);
      toast.error(t("payError"));
    }
  }

  return (
    <div className="rounded-xl border bg-white p-4 text-center">
      <div className="font-medium text-zinc-900">{titulo || t("payTitle")}</div>
      {conf.valorLivre ? (
        <label className="mt-3 block text-left text-sm text-zinc-600">
          {t("payAmount")}
          <Input
            className="mt-1"
            inputMode="decimal"
            value={valor}
            placeholder="10,00"
            onChange={(e) => setValor(e.target.value)}
          />
        </label>
      ) : (
        <div className="mt-2 text-2xl font-semibold text-zinc-900">{fmt(conf.valorCentimos)}</div>
      )}
      <Button
        className="mt-3 w-full text-white"
        style={{ backgroundColor: color }}
        disabled={aAbrir || !codigo}
        onClick={pagar}
      >
        {aAbrir ? <Loader2 className="animate-spin" /> : <CreditCard />}
        {conf.textoBotao || t("payButton")}
      </Button>
      <div className="mt-2 text-xs text-zinc-500">{t("paySecure")}</div>
    </div>
  );
}
