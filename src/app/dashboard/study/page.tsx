import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import type { Ocorrencia, Plano, Progresso } from "@/lib/study/tipos";

export const dynamic = "force-dynamic";

// O consumo do Snaptie Study: quanto trabalho cada estudo deu à IA (tempo de
// placa e texto lido e escrito), e o que a JOAs ocupa na placa neste momento.

const TIPOS: Record<string, string> = {
  ler: "Ler páginas",
  plano: "Plano",
  atividade: "Criar atividades",
  atividade_forte: "Criar atividades (modelo forte)",
  corrigir: "Corrigir respostas",
  imagem: "Escolher imagens",
};

function segundos(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min ${s % 60} s` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

const num = (n: number) => n.toLocaleString("pt-PT");

async function joasAgora(): Promise<{ ligada: boolean; placaMb: number; ate: string | null }> {
  try {
    const r = await fetch(`${process.env.STUDY_IA_URL || "http://joas.internal:11500"}/api/ps`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    const d = (await r.json()) as { models?: { size_vram?: number; expires_at?: string }[] };
    const m = d.models ?? [];
    return {
      ligada: true,
      placaMb: Math.round(m.reduce((a, x) => a + (x.size_vram ?? 0), 0) / 1048576),
      ate: m[0]?.expires_at ?? null,
    };
  } catch {
    return { ligada: false, placaMb: 0, ate: null };
  }
}

export default async function StudyConsumoPage() {
  await requireRole(["ADMIN"]);
  const [joas, sessoes, porTipo, porSessao] = await Promise.all([
    joasAgora(),
    prisma.studySessao.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.studyUso.groupBy({ by: ["tipo"], _count: true, _sum: { ms: true, entrada: true, saida: true } }),
    prisma.studyUso.groupBy({ by: ["sessaoId"], _count: true, _sum: { ms: true, entrada: true, saida: true } }),
  ]);
  const uso = new Map(porSessao.map((u) => [u.sessaoId, u]));
  const total = porTipo.reduce(
    (a, t) => ({
      pedidos: a.pedidos + t._count,
      ms: a.ms + (t._sum.ms ?? 0),
      entrada: a.entrada + (t._sum.entrada ?? 0),
      saida: a.saida + (t._sum.saida ?? 0),
    }),
    { pedidos: 0, ms: 0, entrada: 0, saida: 0 },
  );

  const linhas = sessoes.map((s) => {
    const p = s.progresso as unknown as Progresso | null;
    const plano = s.estado === "pronto" ? (s.plano as unknown as Plano) : null;
    const feitas = p?.atividades.filter((a) => a.estado === "corrigida") ?? [];
    const u = uso.get(s.id);
    return {
      id: s.id,
      quando: s.createdAt,
      tema: plano?.tema || (s.estado === "erro" ? s.erro : "") || "",
      estado: s.estado,
      paginas: s.paginas,
      feitas: feitas.length,
      total: p?.atividades.length ?? 0,
      certas: feitas.filter((a) => a.certo).length,
      pedidos: u?._count ?? 0,
      ms: u?._sum.ms ?? 0,
      reportados: (p?.registo ?? []).filter((r) => r.tipo === "reportada"),
      falhas: (p?.registo ?? []).filter((r) => r.tipo === "falha").length,
    };
  });
  const reportados: (Ocorrencia & { sessao: string })[] = linhas
    .flatMap((l) => l.reportados.map((r) => ({ ...r, sessao: l.id })))
    .sort((a, b) => b.quando.localeCompare(a.quando))
    .slice(0, 20);

  return (
    <div className="space-y-6">
      <PageHeader title="Study" description="O que o Snaptie Study gasta da IA: tempo de placa e texto lido e escrito, por estudo e por tipo de trabalho." />

      <section className="grid gap-3 sm:grid-cols-4">
        <Cartao titulo="JOAs agora">
          {joas.ligada ? (
            joas.placaMb > 0 ? (
              <>
                <div className="text-2xl font-semibold">{(joas.placaMb / 1024).toFixed(1)} GB</div>
                <div className="text-xs text-muted-foreground">
                  na placa, a trabalhar
                  {joas.ate ? `, liberta às ${new Date(joas.ate).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}` : ""}
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-semibold">Parada</div>
                <div className="text-xs text-muted-foreground">sem nada na placa</div>
              </>
            )
          ) : (
            <>
              <div className="text-2xl font-semibold text-red-600">Sem ligação</div>
              <div className="text-xs text-muted-foreground">o túnel ou a JOAs não respondem</div>
            </>
          )}
        </Cartao>
        <Cartao titulo="Estudos">
          <div className="text-2xl font-semibold">{num(sessoes.length)}</div>
          <div className="text-xs text-muted-foreground">{num(sessoes.reduce((a, s) => a + s.paginas, 0))} páginas enviadas</div>
        </Cartao>
        <Cartao titulo="Tempo de placa">
          <div className="text-2xl font-semibold">{segundos(total.ms)}</div>
          <div className="text-xs text-muted-foreground">{num(total.pedidos)} pedidos à IA</div>
        </Cartao>
        <Cartao titulo="Texto (tokens)">
          <div className="text-2xl font-semibold">{num(total.entrada + total.saida)}</div>
          <div className="text-xs text-muted-foreground">
            {num(total.entrada)} lidos, {num(total.saida)} escritos
          </div>
        </Cartao>
      </section>

      <section className="rounded-xl border bg-card">
        <h2 className="border-b px-4 py-3 text-sm font-semibold">Por tipo de trabalho</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Trabalho</th>
              <th className="px-4 py-2 text-right font-medium">Pedidos</th>
              <th className="px-4 py-2 text-right font-medium">Tempo de placa</th>
              <th className="px-4 py-2 text-right font-medium">Média por pedido</th>
              <th className="px-4 py-2 text-right font-medium">Tokens lidos / escritos</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {porTipo.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Ainda não há pedidos registados.
                </td>
              </tr>
            ) : (
              porTipo
                .sort((a, b) => (b._sum.ms ?? 0) - (a._sum.ms ?? 0))
                .map((t) => (
                  <tr key={t.tipo}>
                    <td className="px-4 py-2">{TIPOS[t.tipo] ?? t.tipo}</td>
                    <td className="px-4 py-2 text-right">{num(t._count)}</td>
                    <td className="px-4 py-2 text-right">{segundos(t._sum.ms ?? 0)}</td>
                    <td className="px-4 py-2 text-right">{segundos((t._sum.ms ?? 0) / Math.max(1, t._count))}</td>
                    <td className="px-4 py-2 text-right">
                      {num(t._sum.entrada ?? 0)} / {num(t._sum.saida ?? 0)}
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border bg-card">
        <h2 className="border-b px-4 py-3 text-sm font-semibold">Estudos</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Quando</th>
                <th className="px-4 py-2 font-medium">Tema</th>
                <th className="px-4 py-2 text-right font-medium">Páginas</th>
                <th className="px-4 py-2 text-right font-medium">Atividades</th>
                <th className="px-4 py-2 text-right font-medium">Certas</th>
                <th className="px-4 py-2 text-right font-medium">Tempo de placa</th>
                <th className="px-4 py-2 text-right font-medium">Erros</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                    Ainda não há estudos.
                  </td>
                </tr>
              ) : (
                linhas.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap px-4 py-2">
                      {l.quando.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="max-w-64 truncate px-4 py-2">
                      <Link href={`/study/${l.id}`} target="_blank" className="hover:underline">
                        {l.tema || (l.estado === "pronto" ? "Sem tema" : "A ler...")}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right">{l.paginas}</td>
                    <td className="px-4 py-2 text-right">
                      {l.feitas} / {l.total}
                    </td>
                    <td className="px-4 py-2 text-right">{l.feitas ? `${Math.round((l.certas / l.feitas) * 100)}%` : ""}</td>
                    <td className="px-4 py-2 text-right">{l.pedidos ? segundos(l.ms) : "sem registo"}</td>
                    <td className="px-4 py-2 text-right">{l.reportados.length + l.falhas || ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {reportados.length > 0 ? (
        <section className="rounded-xl border bg-card">
          <h2 className="border-b px-4 py-3 text-sm font-semibold">Erros marcados pelos alunos</h2>
          <ul className="divide-y text-sm">
            {reportados.map((r, i) => (
              <li key={i} className="px-4 py-2">
                <div className="font-medium">{r.motivo}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.quando).toLocaleString("pt-PT")} ·{" "}
                  {r.dados && typeof r.dados === "object" && "pergunta" in r.dados
                    ? String((r.dados as { pergunta?: string }).pergunta)
                    : r.dados && typeof r.dados === "object" && "frase" in r.dados
                      ? String((r.dados as { frase?: string }).frase)
                      : ""}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Cartao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs font-medium text-muted-foreground">{titulo}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
