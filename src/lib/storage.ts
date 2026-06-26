import "server-only";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint = process.env.R2_ENDPOINT;
const bucket = process.env.R2_BUCKET;
const prefix = process.env.R2_PREFIX ?? "";
const publicBase = process.env.R2_PUBLIC_URL;

// S3-compatible client pointed at Cloudflare R2.
export const r2 = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

export function publicUrlFor(key: string): string {
  return `${(publicBase ?? "").replace(/\/$/, "")}/${key}`;
}

// Builds a unique object key under the configured prefix, e.g. snaptie/images/<id>.jpg
export function buildKey(folder: string, ext: string): string {
  const id = crypto.randomUUID();
  return [prefix, folder, `${id}.${ext}`].filter(Boolean).join("/");
}

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
    types: { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" },
    maxMB: 100,
  },
  pdf: { folder: "pdfs", types: { "application/pdf": "pdf" }, maxMB: 20 },
};

// Validates an upload request and returns the object key to use.
export function prepareUpload(
  kind: UploadKind,
  contentType: string,
  size: number,
): { ok: true; key: string } | { ok: false; message: string } {
  const rule = RULES[kind];
  if (!rule) return { ok: false, message: "Tipo de upload inválido." };
  const ext = rule.types[contentType];
  if (!ext) return { ok: false, message: "Formato de ficheiro não suportado." };
  if (size > rule.maxMB * 1024 * 1024) {
    return { ok: false, message: `Ficheiro demasiado grande (máx. ${rule.maxMB} MB).` };
  }
  return { ok: true, key: buildKey(rule.folder, ext) };
}

// Generates a short-lived presigned URL the browser can PUT a file to directly.
export async function createUploadUrl(opts: {
  key: string;
  contentType: string;
}): Promise<string> {
  if (!bucket) throw new Error("R2_BUCKET is not set");
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: opts.key,
    ContentType: opts.contentType,
  });
  return getSignedUrl(r2, command, { expiresIn: 600 });
}
