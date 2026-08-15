"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Loader2, X } from "lucide-react";
import type { BlockType } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { Segmented } from "@/components/ui/segmented";
import { TYPE_FIELD, BLOCK_TYPE_LABELS, isContentBlock, parBotoes } from "@/lib/qr";
import { QrPage, type QrPageData } from "./qr-page";
import {
  verifyEditPin,
  saveBlockContent,
  savePageSettings,
  changeEditCode,
  requestPublicUpload,
} from "@/app/[empresa]/[codigo]/edit-actions";
import type { UploadKind } from "@/lib/storage";

type EditBlock = {
  id: string;
  tipo: BlockType;
  titulo: string;
  conteudo: Record<string, unknown>;
};

// The appearance of the page, as the visitor may change it.
type Look = {
  logo: string | null;
  imagemCapa: string | null;
  logoTamanho: string;
  logoForma: string;
  nomeTamanho: string;
  mostrarLogo: boolean;
  mostrarNome: boolean;
};

// Hands a FileUpload the PIN-checked ticket it needs to upload a file.
type Uploader = (
  kind: UploadKind,
) => (input: {
  kind: UploadKind;
  contentType: string;
  size: number;
}) => Promise<
  { ok: true; uploadUrl: string; publicUrl: string } | { ok: false; message: string }
>;

function str(c: Record<string, unknown>, k: string): string {
  return typeof c[k] === "string" ? (c[k] as string) : "";
}

export default function PublicQrView({
  data,
  codigo,
  edicaoPublica,
  edicaoPersonalizacao,
}: {
  data: QrPageData;
  codigo: string;
  edicaoPublica: boolean;
  edicaoPersonalizacao: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("PublicPage");
  const tc = useTranslations("Common");
  const [pinOpen, setPinOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [authPin, setAuthPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [edits, setEdits] = useState<EditBlock[]>([]);
  // What the code actually unlocked — the server decides, not the page.
  const [podeConteudo, setPodeConteudo] = useState(false);
  const [podePersonalizar, setPodePersonalizar] = useState(false);
  const [look, setLook] = useState<Look>(lookFrom(data));
  const [saving, setSaving] = useState(false);
  const [newCode, setNewCode] = useState("");

  function lookFrom(d: QrPageData): Look {
    return {
      logo: d.logo,
      imagemCapa: d.imagemCapa,
      logoTamanho: d.logoTamanho,
      logoForma: d.logoForma,
      nomeTamanho: d.nomeTamanho,
      mostrarLogo: d.mostrarLogo,
      mostrarNome: d.mostrarNome,
    };
  }

  async function checkPin() {
    setChecking(true);
    setPinError(null);
    const r = await verifyEditPin(codigo, pin);
    setChecking(false);
    if (!r.ok) {
      setPinError(
        r.espera ? t("tooMany", { minutos: r.espera }) : t("invalidCode"),
      );
      return;
    }
    setAuthPin(pin);
    setPodeConteudo(r.podeConteudo);
    setPodePersonalizar(r.podePersonalizar);
    // Only the elements the owner marked as editable by the visitor.
    setEdits(
      data.blocks
        .filter((b) => b.editavelPublico)
        .map((b) => ({
          id: b.id,
          tipo: b.tipo,
          titulo: b.titulo,
          conteudo: { ...b.conteudo },
        })),
    );
    setLook(lookFrom(data));
    setNewCode("");
    setPinOpen(false);
    setPanelOpen(true);
  }

  function setField(id: string, key: string, value: unknown) {
    setEdits((arr) =>
      arr.map((b) =>
        b.id === id ? { ...b, conteudo: { ...b.conteudo, [key]: value } } : b,
      ),
    );
  }
  function setTitulo(id: string, value: string) {
    setEdits((arr) => arr.map((b) => (b.id === id ? { ...b, titulo: value } : b)));
  }

  function setLookField<K extends keyof Look>(key: K, value: Look[K]) {
    setLook((l) => ({ ...l, [key]: value }));
  }

  async function saveAll() {
    setSaving(true);
    try {
      if (podeConteudo) {
        for (const b of edits) {
          const r = await saveBlockContent({
            codigo,
            pin: authPin,
            blockId: b.id,
            titulo: b.titulo,
            conteudo: b.conteudo,
          });
          if (!r.ok) {
            toast.error(r.message);
            return;
          }
        }
      }
      if (podePersonalizar) {
        const r = await savePageSettings({ codigo, pin: authPin, ...look });
        if (!r.ok) {
          toast.error(r.message);
          return;
        }
      }
      if (newCode.trim()) {
        const rc = await changeEditCode({ codigo, pin: authPin, newPin: newCode.trim() });
        if (!rc.ok) {
          toast.error(rc.message);
          return;
        }
        setAuthPin(newCode.trim());
      }
      toast.success(t("saved"));
      setPanelOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tc("error"));
    } finally {
      setSaving(false);
    }
  }

  const uploaderFor =
    (kind: UploadKind) =>
    (input: { kind: UploadKind; contentType: string; size: number }) =>
      requestPublicUpload({ ...input, kind, codigo, pin: authPin });

  return (
    <div className="min-h-screen">
      <QrPage
        data={data}
        codigo={codigo}
        footer={
          edicaoPublica || edicaoPersonalizacao ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setPin("");
                setPinError(null);
                setPinOpen(true);
              }}
            >
              <Pencil />
              {t("editPage")}
            </Button>
          ) : null
        }
      />

      <Dialog open={pinOpen} onOpenChange={(o) => !o && setPinOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editPage")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="edit-pin">{t("editCode")}</Label>
            <Input
              id="edit-pin"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
            {pinError ? (
              <p className="text-sm text-destructive">{pinError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={checkPin} disabled={checking}>
              {checking ? <Loader2 className="animate-spin" /> : null}
              {tc("enter")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={panelOpen}
        onOpenChange={(o) => !o && !saving && setPanelOpen(false)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("editPage")}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {podeConteudo && edits.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noEditable")}</p>
            ) : null}

            {podeConteudo
              ? edits.map((b) => (
                  <div key={b.id} className="space-y-2 rounded-lg border p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {BLOCK_TYPE_LABELS[b.tipo]}
                    </div>
                    {!isContentBlock(b.tipo) ? (
                      <div className="space-y-1.5">
                        <Label>{t("fieldTitle")}</Label>
                        <Input
                          value={b.titulo}
                          onChange={(e) => setTitulo(b.id, e.target.value)}
                        />
                      </div>
                    ) : null}
                    <BlockFields
                      block={b}
                      setField={setField}
                      uploaderFor={uploaderFor}
                    />
                  </div>
                ))
              : null}

            {podePersonalizar ? (
              <LookFields
                look={look}
                setLookField={setLookField}
                uploaderFor={uploaderFor}
              />
            ) : null}

            <div className="space-y-1.5 rounded-lg border p-3">
              <Label>{t("changeCodeLabel")}</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder={t("newCodePlaceholder")}
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("changeCodeHint")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPanelOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={saveAll} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              {tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// The same appearance controls the owner has in the dashboard, offered to the
// visitor when the owner granted that permission.
function LookFields({
  look,
  setLookField,
  uploaderFor,
}: {
  look: Look;
  setLookField: <K extends keyof Look>(key: K, value: Look[K]) => void;
  uploaderFor: Uploader;
}) {
  const t = useTranslations("PublicPage");
  const sizes = [
    { label: t("sizeSmall"), value: "P" },
    { label: t("sizeMedium"), value: "M" },
    { label: t("sizeLarge"), value: "G" },
  ];
  const showHide = [
    { label: t("show"), value: "sim" },
    { label: t("hide"), value: "nao" },
  ];

  return (
    <div className="space-y-4 rounded-lg border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("customise")}
      </div>

      <div className="space-y-1.5">
        <Label>{t("cover")}</Label>
        <FileUpload
          kind="image"
          value={look.imagemCapa}
          onChange={(v) => setLookField("imagemCapa", v)}
          uploader={uploaderFor("image")}
        />
      </div>

      <div className="space-y-1.5">
        <Label>{t("logo")}</Label>
        <FileUpload
          kind="image"
          value={look.logo}
          onChange={(v) => setLookField("logo", v)}
          uploader={uploaderFor("image")}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Label>{t("showLogo")}</Label>
        <Segmented
          value={look.mostrarLogo ? "sim" : "nao"}
          onChange={(v) => setLookField("mostrarLogo", v === "sim")}
          options={showHide}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Label>{t("showName")}</Label>
        <Segmented
          value={look.mostrarNome ? "sim" : "nao"}
          onChange={(v) => setLookField("mostrarNome", v === "sim")}
          options={showHide}
        />
      </div>

      <div className="space-y-1.5">
        <Label>{t("logoSize")}</Label>
        <div>
          <Segmented
            value={look.logoTamanho}
            onChange={(v) => setLookField("logoTamanho", v)}
            options={sizes}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t("logoShape")}</Label>
        <div>
          <Segmented
            value={look.logoForma}
            onChange={(v) => setLookField("logoForma", v)}
            options={[
              { label: t("shapeCircle"), value: "circulo" },
              { label: t("shapeSquare"), value: "quadrado" },
            ]}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t("nameSize")}</Label>
        <div>
          <Segmented
            value={look.nomeTamanho}
            onChange={(v) => setLookField("nomeTamanho", v)}
            options={sizes}
          />
        </div>
      </div>
    </div>
  );
}

function BlockFields({
  block,
  setField,
  uploaderFor,
}: {
  block: EditBlock;
  setField: (id: string, key: string, value: unknown) => void;
  uploaderFor: Uploader;
}) {
  const t = useTranslations("PublicPage");
  const field = TYPE_FIELD[block.tipo];
  const c = block.conteudo;
  const id = block.id;

  if (field === "texto") {
    return (
      <div className="space-y-1.5">
        <Label>{t("fieldText")}</Label>
        <textarea
          rows={3}
          value={str(c, "texto")}
          onChange={(e) => setField(id, "texto", e.target.value)}
          className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
    );
  }
  if (field === "titulo") {
    return (
      <div className="space-y-1.5">
        <Label>{t("fieldTitle")}</Label>
        <Input
          value={str(c, "texto")}
          onChange={(e) => setField(id, "texto", e.target.value)}
        />
      </div>
    );
  }
  if (field === "url") {
    return (
      <div className="space-y-1.5">
        <Label>{block.tipo === "MAPA" ? t("fieldMapsLink") : t("fieldUrl")}</Label>
        <Input
          placeholder="https://"
          value={str(c, "url")}
          onChange={(e) => setField(id, "url", e.target.value)}
        />
      </div>
    );
  }
  if (field === "telefone" || field === "whatsapp") {
    return (
      <>
        <div className="space-y-1.5">
          <Label>{t("fieldNumber")}</Label>
          <Input
            value={str(c, "numero")}
            onChange={(e) => setField(id, "numero", e.target.value)}
          />
        </div>
        {field === "whatsapp" ? (
          <div className="space-y-1.5">
            <Label>{t("fieldMessage")}</Label>
            <Input
              value={str(c, "mensagem")}
              onChange={(e) => setField(id, "mensagem", e.target.value)}
            />
          </div>
        ) : null}
      </>
    );
  }
  if (field === "email") {
    return (
      <div className="space-y-1.5">
        <Label>{t("fieldEmail")}</Label>
        <Input
          type="email"
          value={str(c, "email")}
          onChange={(e) => setField(id, "email", e.target.value)}
        />
      </div>
    );
  }
  if (field === "wifi") {
    return (
      <>
        <div className="space-y-1.5">
          <Label>{t("fieldSsid")}</Label>
          <Input
            value={str(c, "ssid")}
            onChange={(e) => setField(id, "ssid", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("fieldPassword")}</Label>
          <Input
            value={str(c, "password")}
            onChange={(e) => setField(id, "password", e.target.value)}
          />
        </div>
      </>
    );
  }
  if (field === "imagem" || field === "video" || field === "pdf") {
    const kind: UploadKind =
      field === "imagem" ? "image" : field === "video" ? "video" : "pdf";
    return (
      <div className="space-y-1.5">
        <Label>{t("fieldFile")}</Label>
        <FileUpload
          kind={kind}
          value={str(c, "url") || null}
          onChange={(v) => setField(id, "url", v ?? "")}
          uploader={uploaderFor(kind)}
        />
      </div>
    );
  }
  // O visitante troca a imagem e o destino; a forma e o tamanho ficam com quem
  // desenhou a página, para a edição pública não lhe desfazer o alinhamento.
  if (field === "botaoImagem") {
    return (
      <>
        <div className="space-y-1.5">
          <Label>{t("fieldFile")}</Label>
          <FileUpload
            kind="image"
            value={str(c, "imagem") || null}
            onChange={(v) => setField(id, "imagem", v ?? "")}
            uploader={uploaderFor("image")}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("fieldUrl")}</Label>
          <Input
            placeholder="https://"
            value={str(c, "url")}
            onChange={(e) => setField(id, "url", e.target.value)}
          />
        </div>
      </>
    );
  }
  // O visitante troca a imagem, o nome e o destino de cada um dos dois.
  if (field === "parBotoes") {
    const botoes = parBotoes(c);
    const guardar = (i: number, key: string, valor: string) =>
      setField(
        id,
        "botoes",
        botoes.map((b, j) => (j === i ? { ...b, [key]: valor } : b)),
      );
    return (
      <>
        {botoes.map((botao, i) => (
          <div key={i} className="space-y-1.5 rounded-lg border p-3">
            <Label>{`${t("fieldFile")} ${i + 1}`}</Label>
            <FileUpload
              kind="image"
              value={botao.imagem || null}
              onChange={(v) => guardar(i, "imagem", v ?? "")}
              uploader={uploaderFor("image")}
            />
            <Input
              value={botao.texto}
              onChange={(e) => guardar(i, "texto", e.target.value)}
            />
            <Input
              placeholder="https://"
              value={botao.url}
              onChange={(e) => guardar(i, "url", e.target.value)}
            />
          </div>
        ))}
      </>
    );
  }
  if (field === "carrossel") {
    const imgs = Array.isArray(c.imagens) ? (c.imagens as string[]) : [];
    return (
      <div className="space-y-2">
        <Label>{t("fieldImages")}</Label>
        {imgs.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {imgs.map((src, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="size-16 rounded-md object-cover" />
                <button
                  type="button"
                  onClick={() =>
                    setField(
                      id,
                      "imagens",
                      imgs.filter((_, j) => j !== i),
                    )
                  }
                  className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <FileUpload
          kind="image"
          value={null}
          onChange={(v) => {
            if (v) setField(id, "imagens", [...imgs, v]);
          }}
          uploader={uploaderFor("image")}
        />
      </div>
    );
  }
  return null;
}
