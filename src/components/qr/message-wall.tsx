"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Send, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadFile } from "@/lib/upload-client";
import { tempoRelativo } from "@/lib/tempo";
import { estadoManutencao } from "@/lib/qr";
import { postWallMessage, requestWallUpload } from "@/app/[empresa]/[codigo]/wall-actions";

export type WallMessage = {
  id: string;
  nome: string;
  mensagem: string;
  imagem?: string | null;
  estado?: string | null;
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
  manutencao = false,
}: {
  blockId: string;
  titulo: string;
  descricao: string | null;
  mensagens: WallMessage[];
  codigo?: string;
  color: string;
  // No mural de manutenção cada participação tem estado, e é ele que lhe dá
  // a cor de fundo.
  manutencao?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("Wall");
  const locale = useLocale();
  const fileInput = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [imagem, setImagem] = useState<{ file: File; preview: string } | null>(null);
  const [sending, setSending] = useState(false);

  // O relógio só arranca depois de montar. Se a hora relativa fosse calculada
  // no servidor, o texto vinha de um instante e o cliente reescrevia-o noutro —
  // até lá mostra-se a data, que é igual dos dois lados.
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => {
    setAgora(Date.now());
    const timer = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  function escolherImagem(file: File) {
    if (imagem) URL.revokeObjectURL(imagem.preview);
    setImagem({ file, preview: URL.createObjectURL(file) });
  }
  function limparImagem() {
    if (imagem) URL.revokeObjectURL(imagem.preview);
    setImagem(null);
  }

  async function send() {
    if (!codigo || !nome.trim() || (!mensagem.trim() && !imagem)) return;
    setSending(true);
    try {
      const url = imagem
        ? await uploadFile(imagem.file, "image", (input) =>
            requestWallUpload({ ...input, codigo, blockId }),
          )
        : "";
      const r = await postWallMessage({ codigo, blockId, nome, mensagem, imagem: url });
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
      limparImagem();
      toast.success(t("posted"));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failed"));
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

          {imagem ? (
            <div className="relative w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagem.preview}
                alt=""
                className="size-20 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={limparImagem}
                className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-zinc-900 text-white"
              >
                <X className="size-3" />
              </button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileInput.current?.click()}
              disabled={sending}
            >
              <ImagePlus />
              {t("addImage")}
            </Button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) escolherImagem(f);
              e.target.value = "";
            }}
          />

          <Button
            className="w-full text-white"
            style={{ backgroundColor: color }}
            onClick={send}
            disabled={sending || !nome.trim() || (!mensagem.trim() && !imagem)}
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
            <div
              key={m.id}
              className="rounded-lg px-3 py-2"
              style={
                manutencao
                  ? { backgroundColor: estadoManutencao(m.estado).cor }
                  : { backgroundColor: "#fafafa" }
              }
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium text-zinc-900">
                  {m.nome}
                </span>
                {manutencao ? (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{
                      backgroundColor: "#ffffffcc",
                      color: estadoManutencao(m.estado).texto,
                    }}
                  >
                    {t(`status_${estadoManutencao(m.estado).valor}`)}
                  </span>
                ) : null}
                <span className="shrink-0 text-xs text-zinc-500">
                  {agora === null
                    ? new Date(m.createdAt).toLocaleDateString(locale)
                    : tempoRelativo(m.createdAt, agora, locale)}
                </span>
              </div>
              {m.mensagem ? (
                <p className="mt-0.5 whitespace-pre-line break-words text-sm text-zinc-800">
                  {m.mensagem}
                </p>
              ) : null}
              {m.imagem ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.imagem}
                  alt=""
                  className="mt-2 max-h-72 w-full rounded-lg object-cover"
                />
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
