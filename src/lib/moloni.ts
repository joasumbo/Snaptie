import "server-only";

import { prisma } from "@/lib/prisma";

// Ligação à Moloni, para as faturas certificadas.
//
// A Moloni entra com utilizador e palavra-passe e devolve dois tokens: o de
// acesso (1 hora) e o de renovação (14 dias). Guardamos só os tokens, nunca a
// palavra-passe. O temporizador de 15 em 15 minutos renova-os, por isso a
// ligação não caduca enquanto o servidor estiver a correr.

const API = "https://api.moloni.pt/v1";

const K = {
  acesso: "moloni_access_token",
  renovacao: "moloni_refresh_token",
  expira: "moloni_expira",
  empresa: "moloni_company_id",
  empresaNome: "moloni_company_nome",
  utilizador: "moloni_utilizador",
} as const;

type Tokens = { access_token: string; refresh_token: string; expires_in: number };

function credenciais() {
  const id = process.env.MOLONI_CLIENT_ID;
  const segredo = process.env.MOLONI_CLIENT_SECRET;
  if (!id || !segredo) throw new Error("Faltam MOLONI_CLIENT_ID e MOLONI_CLIENT_SECRET no servidor.");
  return { id, segredo };
}

export async function ler(chave: string): Promise<string | null> {
  return (await prisma.configuracao.findUnique({ where: { chave } }))?.valor ?? null;
}

export async function gravar(chave: string, valor: string) {
  await prisma.configuracao.upsert({ where: { chave }, create: { chave, valor }, update: { valor } });
}

async function pedirTokens(params: Record<string, string>): Promise<Tokens> {
  const { id, segredo } = credenciais();
  const q = new URLSearchParams({ client_id: id, client_secret: segredo, ...params });
  const r = await fetch(`${API}/grant/?${q}`, { cache: "no-store" });
  const j = (await r.json().catch(() => ({}))) as Partial<Tokens> & { error_description?: string };
  if (!r.ok || !j.access_token || !j.refresh_token) {
    throw new Error(j.error_description === "Invalid username and password combination"
      ? "Utilizador ou palavra-passe da Moloni errados."
      : `A Moloni recusou: ${j.error_description ?? r.status}`);
  }
  return j as Tokens;
}

async function guardarTokens(t: Tokens) {
  await gravar(K.acesso, t.access_token);
  await gravar(K.renovacao, t.refresh_token);
  await gravar(K.expira, String(Date.now() + (t.expires_in - 120) * 1000));
}

async function tokenValido(): Promise<string> {
  const [acesso, expira, renovacao] = await Promise.all([ler(K.acesso), ler(K.expira), ler(K.renovacao)]);
  if (acesso && Number(expira) > Date.now()) return acesso;
  if (!renovacao) throw new Error("A Moloni não está ligada.");
  const t = await pedirTokens({ grant_type: "refresh_token", refresh_token: renovacao });
  await guardarTokens(t);
  return t.access_token;
}

// Uma chamada à API. A Moloni recebe os parâmetros como formulário e
// responde em JSON; um erro vem como lista de campos ou com "error".
export async function moloni<T = unknown>(endpoint: string, dados: Record<string, unknown> = {}): Promise<T> {
  const token = await tokenValido();
  const corpo = new URLSearchParams();
  const achatar = (prefixo: string, v: unknown) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((x, i) => achatar(`${prefixo}[${i}]`, x));
    else if (typeof v === "object") for (const [k, x] of Object.entries(v)) achatar(`${prefixo}[${k}]`, x);
    else corpo.append(prefixo, String(v));
  };
  for (const [k, v] of Object.entries(dados)) achatar(k, v);
  const r = await fetch(`${API}/${endpoint}/?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: corpo,
    cache: "no-store",
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || (j && typeof j === "object" && "error" in j)) {
    throw new Error(`Moloni ${endpoint}: ${JSON.stringify(j).slice(0, 300)}`);
  }
  return j as T;
}

export type EmpresaMoloni = { company_id: number; name: string; vat: string };

// Ligar: entra com o utilizador, guarda os tokens e devolve as empresas a
// que esse utilizador tem acesso, para escolher a certa.
export async function ligarMoloni(utilizador: string, palavraPasse: string): Promise<EmpresaMoloni[]> {
  const t = await pedirTokens({ grant_type: "password", username: utilizador, password: palavraPasse });
  await guardarTokens(t);
  await gravar(K.utilizador, utilizador);
  const empresas = await moloni<EmpresaMoloni[]>("companies/getAll");
  if (empresas.length === 1) await escolherEmpresa(empresas[0]!.company_id, empresas[0]!.name);
  return empresas.map((e) => ({ company_id: e.company_id, name: e.name, vat: e.vat }));
}

export async function escolherEmpresa(id: number, nome: string) {
  await gravar(K.empresa, String(id));
  await gravar(K.empresaNome, nome);
}

export async function desligarMoloni() {
  await prisma.configuracao.deleteMany({ where: { chave: { in: Object.values(K) } } });
}

export async function estadoMoloni(): Promise<
  { ligado: false } | { ligado: true; utilizador: string; empresa: string | null; empresas: EmpresaMoloni[] }
> {
  const renovacao = await ler(K.renovacao);
  if (!renovacao) return { ligado: false };
  try {
    const empresas = await moloni<EmpresaMoloni[]>("companies/getAll");
    return {
      ligado: true,
      utilizador: (await ler(K.utilizador)) ?? "",
      empresa: await ler(K.empresaNome),
      empresas: empresas.map((e) => ({ company_id: e.company_id, name: e.name, vat: e.vat })),
    };
  } catch (e) {
    console.error("[moloni] estado", e);
    return { ligado: false };
  }
}

// Chamado pelo temporizador: renova os tokens antes de caducarem.
export async function manterMoloni(): Promise<void> {
  if (!(await ler(K.renovacao))) return;
  await tokenValido();
}
