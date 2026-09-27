import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireQrManager, baseUrl, publicUrl, csvCell } from "@/lib/qr-export";
import { verificarFuncionalidade } from "@/lib/planos-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Exporta um conjunto de QRs. Seleciona por:
 *   ?lote=<id>        um lote criado em série
 *   ?ids=a,b,c        uma lista específica
 *   ?company=<id>     todos os de uma empresa (só admin)
 * Formatos:
 *   ?format=csv       ficheiro CSV (Nome, Empresa, Código, Link, Imagem) — abre
 *                     no Excel e serve para impressão em série no Word
 *   ?format=print     folha HTML com os QRs e as etiquetas, pronta a imprimir
 *                     para PDF (Ctrl+P → Guardar como PDF)
 */
export async function GET(req: NextRequest) {
  const actor = await requireQrManager();
  if (!actor) return NextResponse.json({ error: "Sem permissao" }, { status: 401 });
  if (actor.role !== "ADMIN") {
    const bloqueio = await verificarFuncionalidade(actor.role, actor.companyId ?? "", "exportacao");
    if (bloqueio) return NextResponse.json({ error: bloqueio }, { status: 403 });
  }

  const p = req.nextUrl.searchParams;
  const lote = p.get("lote");
  const idsParam = p.get("ids");
  const company = p.get("company");
  const format = p.get("format") === "print" ? "print" : "csv";

  const where: Prisma.QrCodeWhereInput = {};
  if (lote) where.lote = lote;
  else if (idsParam) where.id = { in: idsParam.split(",").map((s) => s.trim()).filter(Boolean) };
  else if (company) where.companyId = company;
  else return NextResponse.json({ error: "Indique lote, ids ou company" }, { status: 400 });

  // Não-admin só vê os QRs da própria empresa.
  if (actor.role !== "ADMIN") where.companyId = actor.companyId ?? "__none__";

  const qrs = await prisma.qrCode.findMany({
    where,
    select: { id: true, nome: true, codigo: true, corPrimaria: true, company: { select: { nome: true, slug: true } } },
    orderBy: { nome: "asc" },
  });

  if (qrs.length === 0) return NextResponse.json({ error: "Nenhum QR encontrado" }, { status: 404 });

  const base = await baseUrl();
  const carimbo = new Date().toISOString().slice(0, 10);
  const nomeBase = lote ? `lote-${lote}` : company ? "empresa" : "qrs";

  if (format === "csv") {
    const linhas = [["Nome", "Empresa", "Codigo", "Link", "Imagem"].join(",")];
    for (const q of qrs) {
      const link = publicUrl(base, q.company.slug, q.codigo);
      const imagem = `${base}/api/qr/${q.id}?format=png&size=1024`;
      linhas.push([q.nome, q.company.nome, q.codigo ?? "", link, imagem].map((c) => csvCell(String(c))).join(","));
    }
    // BOM para o Excel abrir os acentos corretamente.
    const csv = "﻿" + linhas.join("\r\n") + "\r\n";
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nomeBase}-${carimbo}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // format === "print": folha HTML com os QRs inline (SVG), pronta a imprimir.
  const cartoes = await Promise.all(
    qrs.map(async (q) => {
      const link = publicUrl(base, q.company.slug, q.codigo);
      const dark = q.corPrimaria && /^#[0-9a-fA-F]{6}$/.test(q.corPrimaria) ? q.corPrimaria : "#000000";
      const svg = await QRCode.toString(link, { type: "svg", margin: 1, width: 220, color: { dark, light: "#ffffff" } });
      return `<div class="cartao"><div class="qr">${svg}</div><div class="nome">${esc(q.nome)}</div><div class="link">${esc(link)}</div></div>`;
    }),
  );

  const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8">
<title>${esc(nomeBase)} — impressão</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 12mm; color: #111; }
  .topo { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8mm; }
  .topo h1 { font-size: 16px; margin: 0; }
  .topo button { font-size: 13px; padding: 6px 12px; cursor: pointer; }
  .grelha { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
  .cartao { border: 1px dashed #bbb; border-radius: 6px; padding: 5mm; text-align: center; break-inside: avoid; }
  .qr svg { width: 100%; height: auto; max-width: 42mm; }
  .nome { font-weight: 600; font-size: 12px; margin-top: 3mm; word-break: break-word; }
  .link { font-size: 9px; color: #666; word-break: break-all; margin-top: 1mm; }
  @media print { .topo button { display: none; } body { padding: 8mm; } }
</style></head>
<body>
  <div class="topo">
    <h1>${qrs.length} QR codes — ${esc(qrs[0].company.nome)}</h1>
    <button onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>
  <div class="grelha">${cartoes.join("")}</div>
</body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
