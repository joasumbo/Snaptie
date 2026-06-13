"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type UserRole, type UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, USER_MANAGEMENT_ROLES } from "@/lib/auth/dal";
import { hashPassword } from "@/lib/auth/password";

export type ActionResult = { ok: true } | { ok: false; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES: UserRole[] = ["ADMIN", "GESTOR_EMPRESA", "GESTOR_QR", "VISUALIZADOR"];
const STATUSES: UserStatus[] = ["ATIVO", "INATIVO", "SUSPENSO"];

async function requireManager() {
  const user = await getCurrentUser();
  if (!user || !USER_MANAGEMENT_ROLES.includes(user.role)) {
    return null;
  }
  return user;
}

// A manager may only assign roles up to their own level: a company manager
// cannot create or promote platform administrators.
function canAssignRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === "ADMIN") return true;
  return targetRole !== "ADMIN";
}

function validateBasics(input: {
  nome: string;
  email: string;
  role: UserRole;
}): string | null {
  if (!input.nome?.trim()) return "O nome é obrigatório.";
  if (!input.email?.trim()) return "O email é obrigatório.";
  if (!EMAIL_RE.test(input.email.trim())) return "O email não é válido.";
  if (!ROLES.includes(input.role)) return "Função inválida.";
  return null;
}

export async function createUser(input: {
  nome: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<ActionResult> {
  const actor = await requireManager();
  if (!actor) return { ok: false, message: "Sem permissão." };

  const error = validateBasics(input);
  if (error) return { ok: false, message: error };
  if (!input.password || input.password.length < 6) {
    return { ok: false, message: "A palavra-passe deve ter pelo menos 6 caracteres." };
  }
  if (!canAssignRole(actor.role, input.role)) {
    return { ok: false, message: "Não pode atribuir essa função." };
  }

  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, message: "Já existe um utilizador com esse email." };

  try {
    await prisma.user.create({
      data: {
        nome: input.nome.trim(),
        email,
        password: await hashPassword(input.password),
        role: input.role,
        // New users belong to the manager's company (null for platform admins).
        companyId: actor.companyId,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, message: "Já existe um utilizador com esse email." };
    }
    throw e;
  }

  revalidatePath("/dashboard/users");
  return { ok: true };
}

export async function updateUser(input: {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}): Promise<ActionResult> {
  const actor = await requireManager();
  if (!actor) return { ok: false, message: "Sem permissão." };

  const error = validateBasics(input);
  if (error) return { ok: false, message: error };
  if (!STATUSES.includes(input.status)) return { ok: false, message: "Estado inválido." };

  const target = await prisma.user.findUnique({ where: { id: input.id } });
  if (!target) return { ok: false, message: "Utilizador não encontrado." };

  // Company managers cannot touch users from other companies or administrators.
  if (actor.role !== "ADMIN") {
    if (target.companyId !== actor.companyId || target.role === "ADMIN") {
      return { ok: false, message: "Sem permissão sobre este utilizador." };
    }
  }
  if (!canAssignRole(actor.role, input.role)) {
    return { ok: false, message: "Não pode atribuir essa função." };
  }
  // Prevent locking yourself out.
  if (target.id === actor.id && input.status !== "ATIVO") {
    return { ok: false, message: "Não pode desativar a sua própria conta." };
  }

  const email = input.email.trim().toLowerCase();
  if (email !== target.email) {
    const clash = await prisma.user.findUnique({ where: { email } });
    if (clash) return { ok: false, message: "Já existe um utilizador com esse email." };
  }

  await prisma.user.update({
    where: { id: target.id },
    data: {
      nome: input.nome.trim(),
      email,
      role: input.role,
      status: input.status,
    },
  });

  revalidatePath("/dashboard/users");
  return { ok: true };
}

export async function setUserStatus(
  id: string,
  status: UserStatus,
): Promise<ActionResult> {
  const actor = await requireManager();
  if (!actor) return { ok: false, message: "Sem permissão." };
  if (!STATUSES.includes(status)) return { ok: false, message: "Estado inválido." };

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { ok: false, message: "Utilizador não encontrado." };
  if (actor.role !== "ADMIN") {
    if (target.companyId !== actor.companyId || target.role === "ADMIN") {
      return { ok: false, message: "Sem permissão sobre este utilizador." };
    }
  }
  if (target.id === actor.id && status !== "ATIVO") {
    return { ok: false, message: "Não pode desativar a sua própria conta." };
  }

  await prisma.user.update({ where: { id }, data: { status } });
  revalidatePath("/dashboard/users");
  return { ok: true };
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const actor = await requireManager();
  if (!actor) return { ok: false, message: "Sem permissão." };

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { ok: false, message: "Utilizador não encontrado." };
  if (target.id === actor.id) {
    return { ok: false, message: "Não pode eliminar a sua própria conta." };
  }
  if (actor.role !== "ADMIN") {
    if (target.companyId !== actor.companyId || target.role === "ADMIN") {
      return { ok: false, message: "Sem permissão sobre este utilizador." };
    }
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath("/dashboard/users");
  return { ok: true };
}
