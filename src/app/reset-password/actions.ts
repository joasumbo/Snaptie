"use server";

import { prisma } from "@/lib/prisma";
import { readUserId, verifyResetToken } from "@/lib/auth/reset";
import { hashPassword } from "@/lib/auth/password";

export type ResetResult = { ok: true } | { ok: false; message: string };

export async function resetPassword(input: {
  token: string;
  password: string;
}): Promise<ResetResult> {
  if (!input.password || input.password.length < 6) {
    return { ok: false, message: "A palavra-passe deve ter pelo menos 6 caracteres." };
  }
  const userId = readUserId(input.token);
  if (!userId) return { ok: false, message: "Ligação inválida." };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, message: "Ligação inválida." };

  const valid = await verifyResetToken(input.token, user.password);
  if (!valid) {
    return { ok: false, message: "Ligação inválida ou expirada." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await hashPassword(input.password) },
  });

  return { ok: true };
}
