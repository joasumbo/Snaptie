"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bell, FileSpreadsheet, Loader2, Send, Star } from "lucide-react";
import { ESTADOS_MANUTENCAO, estadoManutencao } from "@/lib/qr";
import type { OcorrenciaPublica } from "./qr-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postOpiniao } from "@/app/[empresa]/[codigo]/wall-actions";
import { agoraEmLisboa, lerLembrete, proximoDia } from "@/lib/lembrete";

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
}: {
  blockId: string;
  titulo: string;
  codigo?: string;
  ocorrencias?: OcorrenciaPublica[];
  color: string;
}) {
  const t = useTranslations("Elementos");
  const tw = useTranslations("Wall");
  const locale = useLocale();
  const [filtro, setFiltro] = useState<string | null>(null);
  const [mostrar, setMostrar] = useState(30);
  const lista = ocorrencias ?? [];
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
