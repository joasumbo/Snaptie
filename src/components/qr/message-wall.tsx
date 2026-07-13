"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postWallMessage } from "@/app/[empresa]/[codigo]/wall-actions";

export type WallMessage = {
  id: string;
  nome: string;
  mensagem: string;
  createdAt: string; // ISO — formatted in the visitor's locale
};

// A wall of messages left by visitors. Read-only when there is no codigo, which
// is how it appears in the dashboard preview.
export function MessageWall({
  blockId,
  titulo,
  descricao,
  mensagens,
  codigo,
  color,
}: {
  blockId: string;
  titulo: string;
  descricao: string | null;
  mensagens: WallMessage[];
  codigo?: string;
  color: string;
}) {
  const router = useRouter();
  const t = useTranslations("Wall");
  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!codigo || !nome.trim() || !mensagem.trim()) return;
    setSending(true);
    try {
      const r = await postWallMessage({ codigo, blockId, nome, mensagem });
      if (!r.ok) {
        toast.error(
          r.motivo === "muitas"
            ? t("tooMany")
            : r.motivo === "vazio"
              ? t("empty")
              : t("failed"),
        );
        return;
      }
      setMensagem("");
      toast.success(t("posted"));
      router.refresh();
    } catch {
      toast.error(t("failed"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-4 text-left">
      <div className="font-medium text-zinc-900">{titulo || t("title")}</div>
      {descricao ? (
        <p className="mt-0.5 text-xs text-zinc-500">{descricao}</p>
      ) : null}

      {codigo ? (
        <div className="mt-3 space-y-2">
          <Input
            placeholder={t("yourName")}
            maxLength={40}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <textarea
            rows={2}
            maxLength={500}
            placeholder={t("yourMessage")}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button
            className="w-full text-white"
            style={{ backgroundColor: color }}
            onClick={send}
            disabled={sending || !nome.trim() || !mensagem.trim()}
          >
            {sending ? <Loader2 className="animate-spin" /> : <Send />}
            {t("send")}
          </Button>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {mensagens.length === 0 ? (
          <p className="text-sm text-zinc-400">{t("empty")}</p>
        ) : (
          mensagens.map((m) => (
            <div key={m.id} className="rounded-lg bg-zinc-50 px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium text-zinc-900">
                  {m.nome}
                </span>
                <span className="shrink-0 text-xs text-zinc-400">
                  {new Date(m.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-0.5 whitespace-pre-line break-words text-sm text-zinc-600">
                {m.mensagem}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
