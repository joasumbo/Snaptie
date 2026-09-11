import "server-only";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const from = process.env.EMAIL_FROM ?? "noreply@example.com";

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
export async function sendMaintenanceEmail(opts: {
  to: string[];
  pagina: string;
  mural: string;
  nome: string;
  mensagem: string;
  imagem?: string | null;
  link: string;
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
    subject: `${opts.mural || "Manutenção"} — nova participação de ${opts.nome}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #18181b;">
        <p style="margin: 0 0 4px; font-size: 13px; color: #a1a1aa;">${escapar(opts.pagina)}</p>
        <h1 style="font-size: 20px; margin: 0 0 16px;">${escapar(opts.mural || "Manutenção")}</h1>
        <p style="margin: 0 0 4px; color: #52525b;"><strong>${escapar(opts.nome)}</strong> escreveu:</p>
        <div style="white-space: pre-line; background: #fafafa; border-radius: 8px; padding: 12px 14px; margin: 0 0 16px;">${escapar(opts.mensagem) || "<em style=\"color:#a1a1aa\">Sem texto, só imagem.</em>"}</div>
        ${
          opts.imagem
            ? `<p style="margin: 0 0 16px;"><a href="${opts.imagem}"><img src="${opts.imagem}" alt="" style="max-width: 100%; border-radius: 8px;" /></a></p>`
            : ""
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
