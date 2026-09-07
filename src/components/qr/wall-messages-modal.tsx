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
import { deleteWallMessage } from "@/app/dashboard/qr-codes/actions";
import type { WallMessage } from "./message-wall";

// The owner's view of what visitors wrote, with a way to take a message down.
export function WallMessagesModal({
  titulo,
  mensagens,
  onClose,
}: {
  titulo: string;
  mensagens: WallMessage[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [removidas, setRemovidas] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

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
          <DialogTitle>{titulo || "Mural de mensagens"}</DialogTitle>
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
