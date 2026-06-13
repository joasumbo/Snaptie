"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type CompanyStatus, type Plano } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/dal";
import { slugify } from "@/lib/slug";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES: CompanyStatus[] = ["ATIVA", "SUSPENSA", "INATIVA"];
const PLANOS: Plano[] = ["FREE", "STARTER", "PRO", "ENTERPRISE"];

// Companies are clients of the platform, managed by Snaptie administrators.
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

async function uniqueSlug(nome: string, ignoreId?: string): Promise<string> {
  const base = slugify(nome) || "empresa";
  let slug = base;
  let n = 1;
  // Append a counter until the slug is free (ignoring the company being edited).
  while (true) {
    const existing = await prisma.company.findUnique({ where: { slug } });
    if (!existing || existing.id === ignoreId) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

type CompanyInput = {
  nome: string;
  email: string;
  telefone?: string;
  website?: string;
  logo?: string;
  corPrimaria?: string;
  corSecundaria?: string;
  plano: Plano;
};

function validate(input: CompanyInput): string | null {
  if (!input.nome?.trim()) return "O nome é obrigatório.";
  if (!input.email?.trim()) return "O email é obrigatório.";
  if (!EMAIL_RE.test(input.email.trim())) return "O email não é válido.";
  if (!PLANOS.includes(input.plano)) return "Plano inválido.";
  return null;
}

function clean(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

export async function createCompany(input: CompanyInput): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "Sem permissão." };

  const error = validate(input);
  if (error) return { ok: false, message: error };

  const slug = await uniqueSlug(input.nome);

  try {
    const company = await prisma.company.create({
      data: {
        nome: input.nome.trim(),
        slug,
        email: input.email.trim().toLowerCase(),
        telefone: clean(input.telefone),
        website: clean(input.website),
        logo: clean(input.logo),
        corPrimaria: clean(input.corPrimaria),
        corSecundaria: clean(input.corSecundaria),
        plano: input.plano,
      },
    });
    revalidatePath("/dashboard/companies");
    return { ok: true, id: company.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, message: "Já existe uma empresa com esse identificador." };
    }
    throw e;
  }
}

export async function updateCompany(
  input: CompanyInput & { id: string },
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "Sem permissão." };

  const error = validate(input);
  if (error) return { ok: false, message: error };

  const company = await prisma.company.findUnique({ where: { id: input.id } });
  if (!company || company.deletedAt) {
    return { ok: false, message: "Empresa não encontrada." };
  }

  await prisma.company.update({
    where: { id: input.id },
    data: {
      nome: input.nome.trim(),
      email: input.email.trim().toLowerCase(),
      telefone: clean(input.telefone),
      website: clean(input.website),
      logo: clean(input.logo),
      corPrimaria: clean(input.corPrimaria),
      corSecundaria: clean(input.corSecundaria),
      plano: input.plano,
    },
  });

  revalidatePath("/dashboard/companies");
  revalidatePath(`/dashboard/companies/${input.id}`);
  return { ok: true };
}

export async function setCompanyStatus(
  id: string,
  status: CompanyStatus,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "Sem permissão." };
  if (!STATUSES.includes(status)) return { ok: false, message: "Estado inválido." };

  const company = await prisma.company.findUnique({ where: { id } });
  if (!company || company.deletedAt) {
    return { ok: false, message: "Empresa não encontrada." };
  }

  await prisma.company.update({ where: { id }, data: { estado: status } });
  revalidatePath("/dashboard/companies");
  revalidatePath(`/dashboard/companies/${id}`);
  return { ok: true };
}

export async function deleteCompany(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "Sem permissão." };

  const company = await prisma.company.findUnique({ where: { id } });
  if (!company || company.deletedAt) {
    return { ok: false, message: "Empresa não encontrada." };
  }

  // Soft delete to avoid losing related data accidentally.
  await prisma.company.update({
    where: { id },
    data: { deletedAt: new Date(), estado: "INATIVA" },
  });

  revalidatePath("/dashboard/companies");
  return { ok: true };
}
