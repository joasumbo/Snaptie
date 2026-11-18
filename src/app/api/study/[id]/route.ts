import {
  avancar,
  fecharRelatorio,
  melhorar,
  novasFotos,
  reportar,
  responder,
  seguirSemFotos,
  tentarDeNovo,
  verEstudo,
} from "@/lib/study/motor";

export const dynamic = "force-dynamic";

// O estado do estudo (o ecrã pergunta de poucos em poucos segundos) e as ações
// do aluno. O id comprido é a chave: quem tem o link continua o estudo.

const TAMANHO_MAX = 4_000_000; // por fotografia, em base64

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await verEstudo(id);
  if (!v) return Response.json({ erro: "Este estudo não existe." }, { status: 404 });
  return Response.json(v, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let c: { acao?: string; atividadeId?: string; resposta?: string; motivo?: string; fotos?: unknown };
  try {
    c = await req.json();
  } catch {
    return Response.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  if (!(await verEstudo(id))) return Response.json({ erro: "Este estudo não existe." }, { status: 404 });
  try {
    const a = String(c.atividadeId ?? "");
    if (c.acao === "responder") await responder(id, a, String(c.resposta ?? ""));
    else if (c.acao === "avancar") await avancar(id, a);
    else if (c.acao === "fechar") await fecharRelatorio(id);
    else if (c.acao === "repetir") await tentarDeNovo(id, a);
    else if (c.acao === "melhorar") await melhorar(id, a);
    else if (c.acao === "reportar") await reportar(id, a, String(c.motivo ?? ""));
    else if (c.acao === "seguir") await seguirSemFotos(id);
    else if (c.acao === "fotos") {
      const fotos = (Array.isArray(c.fotos) ? c.fotos : [])
        .map((f) => ({ pagina: Number((f as { pagina?: unknown })?.pagina), imagem: String((f as { imagem?: unknown })?.imagem ?? "") }))
        .filter((f) => f.imagem.length > 0 && f.imagem.length <= TAMANHO_MAX && /^[A-Za-z0-9+/=]+$/.test(f.imagem));
      await novasFotos(id, fotos);
    } else return Response.json({ erro: "Ação desconhecida." }, { status: 400 });
  } catch (e) {
    return Response.json({ erro: e instanceof Error ? e.message : "Erro." }, { status: 409 });
  }
  return Response.json(await verEstudo(id), { headers: { "Cache-Control": "no-store" } });
}
