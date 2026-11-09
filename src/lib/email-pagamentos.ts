import "server-only";

import { enviarEmail } from "@/lib/email";

// Os emails dos pagamentos. Saem todos do Snaptie, nunca do Stripe: o Stripe
// não tem o email de ninguém, por isso não consegue mandar nada.
//
// O formato é o de uma carta curta: barra com o nome, saudação, o que
// aconteceu numa frase, a referência à vista e, quando há alguma coisa a
// fazer, um botão. Sem enfeites.

function esc(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type Bloco = { rotulo: string; valor: string };

function carta(opts: {
  saudacao: string;
  paragrafos: string[];
  detalhes?: Bloco[];
  botao?: { texto: string; url: string };
  nota?: string;
}): string {
  const detalhes = opts.detalhes?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:4px 0 20px;border-collapse:collapse;">
        ${opts.detalhes
          .map(
            (d) => `<tr>
              <td style="padding:7px 0;border-bottom:1px solid #ececf0;color:#71717a;font-size:14px;width:42%;">${esc(d.rotulo)}</td>
              <td style="padding:7px 0;border-bottom:1px solid #ececf0;color:#18181b;font-size:14px;font-weight:600;">${esc(d.valor)}</td>
            </tr>`,
          )
          .join("")}
      </table>`
    : "";
  const botao = opts.botao
    ? `<p style="margin:4px 0 22px;"><a href="${opts.botao.url}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:600;font-size:14px;">${esc(opts.botao.texto)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#f4f4f5;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;margin:0 auto;background:#ffffff;border:1px solid #d4d4d8;font-family:Georgia,'Times New Roman',serif;">
    <tr><td style="background:#1e1b4b;color:#ffffff;text-align:center;padding:12px 16px;font-family:system-ui,-apple-system,sans-serif;font-size:17px;font-weight:600;letter-spacing:.2px;">Snaptie</td></tr>
    <tr><td style="padding:26px 24px 8px;color:#18181b;font-size:15px;line-height:1.6;">
      <p style="margin:0 0 16px;">${esc(opts.saudacao)}</p>
      ${opts.paragrafos.map((p) => `<p style="margin:0 0 16px;">${p}</p>`).join("")}
      ${detalhes}
      ${botao}
    </td></tr>
    <tr><td style="padding:14px 24px 20px;border-top:1px solid #ececf0;color:#a1a1aa;font-family:system-ui,-apple-system,sans-serif;font-size:12px;line-height:1.5;">
      ${opts.nota ? `${esc(opts.nota)}<br>` : ""}Snaptie · mysnaptie.com
    </td></tr>
  </table></body></html>`;
}

function texto(opts: { saudacao: string; linhas: string[] }): string {
  return [opts.saudacao, "", ...opts.linhas, "", "Snaptie · mysnaptie.com"].join("\n");
}

function saudacao(nome: string | null): string {
  return nome ? `Prezado(a) ${nome},` : "Olá,";
}

export async function emailPagamentoRecebido(opts: {
  para: string;
  copia?: string | null;
  nome: string | null;
  descricao: string;
  valor: string;
  numero: string;
  data: string;
  pdf: Buffer;
}) {
  const ola = saudacao(opts.nome);
  await enviarEmail({
    to: opts.para,
    ...(opts.copia ? { bcc: opts.copia } : {}),
    subject: `Pagamento recebido · ${opts.descricao} · ${opts.numero}`,
    html: carta({
      saudacao: ola,
      paragrafos: [
        `Confirmamos que o seu pagamento de <strong>${esc(opts.valor)}</strong> referente a <strong>${esc(opts.descricao)}</strong> foi recebido com sucesso.`,
        "Segue em anexo o comprovativo de pagamento, que pode guardar para os seus registos.",
      ],
      detalhes: [
        { rotulo: "Comprovativo", valor: opts.numero },
        { rotulo: "Data", valor: opts.data },
        { rotulo: "Valor pago", valor: opts.valor },
      ],
      nota: "Recebe este email porque fez um pagamento no Snaptie.",
    }),
    text: texto({
      saudacao: ola,
      linhas: [
        `Confirmamos que o seu pagamento de ${opts.valor} referente a ${opts.descricao} foi recebido com sucesso.`,
        `Comprovativo: ${opts.numero}`,
        `Data: ${opts.data}`,
        "O comprovativo segue em anexo.",
      ],
    }),
    attachments: [{ filename: `comprovativo-${opts.numero}.pdf`, content: opts.pdf }],
  });
}

export async function emailPagamentoFalhou(opts: {
  para: string;
  nome: string | null;
  descricao: string;
  valor: string;
  motivo: string | null;
  link: string;
}) {
  const ola = saudacao(opts.nome);
  await enviarEmail({
    to: opts.para,
    subject: `Pagamento não concluído · ${opts.descricao}`,
    html: carta({
      saudacao: ola,
      paragrafos: [
        `Não foi possível concluir o seu pagamento de <strong>${esc(opts.valor)}</strong> referente a <strong>${esc(opts.descricao)}</strong>. Não foi cobrado nenhum valor.`,
        opts.motivo ? `Motivo indicado pelo banco: ${esc(opts.motivo)}` : "",
        "Pode tentar de novo no mesmo endereço, com o mesmo ou outro cartão.",
      ].filter(Boolean),
      botao: { texto: "Tentar de novo", url: opts.link },
      nota: "Se já tentou de novo e o pagamento passou, pode ignorar este email.",
    }),
    text: texto({
      saudacao: ola,
      linhas: [
        `Não foi possível concluir o seu pagamento de ${opts.valor} referente a ${opts.descricao}. Não foi cobrado nenhum valor.`,
        ...(opts.motivo ? [`Motivo indicado pelo banco: ${opts.motivo}`] : []),
        `Tentar de novo: ${opts.link}`,
      ],
    }),
  });
}

export async function emailRenovacaoProxima(opts: {
  para: string;
  nome: string;
  pacote: string;
  valor: string;
  data: string;
  link: string;
}) {
  const ola = saudacao(opts.nome);
  await enviarEmail({
    to: opts.para,
    subject: `A sua subscrição Snaptie renova a ${opts.data}`,
    html: carta({
      saudacao: ola,
      paragrafos: [
        `A subscrição <strong>${esc(opts.pacote)}</strong> renova a <strong>${esc(opts.data)}</strong>. Nesse dia será cobrado o valor de <strong>${esc(opts.valor)}</strong> no cartão guardado.`,
        "Não precisa de fazer nada. Se quiser trocar o cartão ou cancelar, pode fazê-lo no painel, em O meu plano.",
      ],
      botao: { texto: "Abrir O meu plano", url: opts.link },
    }),
    text: texto({
      saudacao: ola,
      linhas: [
        `A subscrição ${opts.pacote} renova a ${opts.data}. Nesse dia será cobrado ${opts.valor} no cartão guardado.`,
        `Para trocar o cartão ou cancelar: ${opts.link}`,
      ],
    }),
  });
}

export async function emailRenovacaoFalhou(opts: {
  para: string;
  copia?: string | null;
  nome: string;
  pacote: string;
  valor: string;
  limite: string;
  link: string;
}) {
  const ola = saudacao(opts.nome);
  await enviarEmail({
    to: opts.para,
    ...(opts.copia ? { bcc: opts.copia } : {}),
    subject: `Pagamento em falta · Subscrição ${opts.pacote}`,
    html: carta({
      saudacao: ola,
      paragrafos: [
        `Não conseguimos cobrar a renovação da subscrição <strong>${esc(opts.pacote)}</strong>, no valor de <strong>${esc(opts.valor)}</strong>.`,
        `Para manter as páginas e os QR codes da empresa ativos, regularize o pagamento até <strong>${esc(opts.limite)}</strong>. Depois dessa data o serviço fica suspenso até o pagamento ser feito.`,
      ],
      botao: { texto: "Pagar agora", url: opts.link },
      nota: "Se já regularizou o pagamento, pode ignorar este email.",
    }),
    text: texto({
      saudacao: ola,
      linhas: [
        `Não conseguimos cobrar a renovação da subscrição ${opts.pacote} (${opts.valor}).`,
        `Regularize até ${opts.limite} para o serviço não ser suspenso.`,
        `Pagar agora: ${opts.link}`,
      ],
    }),
  });
}

export async function emailServicoSuspenso(opts: {
  para: string;
  copia?: string | null;
  nome: string;
  valor: string;
  link: string;
}) {
  const ola = saudacao(opts.nome);
  await enviarEmail({
    to: opts.para,
    ...(opts.copia ? { bcc: opts.copia } : {}),
    subject: "Serviço Snaptie suspenso por falta de pagamento",
    html: carta({
      saudacao: ola,
      paragrafos: [
        "Como o pagamento da subscrição continua em falta, as páginas e os QR codes da sua empresa foram suspensos. Quem os abrir vê um aviso de página indisponível.",
        `Nada foi apagado. Assim que o pagamento de <strong>${esc(opts.valor)}</strong> for feito, tudo volta a funcionar de imediato.`,
      ],
      botao: { texto: "Pagar e reativar", url: opts.link },
    }),
    text: texto({
      saudacao: ola,
      linhas: [
        "As páginas e os QR codes da sua empresa foram suspensos por falta de pagamento. Nada foi apagado.",
        `Pagar ${opts.valor} e reativar: ${opts.link}`,
      ],
    }),
  });
}

export async function emailServicoReativado(opts: { para: string; nome: string }) {
  const ola = saudacao(opts.nome);
  await enviarEmail({
    to: opts.para,
    subject: "Serviço Snaptie reativado",
    html: carta({
      saudacao: ola,
      paragrafos: [
        "Recebemos o pagamento em falta. As páginas e os QR codes da sua empresa já estão ativos de novo.",
        "Obrigado.",
      ],
    }),
    text: texto({ saudacao: ola, linhas: ["Recebemos o pagamento em falta. As páginas e os QR codes já estão ativos de novo."] }),
  });
}

export async function emailSubscricaoCancelada(opts: { para: string; nome: string; pacote: string; data: string }) {
  const ola = saudacao(opts.nome);
  await enviarEmail({
    to: opts.para,
    subject: `Subscrição ${opts.pacote} cancelada`,
    html: carta({
      saudacao: ola,
      paragrafos: [
        `Confirmamos o cancelamento da subscrição <strong>${esc(opts.pacote)}</strong>. O plano mantém-se ativo até <strong>${esc(opts.data)}</strong> e não haverá mais cobranças.`,
        "Se mudar de ideias antes dessa data, pode manter a subscrição em O meu plano.",
      ],
    }),
    text: texto({
      saudacao: ola,
      linhas: [`Confirmamos o cancelamento da subscrição ${opts.pacote}. O plano mantém-se até ${opts.data} e não haverá mais cobranças.`],
    }),
  });
}
