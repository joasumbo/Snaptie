"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, X, FileText, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestUpload, type UploadKind } from "@/app/upload-actions";

const ACCEPT: Record<UploadKind, string> = {
  image: "image/*",
  video: "video/*",
  pdf: "application/pdf",
};

export function FileUpload({
  kind,
  value,
  onChange,
}: {
  kind: UploadKind;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    const ticket = await requestUpload({
      kind,
      contentType: file.type,
      size: file.size,
    });
    if (!ticket.ok) {
      toast.error(ticket.message);
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(ticket.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!res.ok) throw new Error("upload failed");
      onChange(ticket.publicUrl);
      toast.success("Ficheiro carregado.");
    } catch {
      toast.error("Falha no upload. Verifique a configuração de CORS do R2.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[kind]}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {value ? (
        <div className="flex items-center gap-3 rounded-lg border p-2">
          {kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Pré-visualização"
              className="size-14 rounded-md object-cover"
            />
          ) : (
            <div className="flex size-14 items-center justify-center rounded-md bg-muted text-muted-foreground">
              {kind === "video" ? (
                <Film className="size-5" />
              ) : (
                <FileText className="size-5" />
              )}
            </div>
          )}
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 truncate text-sm text-primary hover:underline"
          >
            Ficheiro carregado
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onChange(null)}
          >
            <X />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Upload />}
          Carregar ficheiro
        </Button>
      )}
    </div>
  );
}
