"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Loader2, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { euros } from "@/lib/pagamentos";
import { precoQrNaLoja } from "@/app/dashboard/pagamentos/actions";

type Qr = { id: string; nome: string; empresa: string };
type AVenda = Qr & { precoCentimos: number; vendidos: number; publicado: boolean };

// Os QRs à venda na loja pública. Cada compra cria uma cópia do QR escolhido
// para quem pagou e manda-lha por email com o código de edição.
export default function LojaAdmin({ aVenda, qrs }: { aVenda: AVenda[]; qrs: Qr[] }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState("");
  const [escolhido, setEscolhido] = useState("");
  const [preco, setPreco] = useState("");
  const [aGuardar, iniciar] = useTransition();

  const opcoes = useMemo(() => {
    const t = filtro.trim().toLowerCase();
    const ja = new Set(aVenda.map((q) => q.id));
    return qrs.filter((q) => !ja.has(q.id) && (!t || `${q.nome} ${q.empresa}`.toLowerCase().includes(t))).slice(0, 100);
  }, [filtro, qrs, aVenda]);

  function guardar(qrId: string, valor: number | null, ok: string) {
    iniciar(async () => {
      const r = await precoQrNaLoja(qrId, valor);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success(ok);
      setEscolhido("");
      setPreco("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingBag className="size-5" /> Loja
          <Badge variant={aVenda.length ? "default" : "secondary"}>
            {aVenda.length ? `${aVenda.length} à venda` : "Nada à venda"}
          </Badge>
        </CardTitle>
        <CardDescription>
          QRs que qualquer pessoa pode comprar em{" "}
          <a href="/loja" target="_blank" rel="noreferrer" className="text-indigo-600 underline-offset-4 hover:underline">
            mysnaptie.com/loja
          </a>
          . Quando o pagamento entra, o sistema cria uma cópia do QR para quem pagou e envia-lhe por email a imagem do
          QR, o link da página e o código para a editar. Desenhe o QR modelo como quer que o cliente o receba.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {aVenda.length ? (
          <div className="divide-y rounded-lg border">
            {aVenda.map((q) => (
              <LinhaVenda key={q.id} q={q} aGuardar={aGuardar} guardar={guardar} />
            ))}
          </div>
        ) : null}

        <div className="space-y-3 rounded-lg border border-dashed p-4">
          <div className="font-medium">Pôr um QR à venda</div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_140px_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="loja-filtro">Procurar</Label>
              <Input id="loja-filtro" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Nome do QR ou empresa" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loja-qr">QR modelo</Label>
              <select
                id="loja-qr"
                value={escolhido}
                onChange={(e) => setEscolhido(e.target.value)}
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
              >
                <option value="">Escolha um QR</option>
                {opcoes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.nome} · {q.empresa}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loja-preco">Preço (€)</Label>
              <Input id="loja-preco" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="9,90" />
            </div>
            <Button
              disabled={aGuardar || !escolhido || !preco}
              onClick={() => guardar(escolhido, Number(preco.replace(",", ".")), "QR posto à venda.")}
            >
              {aGuardar ? <Loader2 className="animate-spin" /> : <Plus />} Pôr à venda
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LinhaVenda({
  q,
  aGuardar,
  guardar,
}: {
  q: AVenda;
  aGuardar: boolean;
  guardar: (id: string, valor: number | null, ok: string) => void;
}) {
  const [preco, setPreco] = useState((q.precoCentimos / 100).toFixed(2).replace(".", ","));
  const mudou = Math.round(Number(preco.replace(",", ".")) * 100) !== q.precoCentimos;
  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{q.nome}</div>
        <div className="text-xs text-muted-foreground">
          {q.empresa} · {q.vendidos === 1 ? "1 venda" : `${q.vendidos} vendas`}
          {q.publicado ? null : " · sem exemplo (o modelo não está publicado)"}
        </div>
      </div>
      <span className="text-muted-foreground">{euros(q.precoCentimos)}</span>
      <Input className="h-8 w-24" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} aria-label="Preço" />
      {mudou ? (
        <Button size="sm" variant="outline" disabled={aGuardar} onClick={() => guardar(q.id, Number(preco.replace(",", ".")), "Preço atualizado.")}>
          Guardar
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" nativeButton={false} render={<a href={`/dashboard/qr-codes/${q.id}`} />} aria-label="Editar o QR modelo">
        <ExternalLink />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={aGuardar}
        aria-label="Tirar da loja"
        onClick={() => confirm(`Tirar "${q.nome}" da loja? Quem já comprou fica com o seu QR.`) && guardar(q.id, null, "Retirado da loja.")}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
