"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Copy, FileSpreadsheet, Printer, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { duplicateQrCodeSeries } from "@/app/dashboard/qr-codes/actions";

export function QrSeriesModal({
  source,
  onClose,
}: {
  source: { id: string; nome: string };
  onClose: () => void;
}) {
  const router = useRouter();
  const [count, setCount] = useState(50);
  const [busy, setBusy] = useState(false);
  const [feito, setFeito] = useState<{ lote: string; criados: number } | null>(null);

  async function criar() {
    if (busy) return;
    if (count < 1 || count > 500) {
      toast.error("A quantidade tem de ser entre 1 e 500.");
      return;
    }
    setBusy(true);
    const r = await duplicateQrCodeSeries({ sourceId: source.id, count });
    setBusy(false);
    if (!r.ok) {
      toast.error(r.message);
      return;
    }
    setFeito({ lote: r.lote!, criados: r.created ?? count });
    toast.success(`${r.created} cópias criadas.`);
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicar em série</DialogTitle>
          <DialogDescription>
            Cria cópias de <strong>{source.nome}</strong> — cada uma é um QR único
            (código e link próprios), com os mesmos conteúdos e aparência.
          </DialogDescription>
        </DialogHeader>

        {!feito ? (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="qtd">Quantas cópias?</Label>
              <Input
                id="qtd"
                type="number"
                min={1}
                max={500}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                Entre 1 e 500. Ficam numeradas: {source.nome} #001, #002, …
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="size-4 shrink-0" />
              {feito.criados} cópias criadas. Exporta o lote:
            </div>
            <div className="grid gap-2">
              <Button
                variant="outline"
                nativeButton={false}
                render={<a href={`/api/qr/export?lote=${feito.lote}&format=csv`} />}
              >
                <FileSpreadsheet />
                Descarregar CSV (Excel / Word)
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={<a href={`/api/qr/export?lote=${feito.lote}&format=print`} target="_blank" rel="noreferrer" />}
              >
                <Printer />
                Folha de impressão (PDF)
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(feito.lote);
                  toast.success("Código do lote copiado.");
                }}
              >
                <Copy />
                Lote: {feito.lote}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          {!feito ? (
            <>
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                Cancelar
              </Button>
              <Button onClick={criar} disabled={busy}>
                {busy && <Loader2 className="animate-spin" />}
                {busy ? "A criar…" : `Criar ${count} cópias`}
              </Button>
            </>
          ) : (
            <Button onClick={onClose}>Concluído</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
