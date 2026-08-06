"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { registarEvento } from "@/app/[empresa]/[codigo]/wall-actions";
import { type WallMessage } from "./message-wall";

// Um bloco de registo: botões que marcam um acontecimento com a hora, e o
// histórico do que já foi marcado. Serve para acompanhar percursos — entrou no
// transporte, chegou à escola, saiu — sem obrigar ninguém a escrever nada.
//
// Guarda em qr_messages, a mesma tabela do mural: cada marca é uma mensagem
// cujo texto é o nome da ação. Evita uma tabela nova para o mesmo formato.
export function EventLog({
  blockId,
  titulo,
  descricao,
  acoes,
  mensagens,
  codigo,
  color,
}: {
  blockId: string;
  titulo: string;
  descricao: string | null;
  acoes: string[];
  mensagens: WallMessage[];
  codigo?: string;
  color: string;
}) {
  const router = useRouter();
  const [aEnviar, setAEnviar] = useState<string | null>(null);

  async function marcar(acao: string) {
    // Sem código estamos na pré-visualização do painel: mostra, não regista.
    if (!codigo || aEnviar) return;
    setAEnviar(acao);
    try {
      const r = await registarEvento({ codigo, blockId, acao });
      if (r.ok) {
        toast.success(`${acao} — registado`);
        router.refresh();
      } else {
        toast.error("Não foi possível registar.");
      }
    } finally {
      setAEnviar(null);
    }
  }

  return (
    <div className="w-full text-left">
      {titulo ? (
        <h2 className="mb-1 text-center text-base font-semibold text-zinc-900">
          {titulo}
        </h2>
      ) : null}
      {descricao ? (
        <p className="mb-3 text-center text-sm text-zinc-500">{descricao}</p>
      ) : null}

      <div className="flex flex-col gap-3">
        {acoes.map((acao) => (
          <button
            key={acao}
            type="button"
            onClick={() => marcar(acao)}
            disabled={!!aEnviar}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium text-white shadow-sm transition active:translate-y-px disabled:opacity-60"
            style={{ backgroundColor: color }}
          >
            {aEnviar === acao ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {acao}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <p className="text-sm font-semibold text-zinc-900">Histórico</p>
        {mensagens.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">Ainda sem registos.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {/* Do mais antigo para o mais recente: um percurso lê-se por ordem. */}
            {[...mensagens].reverse().map((m) => (
              <li key={m.id}>
                <p className="text-sm text-zinc-500">
                  {new Date(m.createdAt).toLocaleString("pt-PT", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="text-sm text-zinc-900">{m.mensagem}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
