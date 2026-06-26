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
  temPin: boolean;
};

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { label: string; value: T }[];
}) {
  return (
    <div className="inline-flex rounded-lg border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1 text-sm transition-colors",
            value === o.value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

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
  const [novoPin, setNovoPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
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
      novoPin: novoPin || undefined,
    });
    setSubmitting(false);
    if (result.ok) {
      onSaved();
      router.refresh();
    } else {
      setError(result.message);
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
            <div className="flex items-center justify-between">
              <div>
                <Label>Edição pelo visitante</Label>
                <p className="text-xs text-muted-foreground">
                  Permite editar os conteúdos na página pública (com código).
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
            {edicaoPublica ? (
              <div className="space-y-1.5">
                <Label>Código de edição</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder={qr.temPin ? "•••• (deixe vazio para manter)" : "Defina um código"}
                  value={novoPin}
                  onChange={(e) => setNovoPin(e.target.value)}
                />
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
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
