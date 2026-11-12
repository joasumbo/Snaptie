"use server";

import { getCurrentUser } from "@/lib/auth/dal";
import { registarFicheiro, verificarEspaco } from "@/lib/armazenamento";
import {
  prepareUpload,
  createUploadUrl,
  publicUrlFor,
  type UploadKind,
  type UploadTicket,
} from "@/lib/storage";

export async function requestUpload(input: {
  kind: UploadKind;
  contentType: string;
  size: number;
}): Promise<UploadTicket> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sem permissão." };

  const prepared = prepareUpload(input.kind, input.contentType, input.size);
  if (!prepared.ok) return prepared;

  // O espaço conta para a empresa de quem envia; o administrador não tem
  // empresa e não conta.
  const companyId = user.role === "ADMIN" ? null : user.companyId;
  if (companyId) {
    const cheio = await verificarEspaco(companyId, input.size);
    if (cheio) return { ok: false, message: cheio };
    await registarFicheiro(companyId, prepared.key, input.size);
  }

  const uploadUrl = await createUploadUrl({
    key: prepared.key,
    contentType: input.contentType,
  });
  return { ok: true, uploadUrl, publicUrl: publicUrlFor(prepared.key) };
}
