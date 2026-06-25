"use server";

import { prisma } from "@/lib/prisma";
import { createResetToken } from "@/lib/auth/reset";
import { sendPasswordResetEmail } from "@/lib/email";

export async function requestReset(email: string): Promise<{ ok: true }> {
  const e = email?.trim().toLowerCase();
  if (e) {
    const user = await prisma.user.findUnique({ where: { email: e } });
    if (user && user.status === "ATIVO") {
      const token = await createResetToken(user.id, user.password);
      const base = process.env.APP_URL ?? "http://localhost:3000";
      const link = `${base}/reset-password?token=${token}`;
      try {
        await sendPasswordResetEmail(user.email, link);
      } catch {
        // Never reveal delivery problems to the caller.
      }
    }
  }
  // Always succeed so we never disclose which emails exist.
  return { ok: true };
}
