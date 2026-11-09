import "server-only";

import { enviarEmail } from "@/lib/email";

// Os emails dos pagamentos. Saem todos do Snaptie, nunca do Stripe: o Stripe
// não tem o email de ninguém, por isso não consegue mandar nada.
//

function esc(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type Bloco = { rotulo: string; valor: string };

export type Ilustracao = "pago" | "fatura" | "falha" | "renovacao" | "pedido" | "suspenso" | "reativado";

const BASE = (process.env.APP_URL || "https://mysnaptie.com").replace(/\/+$/, "");
const LETRA = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// O modelo de todos os emails de pagamento: logótipo ao centro, título a
// azul, ilustração, o texto, uma caixa cinzenta com os dados e o botão, a
// despedida e o rodapé. Tabelas e estilos em linha, que é o que os programas
// de email respeitam; as imagens são PNG servidas por nós (o Gmail e o
// Outlook não mostram SVG).
function carta(opts: {
  titulo: string;
  ilustracao: Ilustracao;
  saudacao: string;
  paragrafos: string[];
  detalhes?: Bloco[];
  botao?: { texto: string; url: string };
  nota?: string;
}): string {
  const detalhes = opts.detalhes?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
        ${opts.detalhes
          .map(
            (d, i) => `<tr>
              <td style="padding:8px 0;${i ? "border-top:1px solid #e4e4ea;" : ""}color:#71717a;font-size:14px;text-align:left;">${esc(d.rotulo)}</td>
              <td style="padding:8px 0;${i ? "border-top:1px solid #e4e4ea;" : ""}color:#18181b;font-size:14px;font-weight:600;text-align:right;">${esc(d.valor)}</td>
            </tr>`,
          )
          .join("")}
      </table>`
    : "";
  const botao = opts.botao
    ? `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:${detalhes ? "18px" : "0"} auto 0;">
        <tr><td style="border-radius:6px;background:#4f46e5;">
          <a href="${opts.botao.url}" style="display:inline-block;padding:12px 26px;font-family:${LETRA};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">${esc(opts.botao.texto)}</a>
        </td></tr>
      </table>
      <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#71717a;text-align:left;">Ou copie este link para o seu browser:<br><a href="${opts.botao.url}" style="color:#4f46e5;word-break:break-all;">${esc(opts.botao.url)}</a></p>`
    : "";
  const caixa = detalhes || botao
    ? `<tr><td style="padding:6px 32px 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f7;border-radius:8px;">
          <tr><td style="padding:20px 22px;font-family:${LETRA};text-align:center;">${detalhes}${botao}</td></tr>
        </table>
      </td></tr>`
    : "";
  const ano = new Date().getFullYear();
  return `<!doctype html>
<html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.titulo)}</title></head>
<body style="margin:0;padding:0;background:#eef0f4;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#eef0f4;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#ffffff;font-family:${LETRA};">
        <tr><td align="center" style="padding:30px 24px 6px;">
          <img src="${BASE}/api/email/img/logo.png" width="150" height="33" alt="Snaptie" style="display:block;border:0;">
        </td></tr>
        <tr><td align="center" style="padding:14px 32px 0;font-size:22px;line-height:1.3;font-weight:600;color:#4f46e5;">${esc(opts.titulo)}</td></tr>
        <tr><td align="center" style="padding:18px 24px 10px;">
          <img src="${BASE}/api/email/img/${opts.ilustracao}.png" width="220" height="130" alt="" style="display:block;border:0;">
        </td></tr>
        <tr><td style="padding:10px 32px 4px;font-size:14px;line-height:1.65;color:#27272a;">
          <p style="margin:0 0 12px;">${esc(opts.saudacao)}</p>
          ${opts.paragrafos.map((t) => `<p style="margin:0 0 12px;">${t}</p>`).join("")}
        </td></tr>
        ${caixa}
        <tr><td style="padding:4px 32px 28px;font-size:14px;line-height:1.65;color:#27272a;">
          ${opts.nota ? `<p style="margin:0 0 14px;font-size:13px;color:#52525b;">${esc(opts.nota)}</p>` : ""}
          <p style="margin:0;">Com os melhores cumprimentos,<br><strong>A equipa Snaptie</strong></p>
        </td></tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;font-family:${LETRA};">
        <tr><td align="center" style="padding:22px 24px 6px;font-size:12px;color:#52525b;">
          <a href="${BASE}" style="color:#3f3f46;text-decoration:none;font-weight:600;">mysnaptie.com</a>
          <span style="color:#a1a1aa;">&nbsp;|&nbsp;</span>
          <a href="${BASE}/login" style="color:#3f3f46;text-decoration:none;font-weight:600;">Entrar no painel</a>
        </td></tr>
        <tr><td align="center" style="padding:4px 24px 22px;font-size:11px;line-height:1.6;color:#a1a1aa;border-bottom:4px solid #4f46e5;">
          &copy; ${ano} Snaptie &middot; Plataforma de QR codes<br>Pagamentos processados de forma segura e encriptada
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function texto(opts: { saudacao: string; linhas: string[] }): string {
  return [opts.saudacao, "", ...opts.linhas, "", "Com os melhores cumprimentos,", "A equipa Snaptie", "", "mysnaptie.com"].join("\n");
}

function saudacao(nome: string | null): string {
  return nome ? `Olá ${nome},` : "Olá,";
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
  // "fatura" quando a fatura-recibo certificada já foi emitida; senão segue
  // o comprovativo e a fatura vem depois.
  documento?: "fatura" | "comprovativo";
}) {
  const ola = saudacao(opts.nome);
  const fatura = opts.documento === "fatura";
  const nomeDoc = fatura ? "Fatura-recibo" : "Comprovativo";
  await enviarEmail({
    to: opts.para,
    ...(opts.copia ? { bcc: opts.copia } : {}),
    subject: `Pagamento recebido · ${opts.descricao} · ${opts.numero}`,
    html: carta({
      titulo: "Pagamento recebido",
      ilustracao: "pago",
      saudacao: ola,
      paragrafos: [
        `Confirmamos que o seu pagamento de <strong>${esc(opts.valor)}</strong> referente a <strong>${esc(opts.descricao)}</strong> foi recebido com sucesso.`,
        fatura
          ? "Segue em anexo a fatura-recibo, que pode guardar para os seus registos."
          : "Segue em anexo o comprovativo de pagamento. A fatura será enviada em breve.",
      ],
      detalhes: [
        { rotulo: nomeDoc, valor: opts.numero },
        { rotulo: "Data", valor: opts.data },
        { rotulo: "Valor pago", valor: opts.valor },
      ],
      nota: "Recebe este email porque fez um pagamento no Snaptie.",
    }),
    text: texto({
      saudacao: ola,
      linhas: [
        `Confirmamos que o seu pagamento de ${opts.valor} referente a ${opts.descricao} foi recebido com sucesso.`,
        `${nomeDoc}: ${opts.numero}`,
        `Data: ${opts.data}`,
        `${fatura ? "A fatura-recibo" : "O comprovativo"} segue em anexo.`,
      ],
    }),
    attachments: [{ filename: `${fatura ? "fatura-recibo" : "comprovativo"}-${opts.numero.replace(/[^\w.-]+/g, "-")}.pdf`, content: opts.pdf }],
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
      titulo: "Pagamento não concluído",
      ilustracao: "falha",
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
      titulo: "A sua subscrição vai renovar",
      ilustracao: "renovacao",
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
  proforma?: { numero: string; pdf: Buffer } | null;
}) {
  const ola = saudacao(opts.nome);
  await enviarEmail({
    to: opts.para,
    ...(opts.copia ? { bcc: opts.copia } : {}),
    subject: `Pagamento em falta · Subscrição ${opts.pacote}`,
    html: carta({
      titulo: "Pagamento em falta",
      ilustracao: "falha",
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
    ...(opts.proforma
      ? { attachments: [{ filename: `proforma-${opts.proforma.numero.replace(/[^\w.-]+/g, "-")}.pdf`, content: opts.proforma.pdf }] }
      : {}),
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
      titulo: "Serviço suspenso",
      ilustracao: "suspenso",
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
      titulo: "Serviço reativado",
      ilustracao: "reativado",
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
      titulo: "Subscrição cancelada",
      ilustracao: "renovacao",
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

// A fatura que não saiu na hora do pagamento (a Moloni falhou) e foi emitida
// depois.
export async function emailFaturaEmitida(opts: {
  para: string;
  copia?: string | null;
  nome: string | null;
  descricao: string;
  valor: string;
  numero: string;
  pdf: Buffer;
}) {
  const ola = saudacao(opts.nome);
  await enviarEmail({
    to: opts.para,
    ...(opts.copia ? { bcc: opts.copia } : {}),
    subject: `Fatura-recibo ${opts.numero} · ${opts.descricao}`,
    html: carta({
      titulo: "A sua fatura-recibo",
      ilustracao: "fatura",
      saudacao: ola,
      paragrafos: [
        `Segue em anexo a fatura-recibo <strong>${esc(opts.numero)}</strong> do seu pagamento de <strong>${esc(opts.valor)}</strong> referente a <strong>${esc(opts.descricao)}</strong>.`,
      ],
    }),
    text: texto({ saudacao: ola, linhas: [`Segue em anexo a fatura-recibo ${opts.numero} do seu pagamento de ${opts.valor} (${opts.descricao}).`] }),
    attachments: [{ filename: `fatura-recibo-${opts.numero.replace(/[^\w.-]+/g, "-")}.pdf`, content: opts.pdf }],
  });
}

// Pedido de pagamento: o link para pagar e, quando existe, o orçamento
// (pró-forma) da Moloni em anexo.
export async function emailPedidoPagamento(opts: {
  para: string;
  nome: string | null;
  descricao: string;
  valor: string;
  link: string;
  proforma?: { numero: string; pdf: Buffer } | null;
}) {
  const ola = saudacao(opts.nome);
  await enviarEmail({
    to: opts.para,
    subject: `Pedido de pagamento · ${opts.descricao}`,
    html: carta({
      titulo: "Pedido de pagamento",
      ilustracao: "pedido",
      saudacao: ola,
      paragrafos: [
        `Enviamos o pedido de pagamento de <strong>${esc(opts.valor)}</strong> referente a <strong>${esc(opts.descricao)}</strong>.`,
        opts.proforma ? `Segue em anexo a pró-forma ${esc(opts.proforma.numero)}. A fatura-recibo é emitida e enviada assim que o pagamento for confirmado.` : "A fatura-recibo é enviada assim que o pagamento for confirmado.",
      ],
      detalhes: opts.proforma ? [{ rotulo: "Pró-forma", valor: opts.proforma.numero }, { rotulo: "Valor", valor: opts.valor }] : [{ rotulo: "Valor", valor: opts.valor }],
      botao: { texto: "Pagar agora", url: opts.link },
    }),
    text: texto({
      saudacao: ola,
      linhas: [`Pedido de pagamento de ${opts.valor} referente a ${opts.descricao}.`, `Pagar: ${opts.link}`],
    }),
    ...(opts.proforma
      ? { attachments: [{ filename: `proforma-${opts.proforma.numero.replace(/[^\w.-]+/g, "-")}.pdf`, content: opts.proforma.pdf }] }
      : {}),
  });
}

// O primeiro email depois de um pagamento, quando a fatura vem da Moloni:
// só a confirmação. A fatura-recibo segue num email à parte.
export async function emailPagamentoConfirmado(opts: {
  para: string;
  copia?: string | null;
  nome: string | null;
  descricao: string;
  valor: string;
  data: string;
  metodo: string | null;
}) {
  const ola = saudacao(opts.nome);
  await enviarEmail({
    to: opts.para,
    ...(opts.copia ? { bcc: opts.copia } : {}),
    subject: `Pagamento confirmado · ${opts.descricao}`,
    html: carta({
      titulo: "Pagamento confirmado",
      ilustracao: "pago",
      saudacao: ola,
      paragrafos: [
        `Confirmamos que o seu pagamento de <strong>${esc(opts.valor)}</strong> referente a <strong>${esc(opts.descricao)}</strong> foi recebido com sucesso.`,
        "A fatura-recibo segue num email à parte, dentro de instantes.",
      ],
      detalhes: [
        { rotulo: "Data", valor: opts.data },
        { rotulo: "Valor pago", valor: opts.valor },
        ...(opts.metodo ? [{ rotulo: "Método", valor: opts.metodo }] : []),
      ],
      nota: "Recebe este email porque fez um pagamento no Snaptie.",
    }),
    text: texto({
      saudacao: ola,
      linhas: [
        `Confirmamos que o seu pagamento de ${opts.valor} referente a ${opts.descricao} foi recebido com sucesso.`,
        `Data: ${opts.data}`,
        "A fatura-recibo segue num email à parte.",
      ],
    }),
  });
}
