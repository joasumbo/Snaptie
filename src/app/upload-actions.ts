"use server";

import { getCurrentUser } from "@/lib/auth/dal";
import {
  prepareUpload,
  createUploadUrl,
  publicUrlFor,
  type UploadKind,
} from "@/lib/storage";

export type { UploadKind };

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

  const prepared = prepareUpload(input.kind, input.contentType, input.size);
  if (!prepared.ok) return prepared;

  const uploadUrl = await createUploadUrl({
    key: prepared.key,
    contentType: input.contentType,
  });
  return { ok: true, uploadUrl, publicUrl: publicUrlFor(prepared.key) };
}
