"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  deleteWallMessage,
  setWallMessageState,
} from "@/app/dashboard/qr-codes/actions";
import { ESTADOS_MANUTENCAO, estadoManutencao } from "@/lib/qr";
import type { WallMessage } from "./message-wall";

// The owner's view of what visitors wrote, with a way to take a message down.
export function WallMessagesModal({
  titulo,
  mensagens,
  onClose,
  manutencao = false,
}: {
  titulo: string;
  mensagens: WallMessage[];
  onClose: () => void;
  // Só o mural de manutenção tem estados para gerir.
  manutencao?: boolean;
}) {
  const router = useRouter();
  const [removidas, setRemovidas] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  // O estado muda já no ecrã e só depois é confirmado pelo servidor: esperar
  // pela resposta para pintar deixava o toque a parecer perdido.
  const [estados, setEstados] = useState<Record<string, string>>({});

  async function mudarEstado(id: string, estado: string) {
    const anterior = estados[id];
    setEstados((e) => ({ ...e, [id]: estado }));
    const r = await setWallMessageState(id, estado);
    if (!r.ok) {
      setEstados((e) => ({ ...e, [id]: anterior ?? "" }));
      toast.error(r.message);
      return;
    }
    router.refresh();
  }

  const visiveis = mensagens.filter((m) => !removidas.includes(m.id));

  async function remove(id: string) {
    setBusy(id);
    try {
      const r = await deleteWallMessage(id);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setRemovidas((arr) => [...arr, id]);
      router.refresh();
    } catch {
      toast.error("Ocorreu um erro. Tente novamente.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {titulo || (manutencao ? "Manutenção" : "Mural de mensagens")}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {visiveis.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Ainda não há mensagens.
            </p>
          ) : (
            visiveis.map((m) => (
              <div
                key={m.id}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate font-medium">{m.nome}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(m.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {m.mensagem ? (
                    <p className="mt-0.5 whitespace-pre-line break-words text-sm text-muted-foreground">
                      {m.mensagem}
                    </p>
                  ) : null}
                  {/* Quem modera tem de ver o que está a apagar; sem a imagem
                      aqui, decidia às cegas sobre metade da mensagem. */}
                  {m.imagem ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.imagem}
                      alt=""
                      className="mt-2 size-20 rounded-lg object-cover"
                    />
                  ) : null}
                  {manutencao ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ESTADOS_MANUTENCAO.map((e) => {
                        const atual =
                          estadoManutencao(estados[m.id] ?? m.estado).valor;
                        const ativo = atual === e.valor;
                        return (
                          <button
                            key={e.valor}
                            type="button"
                            onClick={() => mudarEstado(m.id, e.valor)}
                            className="rounded-full border px-2.5 py-1 text-xs font-medium transition"
                            style={
                              ativo
                                ? {
                                    backgroundColor: e.cor,
                                    color: e.texto,
                                    borderColor: e.texto,
                                  }
                                : { color: "#71717a" }
                            }
                          >
                            {e.rotulo}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  disabled={busy === m.id}
                  onClick={() => remove(m.id)}
                >
                  {busy === m.id ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Trash2 />
                  )}
                </Button>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
