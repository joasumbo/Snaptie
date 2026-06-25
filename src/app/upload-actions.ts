"use server";

import { getCurrentUser } from "@/lib/auth/dal";
import { buildKey, createUploadUrl, publicUrlFor } from "@/lib/storage";

export type UploadKind = "image" | "video" | "pdf";

const RULES: Record<
  UploadKind,
  { folder: string; types: Record<string, string>; maxMB: number }
> = {
  image: {
    folder: "images",
    types: {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/svg+xml": "svg",
    },
    maxMB: 8,
  },
  video: {
    folder: "videos",
    types: {
      "video/mp4": "mp4",
      "video/webm": "webm",
      "video/quicktime": "mov",
    },
    maxMB: 100,
  },
  pdf: {
    folder: "pdfs",
    types: { "application/pdf": "pdf" },
    maxMB: 20,
  },
};

export type UploadTicket =
  | { ok: true; uploadUrl: string; publicUrl: string }
  | { ok: false; message: string };

export async function requestUpload(input: {
  kind: UploadKind;
  contentType: string;
  size: number;
}): Promise<UploadTicket> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sem permissão." };

  const rule = RULES[input.kind];
  if (!rule) return { ok: false, message: "Tipo de upload inválido." };

  const ext = rule.types[input.contentType];
  if (!ext) return { ok: false, message: "Formato de ficheiro não suportado." };

  if (input.size > rule.maxMB * 1024 * 1024) {
    return { ok: false, message: `Ficheiro demasiado grande (máx. ${rule.maxMB} MB).` };
  }

  const key = buildKey(rule.folder, ext);
  const uploadUrl = await createUploadUrl({ key, contentType: input.contentType });
  return { ok: true, uploadUrl, publicUrl: publicUrlFor(key) };
}
