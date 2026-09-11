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
  acessoModo: string;
  idioma: string | null;
  temAcessoPin: boolean;
  ativado: boolean;
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
  const [acessoModo, setAcessoModo] = useState(qr.acessoModo);
  const [idioma, setIdioma] = useState(qr.idioma ?? "");
  const [novoAcessoPin, setNovoAcessoPin] = useState("");
  const [reiniciarAtivacao, setReiniciarAtivacao] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Both permissions share the same code, so either one being on requires it —
  // an existing code or a new one.
  const algumaEdicao = edicaoPublica || edicaoPersonalizacao;
  const precisaCodigo = algumaEdicao && !qr.temPin && !novoPin.trim();

  // The activation and private modes are meaningless without a PIN.
  const acessoComPin = acessoModo === "ativacao" || acessoModo === "privado";
  const precisaPinAcesso = acessoComPin && !qr.temAcessoPin && !novoAcessoPin.trim();

  async function handleSubmit() {
    setError(null);
    if (precisaCodigo) {
      setError("Defina um código de acesso para ativar a edição pelo visitante.");
      return;
    }
    if (precisaPinAcesso) {
      setError("Defina um PIN para este modo de acesso.");
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
        acessoModo,
        idioma,
        novoAcessoPin: novoAcessoPin || undefined,
        reiniciarAtivacao: reiniciarAtivacao || undefined,
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

          <div className="space-y-1.5">
            <Label>Idioma da página</Label>
            <select
              value={idioma}
              onChange={(e) => setIdioma(e.target.value)}
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Automático (segue o visitante)</option>
              <option value="pt">Português</option>
              <option value="en">Inglês</option>
              <option value="es">Espanhol</option>
              <option value="fr">Francês</option>
              <option value="de">Alemão</option>
            </select>
            <p className="text-xs text-muted-foreground">
              No automático, a página aparece no idioma do telemóvel de quem a
              abre. Fixe um idioma quando a página é para uma equipa e não para
              visitantes de fora.
            </p>
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

          <div className="space-y-3 rounded-lg border p-3">
            <div>
              <Label>Acesso à página</Label>
              <p className="text-xs text-muted-foreground">
                Quem consegue ver a página depois de fazer scan.
              </p>
            </div>

            <div>
              <Segmented
                value={acessoModo}
                onChange={setAcessoModo}
                options={[
                  { label: "Aberto", value: "aberto" },
                  { label: "Ativação", value: "ativacao" },
                  { label: "Privado", value: "privado" },
                ]}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              {acessoModo === "aberto"
                ? "Qualquer pessoa que faça scan vê a página."
                : acessoModo === "ativacao"
                  ? "O primeiro visitante que souber o PIN ativa o QR. A partir daí, a página fica visível para todos."
                  : "O PIN é pedido sempre que alguém abre a página."}
            </p>

            {acessoComPin ? (
              <div className="space-y-1.5">
                <Label>PIN de acesso</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder={
                    qr.temAcessoPin
                      ? "Deixe vazio para manter o atual"
                      : "Defina um PIN (ex.: 1234)"
                  }
                  value={novoAcessoPin}
                  onChange={(e) => setNovoAcessoPin(e.target.value)}
                  aria-invalid={precisaPinAcesso}
                />
                <p
                  className={cn(
                    "text-xs",
                    precisaPinAcesso ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {acessoModo === "ativacao"
                    ? "Este é o PIN a imprimir junto do QR (por exemplo, na embalagem)."
                    : "Sem este PIN, ninguém consegue abrir a página."}
                </p>
              </div>
            ) : null}

            {acessoModo === "ativacao" && qr.ativado ? (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-2.5">
                <div>
                  <Label>Este QR já foi ativado</Label>
                  <p className="text-xs text-muted-foreground">
                    Reinicie se o objeto mudou de dono e o PIN voltar a ser pedido.
                  </p>
                </div>
                <Segmented
                  value={reiniciarAtivacao ? "sim" : "nao"}
                  onChange={(v) => setReiniciarAtivacao(v === "sim")}
                  options={[
                    { label: "Manter", value: "nao" },
                    { label: "Reiniciar", value: "sim" },
                  ]}
                />
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
