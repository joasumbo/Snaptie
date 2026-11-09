"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { guardarFaturacao } from "@/app/dashboard/pagamentos/actions";

type Emissor = { nome: string; nif: string; morada: string; email: string };

// Os dados que saem nos comprovativos e as regras de cobrança.
export default function Faturacao({ emissor, avisoAdmin, dias }: { emissor: Emissor; avisoAdmin: string; dias: number }) {
  const router = useRouter();
  const [v, setV] = useState({ ...emissor, avisoAdmin, dias: String(dias) });
  const [aGravar, setAGravar] = useState(false);
  const campo = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((x) => ({ ...x, [k]: e.target.value }));

  async function gravar() {
    setAGravar(true);
    const r = await guardarFaturacao({ ...v, dias: Number(v.dias) });
    setAGravar(false);
    if (!r.ok) toast.error(r.message);
    else {
      toast.success("Dados guardados.");
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comprovativos e cobranças</CardTitle>
        <CardDescription>
          Os dados que aparecem nos comprovativos em PDF e as regras de cobrança. Depois de cada pagamento, quem pagou
          recebe um email nosso com o comprovativo em anexo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Nome de quem recebe</Label>
            <Input value={v.nome} onChange={campo("nome")} />
          </div>
          <div className="space-y-1.5">
            <Label>NIF</Label>
            <Input value={v.nif} onChange={campo("nif")} />
          </div>
          <div className="space-y-1.5">
            <Label>Morada</Label>
            <Input value={v.morada} onChange={campo("morada")} />
          </div>
          <div className="space-y-1.5">
            <Label>Email de contacto (aparece no comprovativo)</Label>
            <Input type="email" value={v.email} onChange={campo("email")} />
          </div>
          <div className="space-y-1.5">
            <Label>Receber cópia de cada aviso (opcional)</Label>
            <Input type="email" placeholder="financeiro@empresa.pt" value={v.avisoAdmin} onChange={campo("avisoAdmin")} />
          </div>
          <div className="space-y-1.5">
            <Label>Dias até suspender quem não paga</Label>
            <Input inputMode="numeric" value={v.dias} onChange={campo("dias")} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Quando uma renovação falha, a empresa recebe um email com o link para pagar. Passados estes dias sem pagamento,
          as páginas e os QR codes dela ficam suspensos e voltam assim que pagar. Três dias antes de cada renovação, a
          empresa recebe um aviso.
        </p>
        <Button onClick={gravar} disabled={aGravar}>
          {aGravar ? <Loader2 className="animate-spin" /> : null} Guardar
        </Button>
      </CardContent>
    </Card>
  );
}
