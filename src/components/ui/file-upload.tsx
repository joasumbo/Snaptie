"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Upload, X, FileText, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestUpload } from "@/app/upload-actions";
import type { UploadKind, UploadTicket } from "@/lib/storage";

const ACCEPT: Record<UploadKind, string> = {
  image: "image/*",
  video: "video/*",
  pdf: "application/pdf",
};

type Uploader = (input: {
  kind: UploadKind;
  contentType: string;
  size: number;
}) => Promise<UploadTicket>;

export function FileUpload({
  kind,
  value,
  onChange,
  uploader,
}: {
  kind: UploadKind;
  value: string | null;
  onChange: (url: string | null) => void;
  uploader?: Uploader;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const t = useTranslations("Upload");

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const ticket = await (uploader ?? requestUpload)({
        kind,
        contentType: file.type,
        size: file.size,
      });
      if (!ticket.ok) {
        toast.error(ticket.message);
        return;
      }
      const res = await fetch(ticket.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!res.ok) throw new Error("upload failed");
      onChange(ticket.publicUrl);
      toast.success(t("success"));
    } catch {
      toast.error(t("failed"));
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
            {t("uploaded")}
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
          {t("uploadFile")}
        </Button>
      )}
    </div>
  );
}
