import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "./session";

// Shape exposed to the app — never includes the password hash.
export const safeUserSelect = {
  id: true,
  nome: true,
  email: true,
  role: true,
  status: true,
  companyId: true,
  ultimoLogin: true,
  createdAt: true,
} as const;

// Resolved once per request thanks to React's cache().
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: safeUserSelect,
  });

  // The account may have been deleted or blocked since the token was issued.
  if (!user || user.status !== "ATIVO") return null;

  return user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(roles: UserRole[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}

// Roles allowed to manage other users in this phase.
export const USER_MANAGEMENT_ROLES: UserRole[] = ["ADMIN", "GESTOR_EMPRESA"];
