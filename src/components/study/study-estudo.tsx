"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Check, Lightbulb, Loader2, RotateCcw, X } from "lucide-react";
import { ETAPAS, type Conceito, type Etapa, type VistaEstudo } from "@/lib/study/tipos";
import { guardarEstudo } from "@/components/study/guardados";
import { cn } from "@/lib/utils";

// O estudo, um ecrã de cada vez: a leitura das páginas, o plano, as
// atividades das quatro etapas, o relatório de cada etapa e o relatório final.
// O trabalho da IA corre no servidor; aqui pergunta-se pelo estado enquanto
// há alguma coisa a ser preparada ou corrigida.

function precisaDeEsperar(v: VistaEstudo | null) {
  if (!v) return true;
  if (v.estado === "a_ler" || v.estado === "a_planear") return true;
  if (v.estado !== "pronto" || v.pausa !== null || v.atual >= v.total) return false;
  const a = v.atividade;
  return !a || a.estado === "por_gerar" || a.estado === "a_corrigir";
}

export function StudyEstudo({ id }: { id: string }) {
  const [v, setV] = useState<VistaEstudo | null>(null);
  const [naoExiste, setNaoExiste] = useState(false);
  const [comecou, setComecou] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/study/${id}`, { cache: "no-store" }).catch(() => null);
    if (!r) return;
    if (r.status === 404) return setNaoExiste(true);
    if (r.ok) setV(await r.json());
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const esperar = precisaDeEsperar(v);
  useEffect(() => {
    if (!esperar || naoExiste) return;
    const t = setInterval(() => void carregar(), 2500);
    return () => clearInterval(t);
  }, [esperar, naoExiste, carregar]);

  useEffect(() => {
    if (v?.plano?.tema) guardarEstudo({ id, criado: Date.now(), tema: v.plano.tema });
  }, [id, v?.plano?.tema]);

  async function acao(acao: string, extra: Record<string, string> = {}) {
    setAEnviar(true);
    setErro(null);
    try {
      const r = await fetch(`/api/study/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, ...extra }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || "Não foi possível.");
      setV(d);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível.");
      void carregar();
    } finally {
      setAEnviar(false);
    }
  }

  let conteudo: React.ReactNode;
  if (naoExiste) conteudo = <Aviso titulo="Este estudo não existe" texto="O link pode estar errado ou o estudo foi apagado." novo />;
  else if (!v) conteudo = <Espera texto="A abrir o estudo" />;
  else if (v.estado === "a_ler")
    conteudo = (
      <Espera
        texto={`A ler a página ${Math.min(v.lidas + 1, v.paginas)} de ${v.paginas}`}
        nota="Cada página demora cerca de um minuto. Podes deixar esta página aberta ou voltar mais tarde: o estudo fica neste aparelho."
        progresso={v.lidas / v.paginas}
      />
    );
  else if (v.estado === "a_planear") conteudo = <Espera texto="A preparar o plano de estudo" nota="Falta pouco." progresso={1} />;
  else if (v.estado === "erro" || !v.plano) conteudo = <Aviso titulo="Não foi possível" texto={v.erro || "Alguma coisa correu mal."} novo />;
  else if (!comecou && v.atual === 0 && !v.resumo.some((r) => r.respondida))
    conteudo = <PlanoEstudo v={v} onComecar={() => setComecou(true)} />;
  else if (v.pausa !== null)
    conteudo = <RelatorioEtapa v={v} etapa={v.pausa} aEnviar={aEnviar} onContinuar={() => acao("fechar")} />;
  else if (v.atual >= v.total) conteudo = <RelatorioFinal v={v} />;
  else conteudo = <Atividade v={v} aEnviar={aEnviar} acao={acao} />;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/study" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
          <BookOpen className="size-4" />
          Snaptie Study
        </Link>
        {v?.plano && v.estado === "pronto" ? (
          <div className="mt-2 truncate text-sm text-muted-foreground">
            {[v.plano.disciplina, v.plano.ano, v.plano.tema].filter(Boolean).join(" · ")}
          </div>
        ) : null}
        {erro ? <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600">{erro}</p> : null}
        <div className="mt-6">{conteudo}</div>
      </div>
    </main>
  );
}

// ---------- Ecrãs de espera e avisos ----------

function Espera({ texto, nota, progresso }: { texto: string; nota?: string; progresso?: number }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-card p-8 text-center">
      <Loader2 className="mx-auto size-8 animate-spin text-indigo-600" />
      <p className="mt-4 text-lg font-semibold">{texto}</p>
      {progresso !== undefined ? (
        <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${Math.max(5, progresso * 100)}%` }} />
        </div>
      ) : null}
      {nota ? <p className="mt-4 text-sm text-muted-foreground">{nota}</p> : null}
    </div>
  );
}

function Aviso({ titulo, texto, novo }: { titulo: string; texto: string; novo?: boolean }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-card p-8 text-center">
      <p className="text-lg font-semibold">{titulo}</p>
      <p className="mt-2 text-muted-foreground">{texto}</p>
      {novo ? (
        <Link href="/study" className="mt-6 inline-flex h-11 items-center rounded-xl bg-foreground px-5 font-semibold text-background">
          Fazer um estudo novo
        </Link>
      ) : null}
    </div>
  );
}

// ---------- O plano ----------

function contarPorEtapa(v: VistaEstudo) {
  return ETAPAS.map((_, e) => v.resumo.filter((r) => r.etapa === e).length);
}

function PlanoEstudo({ v, onComecar }: { v: VistaEstudo; onComecar: () => void }) {
  const plano = v.plano!;
  const n = contarPorEtapa(v);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{plano.tema || "O teu estudo"}</h1>
        {plano.resumo ? <p className="mt-2 leading-relaxed text-muted-foreground">{plano.resumo}</p> : null}
      </div>
      {plano.ilegiveis.length > 0 ? (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          Não consegui ler {plano.ilegiveis.length === 1 ? "a página" : "as páginas"} {plano.ilegiveis.join(", ")}. O estudo usa
          só as outras.
        </p>
      ) : null}
      <section className="rounded-2xl border border-foreground/10 bg-card p-5">
        <h2 className="font-semibold">O que vais aprender</h2>
        <ol className="mt-3 space-y-2">
          {plano.conceitos.map((c, i) => (
            <li key={c.id} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-600/10 text-xs font-semibold text-indigo-600">
                {i + 1}
              </span>
              <span>{c.nome}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ETAPAS.map((e, i) => (
          <div key={e} className="rounded-xl border border-foreground/10 bg-card/60 p-3 text-center">
            <div className="text-2xl font-bold">{n[i]}</div>
            <div className="text-sm text-muted-foreground">{e}</div>
          </div>
        ))}
      </section>
      <p className="text-sm text-muted-foreground">
        Se errares, aparecem mais atividades sobre esse tema. Só passas à etapa seguinte quando acabares a anterior.
      </p>
      <BotaoPrincipal onClick={onComecar}>Começar a estudar</BotaoPrincipal>
    </div>
  );
}

// ---------- Uma atividade ----------

function Etapas({ v, etapa }: { v: VistaEstudo; etapa: Etapa }) {
  const daEtapa = v.resumo.filter((r) => r.etapa === etapa);
  const feitas = daEtapa.filter((r) => r.respondida).length;
  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5">
        {ETAPAS.map((e, i) => (
          <div key={e} className={cn("text-center text-xs font-medium", i === etapa ? "text-foreground" : "text-muted-foreground")}>
            <div className={cn("mb-1.5 h-1.5 rounded-full", i < etapa ? "bg-indigo-600" : i === etapa ? "bg-indigo-600/40" : "bg-muted")} />
            {e}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${(feitas / Math.max(1, daEtapa.length)) * 100}%` }} />
        </div>
        {feitas + 1 > daEtapa.length ? daEtapa.length : feitas + 1} de {daEtapa.length}
      </div>
    </div>
  );
}

function Atividade({ v, aEnviar, acao }: { v: VistaEstudo; aEnviar: boolean; acao: (a: string, e?: Record<string, string>) => void }) {
  const a = v.atividade!;
  const [escolha, setEscolha] = useState<number | null>(null);
  const [texto, setTexto] = useState("");
  const [dica, setDica] = useState(false);

  useEffect(() => {
    setEscolha(null);
    setTexto("");
    setDica(false);
  }, [a.id]);

  const conceitos = a.conceitos
    .map((c) => v.plano!.conceitos.find((x) => x.id === c))
    .filter((c): c is Conceito => Boolean(c))
    .map((c) => c.nome)
    .join(" e ");

  let corpo: React.ReactNode;
  if (a.estado === "por_gerar")
    corpo = <Espera texto="A preparar a atividade" nota={a.extra ? "Mais uma sobre este tema, para ficar bem sabido." : undefined} />;
  else if (a.estado === "erro")
    corpo = (
      <div className="rounded-2xl border border-foreground/10 bg-card p-6 text-center">
        <p className="font-semibold">Não consegui preparar esta atividade.</p>
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" disabled={aEnviar} onClick={() => acao("repetir", { atividadeId: a.id })} className="inline-flex h-10 items-center gap-2 rounded-xl border border-foreground/15 px-4">
            <RotateCcw className="size-4" /> Tentar de novo
          </button>
          <button type="button" disabled={aEnviar} onClick={() => acao("avancar", { atividadeId: a.id })} className="h-10 rounded-xl bg-foreground px-4 text-background">
            Saltar
          </button>
        </div>
      </div>
    );
  else {
    const d = a.dados!;
    const respondida = a.estado === "corrigida";
    const aCorrigir = a.estado === "a_corrigir";
    corpo = (
      <div className="space-y-5">
        {d.tipo === "explicacao" ? (
          <section className="rounded-2xl border border-foreground/10 bg-card p-5">
            <h2 className="text-xl font-bold">{d.titulo}</h2>
            <div className="mt-3 space-y-3 leading-relaxed">
              {(d.explicacao ?? "").split(/\n\s*\n/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            {d.exemplo ? (
              <div className="mt-4 flex gap-3 rounded-xl bg-indigo-600/10 p-3 text-sm leading-relaxed">
                <Lightbulb className="size-5 shrink-0 text-indigo-600" />
                <p>{d.exemplo}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        {d.tipo === "explicacao" || d.tipo === "escolha" ? (
          <section>
            <p className="text-lg font-semibold leading-snug">{d.pergunta}</p>
            <div className="mt-3 space-y-2">
              {(d.opcoes ?? []).map((o, i) => {
                const escolhida = respondida ? Number(a.resposta) === i : escolha === i;
                const certa = respondida && d.correta === i;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={respondida || aEnviar}
                    onClick={() => setEscolha(i)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition",
                      certa
                        ? "border-emerald-500 bg-emerald-500/10"
                        : respondida && escolhida
                          ? "border-red-500 bg-red-500/10"
                          : escolhida
                            ? "border-indigo-600 bg-indigo-600/10"
                            : "border-foreground/15 hover:bg-muted/60",
                    )}
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-current/30 text-xs font-semibold">
                      {certa ? <Check className="size-3.5" /> : respondida && escolhida ? <X className="size-3.5" /> : "ABCD"[i]}
                    </span>
                    {o}
                  </button>
                );
              })}
            </div>
            {!respondida ? (
              <BotaoPrincipal className="mt-4" disabled={escolha === null || aEnviar} onClick={() => acao("responder", { atividadeId: a.id, resposta: String(escolha) })}>
                Responder
              </BotaoPrincipal>
            ) : null}
          </section>
        ) : null}

        {d.tipo === "completar" ? (
          <section>
            <p className="text-sm font-medium text-muted-foreground">Completa a frase.</p>
            <p className="mt-2 text-lg font-semibold leading-relaxed">
              {(d.frase ?? "").split("____").map((parte, i, l) => (
                <span key={i}>
                  {parte}
                  {i < l.length - 1 ? (
                    <span className={cn("mx-1 inline-block min-w-20 border-b-2 px-1 text-center", respondida ? (a.certo ? "border-emerald-500 text-emerald-600" : "border-red-500 text-red-600") : "border-indigo-600 text-indigo-600")}>
                      {respondida || aCorrigir ? a.resposta : texto || " "}
                    </span>
                  ) : null}
                </span>
              ))}
            </p>
            {!respondida && !aCorrigir ? (
              <>
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && texto.trim() && acao("responder", { atividadeId: a.id, resposta: texto })}
                  autoFocus
                  autoComplete="off"
                  placeholder="A palavra que falta"
                  className="mt-4 h-12 w-full rounded-xl border border-foreground/15 bg-background px-4 text-lg outline-none focus:border-indigo-500"
                />
                {d.dica ? (
                  dica ? (
                    <p className="mt-2 text-sm text-muted-foreground">Dica: {d.dica}</p>
                  ) : (
                    <button type="button" onClick={() => setDica(true)} className="mt-2 text-sm text-indigo-600">
                      Ver uma dica
                    </button>
                  )
                ) : null}
                <BotaoPrincipal className="mt-4" disabled={!texto.trim() || aEnviar} onClick={() => acao("responder", { atividadeId: a.id, resposta: texto })}>
                  Responder
                </BotaoPrincipal>
              </>
            ) : null}
          </section>
        ) : null}

        {d.tipo === "aberta" ? (
          <section>
            <p className="text-sm font-medium text-muted-foreground">Responde por palavras tuas.</p>
            <p className="mt-2 text-lg font-semibold leading-snug">{d.pergunta}</p>
            {!respondida && !aCorrigir ? (
              <>
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={5}
                  autoFocus
                  placeholder="Escreve aqui a tua resposta"
                  className="mt-4 w-full rounded-xl border border-foreground/15 bg-background p-4 leading-relaxed outline-none focus:border-indigo-500"
                />
                <BotaoPrincipal className="mt-3" disabled={texto.trim().length < 3 || aEnviar} onClick={() => acao("responder", { atividadeId: a.id, resposta: texto })}>
                  Responder
                </BotaoPrincipal>
              </>
            ) : (
              <blockquote className="mt-3 rounded-xl border border-foreground/10 bg-muted/40 p-4 leading-relaxed">{a.resposta}</blockquote>
            )}
          </section>
        ) : null}

        {aCorrigir ? <Espera texto="A corrigir a tua resposta" /> : null}

        {respondida ? (
          <section
            className={cn(
              "rounded-2xl border p-4",
              a.certo ? "border-emerald-500/40 bg-emerald-500/10" : a.parcial ? "border-amber-500/40 bg-amber-500/10" : "border-red-500/40 bg-red-500/10",
            )}
          >
            <p className="font-semibold">{a.certo ? "Muito bem!" : a.parcial ? "Quase. Falta uma parte." : "Ainda não."}</p>
            {d.tipo === "completar" && !a.certo && d.resposta ? (
              <p className="mt-1">
                A resposta era <strong>{d.resposta}</strong>.
              </p>
            ) : null}
            {a.feedback ? <p className="mt-1 leading-relaxed">{a.feedback}</p> : null}
            {d.tipo === "aberta" && d.modelo ? (
              <div className="mt-3 rounded-xl bg-background/60 p-3 text-sm leading-relaxed">
                <div className="font-medium">Uma boa resposta</div>
                <p className="mt-1">{d.modelo}</p>
              </div>
            ) : null}
            {!a.certo && !a.extra ? (
              <p className="mt-2 text-sm text-muted-foreground">Vais ter mais uma atividade sobre este tema no fim desta etapa.</p>
            ) : null}
          </section>
        ) : null}

        {respondida ? (
          <BotaoPrincipal disabled={aEnviar} onClick={() => acao("avancar", { atividadeId: a.id })}>
            Continuar <ArrowRight className="size-5" />
          </BotaoPrincipal>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Etapas v={v} etapa={a.etapa} />
      {conceitos ? <p className="text-sm font-medium text-indigo-600">{conceitos}</p> : null}
      {corpo}
    </div>
  );
}

// ---------- Relatórios ----------

function porConceito(v: VistaEstudo, etapa?: Etapa) {
  return v.plano!.conceitos.map((c) => {
    const l = v.resumo.filter((r) => r.respondida && r.conceitos.includes(c.id) && (etapa === undefined || r.etapa === etapa));
    return { conceito: c, total: l.length, certas: l.filter((r) => r.certo).length };
  });
}

function RelatorioEtapa({ v, etapa, aEnviar, onContinuar }: { v: VistaEstudo; etapa: Etapa; aEnviar: boolean; onContinuar: () => void }) {
  const l = v.resumo.filter((r) => r.etapa === etapa && r.respondida);
  const certas = l.filter((r) => r.certo).length;
  const rever = porConceito(v, etapa).filter((x) => x.total > 0 && x.certas < x.total);
  const ultima = v.atual >= v.total;
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-foreground/10 bg-card p-6 text-center">
        <p className="text-sm font-medium text-indigo-600">Etapa {etapa + 1} de 4 acabada</p>
        <h1 className="mt-1 text-2xl font-bold">{ETAPAS[etapa]}</h1>
        <p className="mt-4 text-5xl font-bold">
          {certas}
          <span className="text-2xl text-muted-foreground"> / {l.length}</span>
        </p>
        <p className="mt-1 text-muted-foreground">respostas certas</p>
      </div>
      {rever.length > 0 ? (
        <section className="rounded-2xl border border-foreground/10 bg-card p-5">
          <h2 className="font-semibold">Para rever</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {rever.map((x) => (
              <li key={x.conceito.id}>{x.conceito.nome}</li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-center text-muted-foreground">Acertaste em tudo nesta etapa.</p>
      )}
      <BotaoPrincipal disabled={aEnviar} onClick={onContinuar}>
        {ultima ? "Ver o relatório final" : `Continuar para ${ETAPAS[etapa + 1]}`} <ArrowRight className="size-5" />
      </BotaoPrincipal>
    </div>
  );
}

function RelatorioFinal({ v }: { v: VistaEstudo }) {
  const conceitos = porConceito(v);
  const etapas = ETAPAS.map((e, i) => {
    const l = v.resumo.filter((r) => r.etapa === i && r.respondida);
    return { nome: e, total: l.length, certas: l.filter((r) => r.certo).length };
  });
  const nivel = (x: { total: number; certas: number }) =>
    x.total === 0 ? null : x.certas === x.total ? "Dominado" : x.certas / x.total >= 0.6 ? "Quase" : "Rever";
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-foreground/10 bg-card p-6 text-center">
        <p className="text-sm font-medium text-indigo-600">Estudo acabado</p>
        <h1 className="mt-1 text-2xl font-bold">{v.plano!.tema || "O teu estudo"}</h1>
      </div>
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {etapas.map((e) => (
          <div key={e.nome} className="rounded-xl border border-foreground/10 bg-card/60 p-3 text-center">
            <div className="text-2xl font-bold">{e.total ? Math.round((e.certas / e.total) * 100) : 0}%</div>
            <div className="text-sm text-muted-foreground">{e.nome}</div>
          </div>
        ))}
      </section>
      <section className="rounded-2xl border border-foreground/10 bg-card p-5">
        <h2 className="font-semibold">Tema a tema</h2>
        <ul className="mt-3 divide-y divide-foreground/10">
          {conceitos.map((x) => {
            const n = nivel(x);
            return (
              <li key={x.conceito.id} className="flex items-center justify-between gap-3 py-2.5">
                <span>{x.conceito.nome}</span>
                {n ? (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      n === "Dominado" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : n === "Quase" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-red-500/15 text-red-700 dark:text-red-400",
                    )}
                  >
                    {n}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
      <Link href="/study" className="flex h-12 w-full items-center justify-center rounded-xl bg-foreground font-semibold text-background">
        Fazer outro estudo
      </Link>
    </div>
  );
}

function BotaoPrincipal({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}
