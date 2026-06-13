import type { UserRole, UserStatus } from "@prisma/client";

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrador",
  GESTOR_EMPRESA: "Gestor de empresa",
  GESTOR_QR: "Gestor de QR",
  VISUALIZADOR: "Visualizador",
};

export const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as UserRole[]).map(
  (value) => ({ label: ROLE_LABELS[value], value }),
);

export const STATUS_LABELS: Record<UserStatus, string> = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  SUSPENSO: "Suspenso",
};

export const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as UserStatus[]).map(
  (value) => ({ label: STATUS_LABELS[value], value }),
);

// Maps a status to an Atlaskit Lozenge appearance.
export const STATUS_APPEARANCE: Record<
  UserStatus,
  "success" | "default" | "removed"
> = {
  ATIVO: "success",
  INATIVO: "default",
  SUSPENSO: "removed",
};
