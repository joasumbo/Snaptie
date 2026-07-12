"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import {
  accessCookieName,
  signAccess,
  ACCESS_MAX_AGE_SECONDS,
} from "@/lib/auth/qr-access";
import { accessNeedsPin } from "@/lib/qr";

export type UnlockResult = { ok: true } | { ok: false; message: string };

// Opens a QR that is not public: either the private mode, which asks for the
// PIN on every visit, or the activation mode, where the first visitor holding
// the PIN activates the QR and it stays open from then on.
export async function unlockQr(
  codigo: string,
  pin: string,
): Promise<UnlockResult> {
  const qr = await prisma.qrCode.findFirst({
    where: { codigo, publicado: true },
    select: { id: true, acessoModo: true, acessoPin: true, ativadoEm: true },
  });
  if (!qr || !accessNeedsPin(qr.acessoModo) || !qr.acessoPin) {
    return { ok: false, message: "Código inválido." };
  }

  const ok = await verifyPassword(pin ?? "", qr.acessoPin);
  if (!ok) return { ok: false, message: "Código inválido." };

  if (qr.acessoModo === "ativacao" && !qr.ativadoEm) {
    await prisma.qrCode.update({
      where: { id: qr.id },
      data: { ativadoEm: new Date() },
    });
  }

  // Remember this visitor so the private mode does not ask again on every visit.
  const store = await cookies();
  store.set(accessCookieName(qr.id), await signAccess(qr.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE_SECONDS,
  });

  return { ok: true };
}
