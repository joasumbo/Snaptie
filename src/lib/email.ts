import "server-only";

import { Resend } from "resend";

// Criado só no primeiro envio: no build não há chave, e um cliente criado ao
// carregar o ficheiro fazia falhar o build de qualquer rota que o importe.
let cliente: Resend | null = null;
// O Resend não lança erro quando um envio falha: devolve-o na resposta. Sem
// esta verificação, um email recusado passava por enviado (e o lembrete ficava
// marcado como entregue sem ter saído).
const resend = {
  emails: {
    send: async (...args: Parameters<Resend["emails"]["send"]>) => {
      cliente ??= new Resend(process.env.RESEND_API_KEY);
      const r = await cliente.emails.send(...args);
      if (r.error) throw new Error(`Resend: ${r.error.message}`);
      return r;
    },
  },
};
// O nome visível conta para os filtros e para quem lê: "Snaptie" numa caixa de
// entrada diz mais do que um endereço solto.
const endereco = process.env.EMAIL_FROM ?? "noreply@example.com";
const from = endereco.includes("<") ? endereco : `Snaptie <${endereco}>`;

export async function sendPasswordResetEmail(to: string, link: string) {
  await resend.emails.send({
    from,
    to,
    subject: "Recuperação de palavra-passe — Snaptie",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #18181b;">
        <h1 style="font-size: 20px; margin: 0 0 12px;">Recuperação de palavra-passe</h1>
        <p style="margin: 0 0 16px; color: #52525b;">
          Recebemos um pedido para repor a palavra-passe da sua conta Snaptie.
          Clique no botão abaixo para definir uma nova. Este link expira em 1 hora.
        </p>
        <p style="margin: 0 0 24px;">
          <a href="${link}" style="display: inline-block; background: #6366f1; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-weight: 500;">
            Definir nova palavra-passe
          </a>
        </p>
        <p style="margin: 0; font-size: 13px; color: #a1a1aa;">
          Se não foi você a pedir, pode ignorar este email.
        </p>
      </div>
    `,
  });
}

// Aviso de uma nova participação num mural de manutenção. O envio nunca pode
// derrubar a gravação da mensagem, por isso quem chama isto trata o erro: aqui
// só se monta e se manda.
// O assunto leva o sítio e o que aconteceu, não a palavra "participação". Quem
// recebe isto tem a caixa cheia; o que decide se abre é reconhecer o local e ler
// o problema sem ter de entrar.
function assuntoManutencao(opts: {
  pagina: string;
  mural: string;
  nome: string;
  mensagem: string;
  urgente?: boolean;
}): string {
  const base = [opts.pagina, opts.mural || "Manutenção"].filter(Boolean).join(" · ");
  const local = opts.urgente ? `URGENTE · ${base}` : base;
  const texto = opts.mensagem.trim().replace(/\s+/g, " ");
  if (!texto) return `${local}: nova ocorrência de ${opts.nome}`;
  const resumo = texto.length > 70 ? `${texto.slice(0, 69)}…` : texto;
  return `${local}: ${resumo}`;
}

export async function sendMaintenanceEmail(opts: {
  to: string[];
  pagina: string;
  mural: string;
  nome: string;
  mensagem: string;
  imagens?: string[];
  urgente?: boolean;
  link: string;
  // Endereço da empresa, para quem recebe poder responder a alguém em vez de
  // a um vazio. Um reply-to válido também pesa nos filtros de spam.
  replyTo?: string | null;
}) {
  const escapar = (t: string) =>
    t
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  await resend.emails.send({
    from,
    to: opts.to,
    subject: assuntoManutencao(opts),
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    // Um email só com HTML pontua pior nos filtros, e há quem leia em texto.
    text: [
      ...(opts.urgente ? ["URGENTE", ""] : []),
      `${opts.pagina} — ${opts.mural || "Manutenção"}`,
      "",
      `${opts.nome} escreveu:`,
      opts.mensagem || "(sem texto, só imagem)",
      ...(opts.imagens?.length ? ["", ...opts.imagens.map((i) => `Imagem: ${i}`)] : []),
      "",
      `Abrir a página: ${opts.link}`,
    ].join("\n"),
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #18181b;">
        <p style="margin: 0 0 4px; font-size: 13px; color: #a1a1aa;">${escapar(opts.pagina)}</p>
        ${
          opts.urgente
            ? `<p style="display: inline-block; margin: 0 0 8px; padding: 2px 10px; border-radius: 999px; background: #fecaca; color: #7f1d1d; font-size: 12px; font-weight: 600;">Urgente</p>`
            : ""
        }
        <h1 style="font-size: 20px; margin: 0 0 16px;">${escapar(opts.mural || "Manutenção")}</h1>
        <p style="margin: 0 0 4px; color: #52525b;"><strong>${escapar(opts.nome)}</strong> escreveu:</p>
        <div style="white-space: pre-line; background: #fafafa; border-radius: 8px; padding: 12px 14px; margin: 0 0 16px;">${escapar(opts.mensagem) || "<em style=\"color:#a1a1aa\">Sem texto, só imagem.</em>"}</div>
        ${
          (opts.imagens ?? [])
            .map(
              (i) =>
                `<p style="margin: 0 0 16px;"><a href="${i}"><img src="${i}" alt="" style="max-width: 100%; border-radius: 8px;" /></a></p>`,
            )
            .join("")
        }
        <p style="margin: 0 0 24px;">
          <a href="${opts.link}" style="display: inline-block; background: #6366f1; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-weight: 500;">
            Abrir a página
          </a>
        </p>
        <p style="margin: 0; font-size: 13px; color: #a1a1aa;">
          Recebe este aviso porque este endereço está configurado no mural de manutenção.
        </p>
      </div>
    `,
  });
}

function escaparHtml(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Uma opinião deixada em privado. Não aparece na página: este email é a única
// forma de o dono a ler fora do painel.
export async function sendOpiniaoEmail(opts: {
  to: string[];
  pagina: string;
  titulo: string;
  nome: string;
  mensagem: string;
  estrelas: number | null;
  link: string;
  replyTo?: string | null;
}) {
  const quem = opts.nome || "Um visitante";
  const estrelas = opts.estrelas ? `${"★".repeat(opts.estrelas)}${"☆".repeat(5 - opts.estrelas)}` : "";
  const resumo = opts.mensagem.replace(/\s+/g, " ").trim();
  await resend.emails.send({
    from,
    to: opts.to,
    subject: `${opts.pagina}: nova opinião${opts.estrelas ? ` (${opts.estrelas}/5)` : ""}${
      resumo ? ` · ${resumo.length > 60 ? `${resumo.slice(0, 59)}…` : resumo}` : ""
    }`,
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    text: [
      `${opts.pagina} — ${opts.titulo || "Opinião"}`,
      "",
      ...(estrelas ? [`Classificação: ${estrelas} (${opts.estrelas}/5)`, ""] : []),
      `${quem} escreveu:`,
      opts.mensagem,
      "",
      `Página: ${opts.link}`,
    ].join("\n"),
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #18181b;">
        <p style="margin: 0 0 4px; font-size: 13px; color: #a1a1aa;">${escaparHtml(opts.pagina)}</p>
        <h1 style="font-size: 20px; margin: 0 0 16px;">${escaparHtml(opts.titulo || "Nova opinião")}</h1>
        ${estrelas ? `<p style="margin: 0 0 12px; font-size: 22px; color: #f59e0b; letter-spacing: 2px;">${estrelas}</p>` : ""}
        <p style="margin: 0 0 4px; color: #52525b;"><strong>${escaparHtml(quem)}</strong> escreveu:</p>
        <div style="white-space: pre-line; background: #fafafa; border-radius: 8px; padding: 12px 14px; margin: 0 0 16px;">${escaparHtml(opts.mensagem)}</div>
        <p style="margin: 0; font-size: 13px; color: #a1a1aa;">Esta opinião foi deixada em privado e não aparece na página.</p>
      </div>
    `,
  });
}

// O lembrete que o dono marcou para si. Vai na data, no dia do mês ou no dia
// da semana que escolheu.
export async function sendLembreteEmail(opts: {
  to: string[];
  pagina: string;
  titulo: string;
  mensagem: string;
  quando: string;
  link: string;
}) {
  const titulo = opts.titulo || "Lembrete";
  await resend.emails.send({
    from,
    to: opts.to,
    subject: `Lembrete: ${titulo} · ${opts.pagina}`,
    text: [
      `${opts.pagina} — ${titulo}`,
      "",
      opts.mensagem || "(sem texto)",
      "",
      `Lembrete marcado ${opts.quando}.`,
      `Página: ${opts.link}`,
    ].join("\n"),
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #18181b;">
        <p style="margin: 0 0 4px; font-size: 13px; color: #a1a1aa;">${escaparHtml(opts.pagina)}</p>
        <h1 style="font-size: 20px; margin: 0 0 16px;">${escaparHtml(titulo)}</h1>
        ${opts.mensagem ? `<div style="white-space: pre-line; background: #fafafa; border-radius: 8px; padding: 12px 14px; margin: 0 0 16px;">${escaparHtml(opts.mensagem)}</div>` : ""}
        <p style="margin: 0 0 24px;">
          <a href="${opts.link}" style="display: inline-block; background: #6366f1; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-weight: 500;">Abrir a página</a>
        </p>
        <p style="margin: 0; font-size: 13px; color: #a1a1aa;">Lembrete marcado ${escaparHtml(opts.quando)}.</p>
      </div>
    `,
  });
}
