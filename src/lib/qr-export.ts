import "server-only";

import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/dal";

export const QR_MANAGER_ROLES = ["ADMIN", "GESTOR_EMPRESA", "GESTOR_QR"] as const;

/** Utilizador com permissao para gerir QRs, ou null. */
export async function requireQrManager() {
  const user = await getCurrentUser();
  if (!user || !QR_MANAGER_ROLES.includes(user.role as (typeof QR_MANAGER_ROLES)[number])) {
    return null;
  }
  return user;
}

/** URL publico de um QR: https://<host>/<empresa>/<codigo>. */
export async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function publicUrl(base: string, companySlug: string, codigo: string | null): string {
  return `${base}/${companySlug}/${codigo ?? ""}`;
}

/** Escapa um valor para CSV (aspas, virgulas, quebras de linha). */
export function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
