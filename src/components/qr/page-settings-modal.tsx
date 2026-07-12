"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import { updateQrCode } from "@/app/dashboard/qr-codes/actions";

export type PageSettings = {
  id: string;
  nome: string;
  descricao: string | null;
  corPrimaria: string | null;
  corSecundaria: string | null;
  logo: string | null;
  imagemCapa: string | null;
  logoTamanho: string;
  logoForma: string;
  nomeTamanho: string;
  mostrarLogo: boolean;
  mostrarNome: boolean;
  edicaoPublica: boolean;
  edicaoPersonalizacao: boolean;
  temPin: boolean;
};

export function PageSettingsModal({
  qr,
  onClose,
  onSaved,
}: {
  qr: PageSettings;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [logo, setLogo] = useState(qr.logo);
  const [imagemCapa, setImagemCapa] = useState(qr.imagemCapa);
  const [logoTamanho, setLogoTamanho] = useState(qr.logoTamanho);
  const [logoForma, setLogoForma] = useState(qr.logoForma);
  const [nomeTamanho, setNomeTamanho] = useState(qr.nomeTamanho);
  const [mostrarLogo, setMostrarLogo] = useState(qr.mostrarLogo);
  const [mostrarNome, setMostrarNome] = useState(qr.mostrarNome);
  const [edicaoPublica, setEdicaoPublica] = useState(qr.edicaoPublica);
  const [edicaoPersonalizacao, setEdicaoPersonalizacao] = useState(
    qr.edicaoPersonalizacao,
  );
  const [novoPin, setNovoPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Both permissions share the same code, so either one being on requires it —
  // an existing code or a new one.
  const algumaEdicao = edicaoPublica || edicaoPersonalizacao;
  const precisaCodigo = algumaEdicao && !qr.temPin && !novoPin.trim();

  async function handleSubmit() {
    setError(null);
    if (precisaCodigo) {
      setError("Defina um código de acesso para ativar a edição pelo visitante.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await updateQrCode({
        id: qr.id,
        nome: qr.nome,
        descricao: qr.descricao ?? undefined,
        corPrimaria: qr.corPrimaria ?? undefined,
        corSecundaria: qr.corSecundaria ?? undefined,
        logo,
        imagemCapa,
        logoTamanho,
        logoForma,
        nomeTamanho,
        mostrarLogo,
        mostrarNome,
        edicaoPublica,
        edicaoPersonalizacao,
        novoPin: novoPin || undefined,
      });
      if (result.ok) {
        onSaved();
        router.refresh();
      } else {
        setError(result.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocorreu um erro. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  const sizes = [
    { label: "Pequeno", value: "P" },
    { label: "Médio", value: "M" },
    { label: "Grande", value: "G" },
  ];

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !submitting) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Personalizar página</DialogTitle>
        </DialogHeader>

        {error ? (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label>Imagem de capa</Label>
            <FileUpload kind="image" value={imagemCapa} onChange={setImagemCapa} />
          </div>

          <div className="space-y-1.5">
            <Label>Logótipo</Label>
            <FileUpload kind="image" value={logo} onChange={setLogo} />
          </div>

          <div className="flex items-center justify-between">
            <Label>Mostrar logótipo</Label>
            <Segmented
              value={mostrarLogo ? "sim" : "nao"}
              onChange={(v) => setMostrarLogo(v === "sim")}
              options={[
                { label: "Mostrar", value: "sim" },
                { label: "Ocultar", value: "nao" },
              ]}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Mostrar nome</Label>
            <Segmented
              value={mostrarNome ? "sim" : "nao"}
              onChange={(v) => setMostrarNome(v === "sim")}
              options={[
                { label: "Mostrar", value: "sim" },
                { label: "Ocultar", value: "nao" },
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tamanho do logótipo</Label>
            <div>
              <Segmented value={logoTamanho} onChange={setLogoTamanho} options={sizes} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Forma do logótipo</Label>
            <div>
              <Segmented
                value={logoForma}
                onChange={setLogoForma}
                options={[
                  { label: "Círculo", value: "circulo" },
                  { label: "Quadrado", value: "quadrado" },
                ]}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tamanho do nome</Label>
            <div>
              <Segmented value={nomeTamanho} onChange={setNomeTamanho} options={sizes} />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div>
              <Label>Edição pelo visitante</Label>
              <p className="text-xs text-muted-foreground">
                O que o visitante pode alterar na página pública, depois de
                introduzir o código de acesso.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Conteúdos</Label>
                <p className="text-xs text-muted-foreground">
                  Os elementos marcados como editáveis.
                </p>
              </div>
              <Segmented
                value={edicaoPublica ? "sim" : "nao"}
                onChange={(v) => setEdicaoPublica(v === "sim")}
                options={[
                  { label: "Ligado", value: "sim" },
                  { label: "Desligado", value: "nao" },
                ]}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Personalização</Label>
                <p className="text-xs text-muted-foreground">
                  A capa, o logótipo, os tamanhos e a forma.
                </p>
              </div>
              <Segmented
                value={edicaoPersonalizacao ? "sim" : "nao"}
                onChange={(v) => setEdicaoPersonalizacao(v === "sim")}
                options={[
                  { label: "Ligado", value: "sim" },
                  { label: "Desligado", value: "nao" },
                ]}
              />
            </div>

            {algumaEdicao ? (
              <div className="space-y-1.5">
                <Label>Código de acesso</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder={
                    qr.temPin ? "Deixe vazio para manter o atual" : "Defina um código (ex.: 1234)"
                  }
                  value={novoPin}
                  onChange={(e) => setNovoPin(e.target.value)}
                  aria-invalid={precisaCodigo}
                />
                <p
                  className={cn(
                    "text-xs",
                    precisaCodigo ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {qr.temPin
                    ? "Já tem um código definido. Escreva um novo para o alterar."
                    : "Os visitantes precisam deste código para editar a página."}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
