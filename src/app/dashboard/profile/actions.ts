"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/dal";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export type ActionResult = { ok: true } | { ok: false; message: string };

export async function updateName(nome: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sessão expirada." };
  if (!nome?.trim()) return { ok: false, message: "O nome é obrigatório." };

  await prisma.user.update({
    where: { id: user.id },
    data: { nome: nome.trim() },
  });

  revalidatePath("/dashboard/profile");
  return { ok: true };
}

export async function changePassword(input: {
  current: string;
  next: string;
  confirm: string;
}): Promise<ActionResult> {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return { ok: false, message: "Sessão expirada." };

  if (!input.current || !input.next) {
    return { ok: false, message: "Preencha todos os campos." };
  }
  if (input.next.length < 6) {
    return {
      ok: false,
      message: "A nova palavra-passe deve ter pelo menos 6 caracteres.",
    };
  }
  if (input.next !== input.confirm) {
    return { ok: false, message: "A confirmação não coincide." };
  }

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) return { ok: false, message: "Utilizador não encontrado." };

  if (!(await verifyPassword(input.current, user.password))) {
    return { ok: false, message: "A palavra-passe atual está incorreta." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await hashPassword(input.next) },
  });

  return { ok: true };
}
