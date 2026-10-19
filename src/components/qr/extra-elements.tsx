"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bell, Loader2, Send, Star } from "lucide-react";
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
