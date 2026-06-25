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
