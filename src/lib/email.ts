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
