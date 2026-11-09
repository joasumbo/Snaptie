import type { CompanyStatus, Plano } from "@prisma/client";
import type { Tone } from "./tone";
import { ORDEM_PLANOS, PLANOS } from "./planos";

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  ATIVA: "Ativa",
  SUSPENSA: "Suspensa",
  INATIVA: "Inativa",
};

export const COMPANY_STATUS_TONE: Record<CompanyStatus, Tone> = {
  ATIVA: "success",
  SUSPENSA: "warning",
  INATIVA: "neutral",
};

// Os nomes comerciais vêm da definição dos planos (ver lib/planos.ts).
export const PLANO_LABELS = Object.fromEntries(
  ORDEM_PLANOS.map((p) => [p, PLANOS[p].nome]),
) as Record<Plano, string>;

export const PLANO_OPTIONS = ORDEM_PLANOS.map(
  (value) => ({ label: PLANOS[value].nome, value }),
);
