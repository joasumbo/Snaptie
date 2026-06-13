"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Textfield from "@atlaskit/textfield";
import Button from "@atlaskit/button/new";
import Lozenge from "@atlaskit/lozenge";
import type { UserRole } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { updateName, changePassword } from "@/app/dashboard/profile/actions";

type Props = {
  user: {
    nome: string;
    email: string;
    role: UserRole;
    createdAt: string;
  };
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--ds-text-subtle)",
  marginBottom: 4,
};

function Feedback({ state }: { state: { ok: boolean; message: string } | null }) {
  if (!state) return null;
  return (
    <div
      role="status"
      style={{
        marginBottom: 16,
        padding: 12,
        borderRadius: 4,
        fontSize: 14,
        backgroundColor: state.ok
          ? "var(--ds-background-success)"
          : "var(--ds-background-danger)",
        color: state.ok ? "var(--ds-text-success)" : "var(--ds-text-danger)",
      }}
    >
      {state.message}
    </div>
  );
}

export default function ProfileView({ user }: Props) {
  const router = useRouter();

  const [nome, setNome] = useState(user.nome);
  const [savingName, setSavingName] = useState(false);
  const [nameState, setNameState] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdState, setPwdState] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  async function handleSaveName() {
    setNameState(null);
    setSavingName(true);
    const result = await updateName(nome);
    setSavingName(false);
    setNameState(
      result.ok
        ? { ok: true, message: "Nome atualizado." }
        : { ok: false, message: result.message },
    );
    if (result.ok) router.refresh();
  }

  async function handleChangePassword() {
    setPwdState(null);
    setSavingPwd(true);
    const result = await changePassword({ current, next, confirm });
    setSavingPwd(false);
    if (result.ok) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setPwdState({ ok: true, message: "Palavra-passe alterada." });
    } else {
      setPwdState({ ok: false, message: result.message });
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 16,
        alignItems: "start",
      }}
    >
      <Card>
        <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>
          Dados da conta
        </h2>
        <Feedback state={nameState} />

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="profile-nome" style={labelStyle}>
            Nome
          </label>
          <Textfield
            id="profile-nome"
            value={nome}
            onChange={(e) => setNome(e.currentTarget.value)}
          />
        </div>

        <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
          <div>
            <span style={labelStyle}>Email</span>
            <div>{user.email}</div>
          </div>
          <div>
            <span style={labelStyle}>Função</span>
            <div>
              <Lozenge>{ROLE_LABELS[user.role]}</Lozenge>
            </div>
          </div>
          <div>
            <span style={labelStyle}>Criado em</span>
            <div>{formatDate(user.createdAt)}</div>
          </div>
        </div>

        <Button
          appearance="primary"
          onClick={handleSaveName}
          isLoading={savingName}
          isDisabled={nome.trim() === user.nome}
        >
          Guardar
        </Button>
      </Card>

      <Card>
        <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>
          Alterar palavra-passe
        </h2>
        <Feedback state={pwdState} />

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="pwd-current" style={labelStyle}>
            Palavra-passe atual
          </label>
          <Textfield
            id="pwd-current"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.currentTarget.value)}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="pwd-next" style={labelStyle}>
            Nova palavra-passe
          </label>
          <Textfield
            id="pwd-next"
            type="password"
            value={next}
            onChange={(e) => setNext(e.currentTarget.value)}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="pwd-confirm" style={labelStyle}>
            Confirmar nova palavra-passe
          </label>
          <Textfield
            id="pwd-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.currentTarget.value)}
          />
        </div>

        <Button
          appearance="primary"
          onClick={handleChangePassword}
          isLoading={savingPwd}
          isDisabled={!current || !next || !confirm}
        >
          Alterar palavra-passe
        </Button>
      </Card>
    </div>
  );
}
