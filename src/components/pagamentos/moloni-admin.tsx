"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { desligarContaMoloni, escolherEmpresaMoloni, ligarContaMoloni } from "@/app/dashboard/pagamentos/moloni-actions";

type Empresa = { company_id: number; name: string; vat: string };
type Estado = { ligado: false } | { ligado: true; utilizador: string; empresa: string | null; empresas: Empresa[] };

export default function MoloniAdmin({ estado }: { estado: Estado }) {
  const router = useRouter();
  const [utilizador, setUtilizador] = useState("");
  const [palavra, setPalavra] = useState("");
  const [aCorrer, setACorrer] = useState(false);

  async function ligar() {
    setACorrer(true);
    const r = await ligarContaMoloni(utilizador, palavra);
    setACorrer(false);
    setPalavra("");
    if (!r.ok) {
      toast.error(r.message);
      return;
    }
    toast.success("Moloni ligada.");
    router.refresh();
  }

  async function escolher(e: Empresa) {
    setACorrer(true);
    const r = await escolherEmpresaMoloni(e.company_id, e.name);
    setACorrer(false);
    if (!r.ok) toast.error(r.message);
    else router.refresh();
  }

  async function desligar() {
    if (!confirm("Desligar a Moloni? Os pagamentos deixam de gerar faturas até voltar a ligar.")) return;
    await desligarContaMoloni();
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Moloni
          <Badge variant={estado.ligado ? "default" : "secondary"}>{estado.ligado ? "Ligada" : "Por ligar"}</Badge>
        </CardTitle>
        <CardDescription>
          Faturas certificadas. A palavra-passe é usada só para ligar e não fica guardada: o Snaptie guarda o acesso que a
          Moloni devolve e renova-o sozinho.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {estado.ligado ? (
          <>
            <p>
              Ligada com <strong>{estado.utilizador}</strong>
              {estado.empresa ? (
                <>
                  , empresa <strong>{estado.empresa}</strong>.
                </>
              ) : (
                ". Escolha a empresa que emite as faturas:"
              )}
            </p>
            {!estado.empresa || estado.empresas.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                {estado.empresas.map((e) => (
                  <Button
                    key={e.company_id}
                    size="sm"
                    variant={estado.empresa === e.name ? "default" : "outline"}
                    disabled={aCorrer}
                    onClick={() => escolher(e)}
                  >
                    {e.name} {e.vat ? `· ${e.vat}` : ""}
                  </Button>
                ))}
              </div>
            ) : null}
            <Button size="sm" variant="ghost" className="text-destructive" onClick={desligar}>
              Desligar
            </Button>
          </>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label>Utilizador da Moloni (email)</Label>
              <Input type="email" autoComplete="off" value={utilizador} onChange={(e) => setUtilizador(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Palavra-passe</Label>
              <Input type="password" autoComplete="new-password" value={palavra} onChange={(e) => setPalavra(e.target.value)} />
            </div>
            <Button onClick={ligar} disabled={aCorrer}>
              {aCorrer ? <Loader2 className="animate-spin" /> : null} Ligar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
