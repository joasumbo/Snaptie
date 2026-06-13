import type { CompanyStatus, Plano } from "@prisma/client";
import type { Tone } from "./tone";

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

export const PLANO_LABELS: Record<Plano, string> = {
  FREE: "Free",
  STARTER: "Starter",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
};

export const PLANO_OPTIONS = (Object.keys(PLANO_LABELS) as Plano[]).map(
  (value) => ({ label: PLANO_LABELS[value], value }),
);
