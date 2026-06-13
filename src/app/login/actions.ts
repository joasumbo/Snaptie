"use server";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

export type LoginResult = { ok: true } | { ok: false; message: string };

const GENERIC_ERROR = "Email ou palavra-passe incorretos.";

export async function login(input: {
  email: string;
  password: string;
}): Promise<LoginResult> {
  const email = input.email?.trim().toLowerCase();
  const password = input.password ?? "";

  if (!email || !password) {
    return { ok: false, message: "Preencha o email e a palavra-passe." };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Same message whether the user is missing or the password is wrong, so we
  // never reveal which emails exist.
  if (!user || !(await verifyPassword(password, user.password))) {
    return { ok: false, message: GENERIC_ERROR };
  }

  if (user.status === "INATIVO") {
    return { ok: false, message: "A sua conta está inativa." };
  }
  if (user.status === "SUSPENSO") {
    return { ok: false, message: "A sua conta está suspensa." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { ultimoLogin: new Date() },
  });

  await createSession({
    userId: user.id,
    role: user.role,
    companyId: user.companyId,
  });

  return { ok: true };
}
