"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { desligarMoloni, escolherEmpresa, ligarMoloni, type EmpresaMoloni } from "@/lib/moloni";

type Erro = { ok: false; message: string };

async function soAdmin() {
  return (await getCurrentUser())?.role === "ADMIN";
}

export async function ligarContaMoloni(
  utilizador: string,
  palavraPasse: string,
): Promise<{ ok: true; empresas: EmpresaMoloni[] } | Erro> {
  if (!(await soAdmin())) return { ok: false, message: "Sem permissão." };
  if (!utilizador.trim() || !palavraPasse) return { ok: false, message: "Indique o utilizador e a palavra-passe da Moloni." };
  try {
    const empresas = await ligarMoloni(utilizador.trim(), palavraPasse);
    revalidatePath("/dashboard/pagamentos");
    return { ok: true, empresas };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function escolherEmpresaMoloni(id: number, nome: string): Promise<{ ok: true } | Erro> {
  if (!(await soAdmin())) return { ok: false, message: "Sem permissão." };
  await escolherEmpresa(id, nome);
  revalidatePath("/dashboard/pagamentos");
  return { ok: true };
}

export async function desligarContaMoloni(): Promise<{ ok: true } | Erro> {
  if (!(await soAdmin())) return { ok: false, message: "Sem permissão." };
  await desligarMoloni();
  revalidatePath("/dashboard/pagamentos");
  return { ok: true };
}
