import "server-only";

import { randomBytes } from "node:crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { r2 } from "@/lib/storage";
import { gravar, ler, moloni } from "@/lib/moloni";

// Documentos certificados da Moloni, com o modelo da Moloni:
//   cobrança  -> orçamento (a pró-forma; a API da Moloni não tem a "fatura
//                pró-forma", e o orçamento faz o mesmo papel)
//   pagamento -> fatura-recibo, emitida só depois de o pagamento estar
//                confirmado, ligada ao orçamento quando existe.
// Os PDFs ficam no nosso R2 e são servidos por nós.
//
// Os valores cobrados são finais: já incluem o IVA (23%). A fatura mostra a
// base e o imposto em separado.

const IVA = 23;

const K = {
  empresa: "moloni_company_id",
  serie: "moloni_serie_id",
  serieNome: "moloni_serie_nome",
  desde: "moloni_desde",
  refs: "moloni_refs",
} as const;

type Refs = { taxa: number; metodo: number; categoria: number; produto: number; prazo: number; unidade: number; consumidor: number };

export async function configuracaoFaturas(): Promise<{
  empresa: number | null;
  serie: number | null;
  serieNome: string | null;
  desde: Date | null;
}> {
  const [empresa, serie, serieNome, desde] = await Promise.all([ler(K.empresa), ler(K.serie), ler(K.serieNome), ler(K.desde)]);
  return {
    empresa: empresa ? Number(empresa) : null,
    serie: serie ? Number(serie) : null,
    serieNome,
    desde: desde ? new Date(Number(desde)) : null,
  };
}

// Só emite quando a empresa e a série estão escolhidas e a ligação está ativa.
export async function faturacaoAtiva(): Promise<boolean> {
  const c = await configuracaoFaturas();
  return Boolean(c.empresa && c.serie && (await ler("moloni_refresh_token")));
}

export async function seriesMoloni(): Promise<{ id: number; nome: string }[]> {
  const empresa = Number(await ler(K.empresa));
  if (!empresa) return [];
  const l = await moloni<{ document_set_id: number; name: string }[]>("documentSets/getAll", { company_id: empresa });
  return l.map((s) => ({ id: s.document_set_id, nome: s.name }));
}

export async function escolherSerie(id: number | null, nome: string | null) {
  if (!id) {
    await prisma.configuracao.deleteMany({ where: { chave: { in: [K.serie, K.serieNome, K.desde] } } });
    return;
  }
  await gravar(K.serie, String(id));
  await gravar(K.serieNome, nome ?? "");
  // Só os pagamentos feitos a partir de agora levam fatura: os anteriores
  // ficam com o comprovativo que já receberam.
  if (!(await ler(K.desde))) await gravar(K.desde, String(Date.now()));
}

// Os registos de apoio na Moloni (taxa, método de pagamento, artigo...). Os
// que faltam são criados uma vez e ficam guardados.
async function referencias(empresa: number): Promise<Refs> {
  const guardadas = await ler(`${K.refs}_${empresa}`);
  if (guardadas) return JSON.parse(guardadas) as Refs;
  const c = { company_id: empresa };

  const taxas = await moloni<{ tax_id: number; name: string; value: number; saft_type?: number }[]>("taxes/getAll", c);
  const taxa = (taxas.find((t) => t.value === IVA && /normal/i.test(t.name)) ?? taxas.find((t) => t.value === IVA))?.tax_id;
  if (!taxa) throw new Error("A empresa na Moloni não tem a taxa de IVA de 23%.");

  const metodos = await moloni<{ payment_method_id: number; name: string }[]>("paymentMethods/getAll", c);
  let metodo = metodos.find((m) => /stripe|online/i.test(m.name))?.payment_method_id;
  if (!metodo) metodo = (await moloni<{ payment_method_id: number }>("paymentMethods/insert", { ...c, name: "Stripe (online)" })).payment_method_id;

  const prazos = await moloni<{ maturity_date_id: number; days: number }[]>("maturityDates/getAll", c);
  let prazo = prazos.find((p) => p.days === 0)?.maturity_date_id;
  if (!prazo) prazo = (await moloni<{ maturity_date_id: number }>("maturityDates/insert", { ...c, name: "Pronto pagamento", days: 0 })).maturity_date_id;

  const unidades = await moloni<{ unit_id: number; name: string; short_name: string }[]>("measurementUnits/getAll", c);
  let unidade = unidades.find((u) => /^un/i.test(u.short_name) || /^unidade/i.test(u.name))?.unit_id;
  if (!unidade) unidade = (await moloni<{ unit_id: number }>("measurementUnits/insert", { ...c, name: "Unidade", short_name: "Un." })).unit_id;

  const categorias = await moloni<{ category_id: number; name: string }[]>("productCategories/getAll", { ...c, parent_id: 0 });
  let categoria = categorias.find((x) => x.name === "Snaptie")?.category_id;
  if (!categoria) categoria = (await moloni<{ category_id: number }>("productCategories/insert", { ...c, parent_id: 0, name: "Snaptie" })).category_id;

  const existentes = await moloni<{ product_id: number }[]>("products/getByReference", { ...c, reference: "SNAPTIE" });
  const produto =
    existentes[0]?.product_id ??
    (
      await moloni<{ product_id: number }>("products/insert", {
        ...c,
        category_id: categoria,
        type: 2,
        name: "Serviço Snaptie",
        reference: "SNAPTIE",
        price: 0,
        unit_id: unidade,
        has_stock: 0,
        stock: 0,
        taxes: [{ tax_id: taxa, value: IVA, order: 1, cumulative: 0 }],
      })
    ).product_id;

  const consumidor = await clienteMoloni(empresa, { metodo, prazo }, {
    numero: "SNPCF",
    nif: "999999990",
    nome: "Consumidor final",
  });

  const refs: Refs = { taxa, metodo, categoria, produto, prazo, unidade, consumidor };
  await gravar(`${K.refs}_${empresa}`, JSON.stringify(refs));
  return refs;
}

// NIF português válido (algarismo de controlo).
export function nifValido(nif: string | null | undefined): boolean {
  const n = (nif ?? "").replace(/\D/g, "");
  if (!/^[125689]\d{8}$/.test(n) && !/^(45|70|71|72|74|75|77|79|90|91|98|99)\d{7}$/.test(n)) return false;
  const soma = n.slice(0, 8).split("").reduce((t, d, i) => t + Number(d) * (9 - i), 0);
  const resto = soma % 11;
  const controlo = resto < 2 ? 0 : 11 - resto;
  return controlo === Number(n[8]);
}

async function clienteMoloni(
  empresa: number,
  r: { metodo: number; prazo: number },
  d: { numero: string; nif: string; nome: string; morada?: string | null; codigoPostal?: string | null; cidade?: string | null; email?: string | null },
): Promise<number> {
  const c = { company_id: empresa };
  const porNumero = await moloni<{ customer_id: number }[]>("customers/getByNumber", { ...c, number: d.numero });
  if (porNumero[0]) return porNumero[0].customer_id;
  if (d.nif !== "999999990") {
    const porNif = await moloni<{ customer_id: number }[]>("customers/getByVat", { ...c, vat: d.nif });
    if (porNif[0]) return porNif[0].customer_id;
  }
  const cp = (d.codigoPostal ?? "").trim();
  const novo = await moloni<{ customer_id: number }>("customers/insert", {
    ...c,
    vat: d.nif,
    number: d.numero.slice(0, 20),
    name: d.nome.slice(0, 100) || "Cliente",
    language_id: 1,
    address: d.morada?.trim() || "Desconhecido",
    zip_code: /^\d{4}-\d{3}$/.test(cp) ? cp : "",
    city: d.cidade?.trim() || "Desconhecido",
    country_id: 1,
    email: d.email ?? "",
    maturity_date_id: r.prazo,
    payment_method_id: r.metodo,
    salesman_id: 0,
    payment_day: 0,
    discount: 0,
    credit_limit: 0,
    delivery_method_id: 0,
  });
  return novo.customer_id;
}

type PagamentoCompleto = NonNullable<Awaited<ReturnType<typeof lerPagamento>>>;

function lerPagamento(id: string) {
  return prisma.pagamento.findUnique({ where: { id }, include: { company: true, pacote: true } });
}

// O cliente do documento: a empresa (pacotes, renovações, links de uma
// empresa) ou quem pagou na página. Sem NIF válido, vai como consumidor final.
async function clienteDoPagamento(empresa: number, refs: Refs, p: PagamentoCompleto): Promise<number> {
  const co = p.company;
  if (co && p.tipo !== "botao") {
    if (co.moloniClienteId) return co.moloniClienteId;
    const nif = nifValido(co.nif) ? co.nif!.replace(/\D/g, "") : "999999990";
    const id = await clienteMoloni(empresa, refs, {
      numero: `SNP${co.id.slice(-12).toUpperCase()}`,
      nif,
      nome: co.nome,
      morada: co.morada,
      codigoPostal: co.codigoPostal,
      cidade: co.cidade,
      email: co.email,
    });
    await prisma.company.update({ where: { id: co.id }, data: { moloniClienteId: id } });
    return id;
  }
  if (nifValido(p.nifCliente) || p.nomeCliente) {
    return clienteMoloni(empresa, refs, {
      numero: `SNPP${p.id.slice(-12).toUpperCase()}`,
      nif: nifValido(p.nifCliente) ? p.nifCliente!.replace(/\D/g, "") : "999999990",
      nome: p.nomeCliente || "Consumidor final",
      morada: p.moradaCliente,
      codigoPostal: p.cpCliente,
      cidade: p.cidadeCliente,
      email: p.email,
    });
  }
  return refs.consumidor;
}

function dia(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Lisbon" }).format(d);
}

function linhas(refs: Refs, p: PagamentoCompleto, detalhe: string | null) {
  const nome = p.tipo === "pacote" || p.tipo === "renovacao" ? `Snaptie ${p.descricao ?? ""}`.trim() : p.descricao || "Serviço Snaptie";
  return [
    {
      product_id: refs.produto,
      name: nome.slice(0, 200),
      summary: detalhe ?? "",
      qty: 1,
      price: Math.round((p.valorCentimos / 100 / (1 + IVA / 100)) * 100000) / 100000,
      taxes: [{ tax_id: refs.taxa, value: IVA, order: 1, cumulative: 0 }],
    },
  ];
}

// O PDF de um documento fechado: a Moloni dá um link para uma página de
// download, e é dessa página que sai o ficheiro.
async function pdfDoDocumento(empresa: number, documentId: number): Promise<Buffer> {
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const { url } = await moloni<{ url: string }>("documents/getPDFLink", { company_id: empresa, document_id: documentId });
    const h = new URL(url).searchParams.get("h");
    if (h) {
      const r = await fetch(
        `https://www.moloni.pt/downloads/index.php?action=getDownload&h=${encodeURIComponent(h)}&d=${documentId}&e=&i=1`,
        { cache: "no-store" },
      );
      const tipo = r.headers.get("content-type") ?? "";
      if (r.ok && tipo.includes("pdf")) return Buffer.from(await r.arrayBuffer());
    }
    await new Promise((res) => setTimeout(res, 1500 * (tentativa + 1)));
  }
  throw new Error(`A Moloni não devolveu o PDF do documento ${documentId}.`);
}

async function guardarPdf(pdf: Buffer): Promise<string> {
  const key = `${process.env.R2_PREFIX ?? ""}faturas/${randomBytes(18).toString("hex")}.pdf`;
  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: pdf,
      ContentType: "application/pdf",
      CacheControl: "private, no-store",
    }),
  );
  return key;
}

export async function lerPdfGuardado(key: string): Promise<Buffer> {
  const r = await r2.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
  return Buffer.from(await r.Body!.transformToByteArray());
}

async function numeroDoDocumento(empresa: number, documentId: number): Promise<string> {
  const d = await moloni<{ document_set_name?: string; number?: number }>("documents/getOne", {
    company_id: empresa,
    document_id: documentId,
  });
  return `${d.document_set_name ?? ""}/${d.number ?? ""}`;
}

// O orçamento (pró-forma) de uma cobrança. Não falha a cobrança: se a Moloni
// não responder, fica registado e o pagamento segue sem pró-forma.
export async function emitirOrcamento(pagamentoId: string): Promise<boolean> {
  if (!(await faturacaoAtiva())) return false;
  const p = await lerPagamento(pagamentoId);
  if (!p || p.moloniOrcamentoId || p.estado === "pago") return Boolean(p?.moloniOrcamentoId);
  const cfg = await configuracaoFaturas();
  try {
    const refs = await referencias(cfg.empresa!);
    const cliente = await clienteDoPagamento(cfg.empresa!, refs, p);
    const hoje = dia(new Date());
    const validade = dia(new Date(Date.now() + 15 * 86_400_000));
    const r = await moloni<{ document_id: number }>("estimates/insert", {
      company_id: cfg.empresa,
      date: hoje,
      expiration_date: validade,
      document_set_id: cfg.serie,
      customer_id: cliente,
      your_reference: p.id.slice(-10).toUpperCase(),
      products: linhas(refs, p, null),
      notes: "Pagamento online em mysnaptie.com",
      status: 1,
    });
    const numero = await numeroDoDocumento(cfg.empresa!, r.document_id);
    await prisma.pagamento.update({ where: { id: p.id }, data: { moloniOrcamentoId: r.document_id, moloniOrcamento: numero } });
    const key = await guardarPdf(await pdfDoDocumento(cfg.empresa!, r.document_id));
    await prisma.pagamento.update({ where: { id: p.id }, data: { moloniOrcamentoPdf: key } });
    return true;
  } catch (e) {
    console.error("[moloni] orcamento", p.id, e);
    await prisma.pagamento.update({ where: { id: p.id }, data: { moloniErro: String(e instanceof Error ? e.message : e).slice(0, 500) } });
    return false;
  }
}

// A fatura-recibo de um pagamento confirmado. Uma só por pagamento: a
// marca na base impede duas, mesmo com o webhook e a página ao mesmo tempo.
export async function emitirFatura(pagamentoId: string, detalhe: string | null): Promise<boolean> {
  if (!(await faturacaoAtiva())) return false;
  const cfg = await configuracaoFaturas();
  const p = await lerPagamento(pagamentoId);
  if (!p || p.estado !== "pago") return false;
  if (p.moloniFaturaId) return Boolean(p.moloniFaturaPdf) || (await completarPdf(p.id, cfg.empresa!, p.moloniFaturaId));
  const pago = p.pagoEm ?? p.updatedAt;
  if (cfg.desde && pago < cfg.desde) return false;

  // Reserva: só um processo emite. -1 marca "a emitir".
  const reserva = await prisma.pagamento.updateMany({
    where: { id: p.id, moloniFaturaId: null },
    data: { moloniFaturaId: -1, moloniTentativas: { increment: 1 } },
  });
  if (reserva.count === 0) return false;

  try {
    const refs = await referencias(cfg.empresa!);
    const cliente = await clienteDoPagamento(cfg.empresa!, refs, p);
    const data = dia(pago);
    const valor = p.valorCentimos / 100;
    const r = await moloni<{ document_id: number }>("invoiceReceipts/insert", {
      company_id: cfg.empresa,
      date: data,
      expiration_date: data,
      document_set_id: cfg.serie,
      customer_id: cliente,
      your_reference: p.id.slice(-10).toUpperCase(),
      products: linhas(refs, p, detalhe),
      payments: [
        {
          payment_method_id: refs.metodo,
          date: `${data} ${new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(pago)}`,
          value: valor,
          notes: "Pagamento online (Stripe)",
        },
      ],
      ...(p.moloniOrcamentoId && p.moloniOrcamentoId > 0
        ? { associated_documents: [{ associated_id: p.moloniOrcamentoId, value: valor }] }
        : {}),
      status: 1,
    });
    const numero = await numeroDoDocumento(cfg.empresa!, r.document_id);
    await prisma.pagamento.update({
      where: { id: p.id },
      data: { moloniFaturaId: r.document_id, moloniFatura: numero, moloniErro: null },
    });
    return completarPdf(p.id, cfg.empresa!, r.document_id);
  } catch (e) {
    console.error("[moloni] fatura", p.id, e);
    await prisma.pagamento.update({
      where: { id: p.id },
      data: { moloniFaturaId: null, moloniErro: String(e instanceof Error ? e.message : e).slice(0, 500) },
    });
    return false;
  }
}

// A fatura já está emitida; falta só guardar o PDF (se falhou da primeira vez).
async function completarPdf(pagamentoId: string, empresa: number, documentId: number): Promise<boolean> {
  try {
    const key = await guardarPdf(await pdfDoDocumento(empresa, documentId));
    await prisma.pagamento.update({ where: { id: pagamentoId }, data: { moloniFaturaPdf: key } });
    return true;
  } catch (e) {
    console.error("[moloni] pdf", pagamentoId, e);
    await prisma.pagamento.update({
      where: { id: pagamentoId },
      data: { moloniErro: String(e instanceof Error ? e.message : e).slice(0, 500) },
    });
    return false;
  }
}

// Pagamentos confirmados depois de a faturação ser ligada que ainda não têm
// fatura (a Moloni falhou na altura). Chamado pelo temporizador.
export async function pendentesSemFatura(): Promise<string[]> {
  const cfg = await configuracaoFaturas();
  if (!cfg.desde || !(await faturacaoAtiva())) return [];
  const l = await prisma.pagamento.findMany({
    where: {
      estado: "pago",
      moloniTentativas: { lt: 10 },
      OR: [{ moloniFaturaId: null }, { moloniFaturaId: { gt: 0 }, moloniFaturaPdf: null }],
      pagoEm: { gte: cfg.desde },
    },
    select: { id: true },
    take: 20,
  });
  return l.map((x) => x.id);
}
