"use client";

import { useState } from "react";
import Modal, {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
} from "@atlaskit/modal-dialog";
import Textfield from "@atlaskit/textfield";
import Select from "@atlaskit/select";
import Button from "@atlaskit/button/new";
import type { UserRole, UserStatus } from "@prisma/client";
import { ROLE_OPTIONS, STATUS_OPTIONS } from "@/lib/roles";
import { createUser, updateUser } from "@/app/dashboard/users/actions";

type Option<T extends string> = { label: string; value: T };

export type EditableUser = {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};

type Props = {
  mode: "create" | "edit";
  user?: EditableUser;
  actorRole: UserRole;
  onClose: () => void;
  onSaved: () => void;
};

function Labeled({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        htmlFor={htmlFor}
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--ds-text-subtle)",
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function UserFormModal({ mode, user, actorRole, onClose, onSaved }: Props) {
  const [nome, setNome] = useState(user?.nome ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(user?.role ?? "VISUALIZADOR");
  const [status, setStatus] = useState<UserStatus>(user?.status ?? "ATIVO");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleOptions = ROLE_OPTIONS.filter(
    (o) => actorRole === "ADMIN" || o.value !== "ADMIN",
  ) as Option<UserRole>[];
  const statusOptions = STATUS_OPTIONS as Option<UserStatus>[];

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    const result =
      mode === "create"
        ? await createUser({ nome, email, password, role })
        : await updateUser({ id: user!.id, nome, email, role, status });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved();
  }

  return (
    <ModalTransition>
      <Modal onClose={submitting ? () => {} : onClose}>
        <ModalHeader>
          <ModalTitle>
            {mode === "create" ? "Novo utilizador" : "Editar utilizador"}
          </ModalTitle>
        </ModalHeader>
        <ModalBody>
          {error ? (
            <div
              role="alert"
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 4,
                backgroundColor: "var(--ds-background-danger)",
                color: "var(--ds-text-danger)",
                fontSize: 14,
              }}
            >
              {error}
            </div>
          ) : null}

          <Labeled label="Nome" htmlFor="nome">
            <Textfield
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.currentTarget.value)}
            />
          </Labeled>

          <Labeled label="Email" htmlFor="email">
            <Textfield
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />
          </Labeled>

          {mode === "create" ? (
            <Labeled label="Palavra-passe" htmlFor="password">
              <Textfield
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
              />
            </Labeled>
          ) : null}

          <Labeled label="Função" htmlFor="role">
            <Select<Option<UserRole>>
              inputId="role"
              options={roleOptions}
              value={roleOptions.find((o) => o.value === role) ?? null}
              onChange={(opt) => opt && setRole(opt.value)}
            />
          </Labeled>

          {mode === "edit" ? (
            <Labeled label="Estado" htmlFor="status">
              <Select<Option<UserStatus>>
                inputId="status"
                options={statusOptions}
                value={statusOptions.find((o) => o.value === status) ?? null}
                onChange={(opt) => opt && setStatus(opt.value)}
              />
            </Labeled>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button appearance="subtle" onClick={onClose} isDisabled={submitting}>
            Cancelar
          </Button>
          <Button appearance="primary" onClick={handleSubmit} isLoading={submitting}>
            {mode === "create" ? "Criar" : "Guardar"}
          </Button>
        </ModalFooter>
      </Modal>
    </ModalTransition>
  );
}
