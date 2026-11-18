"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Camera, Check, Flag, Lightbulb, Loader2, RotateCcw, X } from "lucide-react";
import { ETAPAS, MELHORIAS, type Conceito, type Etapa, type ResumoAtividade, type VistaEstudo } from "@/lib/study/tipos";
import { guardarEstudo, reduzir } from "@/components/study/guardados";
import { cn } from "@/lib/utils";

// O estudo, um ecrã de cada vez: a leitura das páginas, o plano, as
// atividades das quatro etapas, o relatório de cada etapa e o relatório final.
// O trabalho da IA corre no servidor; aqui pergunta-se pelo estado enquanto
// há alguma coisa a ser preparada ou corrigida.

type Acao = (acao: string, extra?: Record<string, unknown>) => Promise<void>;

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

  const acao: Acao = async (acao, extra = {}) => {
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
  };

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
  else if (v.estado === "fotos") conteudo = <FotosNovas v={v} aEnviar={aEnviar} acao={acao} />;
  else if (v.estado === "a_planear") conteudo = <Espera texto="A preparar o plano de estudo" nota="Falta pouco." progresso={1} />;
  else if (v.estado === "erro" || !v.plano) conteudo = <Aviso titulo="Não foi possível" texto={v.erro || "Alguma coisa correu mal."} novo />;
  else if (!comecou && v.atual === 0 && !v.resumo.some((r) => r.respondida))
    conteudo = <PlanoEstudo v={v} onComecar={() => setComecou(true)} />;
  else if (v.pausa !== null)
    conteudo = <RelatorioEtapa v={v} etapa={v.pausa} aEnviar={aEnviar} onContinuar={() => acao("fechar")} />;
  else if (v.atual >= v.total) conteudo = <RelatorioFinal v={v} />;
  else conteudo = <Atividade key={v.atividade?.id} v={v} aEnviar={aEnviar} acao={acao} />;

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

// ---------- Páginas que não se leram ----------

function FotosNovas({ v, aEnviar, acao }: { v: VistaEstudo; aEnviar: boolean; acao: Acao }) {
  const [novas, setNovas] = useState<Record<number, File>>({});
  const input = useRef<HTMLInputElement>(null);
  const [pagina, setPagina] = useState<number | null>(null);
  const [aPreparar, setAPreparar] = useState(false);

  async function enviar() {
    setAPreparar(true);
    try {
      const fotos = await Promise.all(Object.entries(novas).map(async ([p, f]) => ({ pagina: Number(p), imagem: await reduzir(f) })));
      await acao("fotos", { fotos });
    } finally {
      setAPreparar(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
        <h1 className="text-xl font-bold">Não consegui ler {v.ilegiveis.length === 1 ? "uma página" : `${v.ilegiveis.length} páginas`}</h1>
        <p className="mt-2 leading-relaxed">
          Tira outra fotografia {v.ilegiveis.length === 1 ? "da página" : "das páginas"} {v.ilegiveis.join(", ")}: a página inteira,
          direita, com boa luz e sem sombras.
        </p>
      </div>
      <ul className="space-y-2">
        {v.ilegiveis.map((p) => (
          <li key={p} className="flex items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-card p-3">
            <span className="font-medium">Página {p}</span>
            {novas[p] ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
                <Check className="size-4" /> Fotografia nova
              </span>
            ) : (
              <button
                type="button"
                onClick={() => (setPagina(p), input.current?.click())}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white"
              >
                <Camera className="size-4" /> Fotografar
              </button>
            )}
          </li>
        ))}
      </ul>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && pagina) setNovas((a) => ({ ...a, [pagina]: f }));
          e.target.value = "";
        }}
      />
      <BotaoPrincipal disabled={Object.keys(novas).length === 0 || aEnviar || aPreparar} onClick={enviar}>
        {aPreparar || aEnviar ? <Loader2 className="size-5 animate-spin" /> : null}
        Ler as fotografias novas
      </BotaoPrincipal>
      <button
        type="button"
        disabled={aEnviar}
        onClick={() => acao("seguir")}
        className="flex h-11 w-full items-center justify-center rounded-xl border border-foreground/15 text-sm font-medium"
      >
        Continuar sem {v.ilegiveis.length === 1 ? "essa página" : "essas páginas"}
      </button>
    </div>
  );
}

// ---------- O plano ----------

function PlanoEstudo({ v, onComecar }: { v: VistaEstudo; onComecar: () => void }) {
  const plano = v.plano!;
  const total = v.previstas.reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{plano.tema || "O teu estudo"}</h1>
        {plano.resumo ? <p className="mt-2 leading-relaxed text-muted-foreground">{plano.resumo}</p> : null}
      </div>
      {plano.ilegiveis.length > 0 ? (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          O estudo não inclui {plano.ilegiveis.length === 1 ? "a página" : "as páginas"} {plano.ilegiveis.join(", ")}, que não consegui ler.
        </p>
      ) : null}
      <section className="rounded-2xl border border-foreground/10 bg-card p-5">
        <h2 className="font-semibold">Matéria identificada</h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Disciplina</dt>
          <dd>{plano.disciplina || "Não identificada"}</dd>
          <dt className="text-muted-foreground">Ano</dt>
          <dd>{plano.ano || "Não identificado"}</dd>
          <dt className="text-muted-foreground">Tema</dt>
          <dd>{plano.tema}</dd>
        </dl>
        <h3 className="mt-4 text-sm font-semibold">Subtemas</h3>
        <ol className="mt-2 space-y-2">
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
      <section className="rounded-2xl border border-foreground/10 bg-card p-5">
        <h2 className="font-semibold">Plano de estudo</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pb-2 font-medium">Etapa</th>
              <th className="pb-2 text-right font-medium">Atividades previstas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/10">
            {ETAPAS.map((e, i) => (
              <tr key={e}>
                <td className="py-2">{e}</td>
                <td className="py-2 text-right font-semibold">{v.previstas[i]}</td>
              </tr>
            ))}
            <tr>
              <td className="py-2 font-semibold">Total</td>
              <td className="py-2 text-right font-bold">{total}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <p className="text-sm text-muted-foreground">
        As perguntas ficam mais difíceis quando acertas. Se errares, aparecem mais atividades sobre esse tema. Só passas à etapa seguinte
        quando acabares a anterior.
      </p>
      <BotaoPrincipal onClick={onComecar}>Começar a estudar</BotaoPrincipal>
    </div>
  );
}

// ---------- Uma atividade ----------

function Etapas({ v, etapa }: { v: VistaEstudo; etapa: Etapa }) {
  const daEtapa = v.resumo.filter((r) => r.etapa === etapa);
  const feitas = daEtapa.filter((r) => r.respondida).length;
  const extra = daEtapa.length - v.previstas[etapa];
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
        <span className="shrink-0">
          {Math.min(feitas + 1, daEtapa.length)} de {daEtapa.length}
          {extra > 0 ? ` (+${extra} de reforço)` : ""}
        </span>
      </div>
    </div>
  );
}

function Reportar({ atividadeId, aEnviar, acao, respondida }: { atividadeId: string; aEnviar: boolean; acao: Acao; respondida: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [feito, setFeito] = useState(false);
  const motivos = ["A pergunta tem mais do que uma resposta certa", "A pergunta não é sobre a matéria", "A explicação ou a correção está errada", "A imagem não tem a ver"];
  if (feito) return <p className="text-center text-xs text-muted-foreground">Obrigado, ficou registado.</p>;
  if (!aberto)
    return (
      <button type="button" onClick={() => setAberto(true)} className="mx-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <Flag className="size-3.5" /> Há um erro nesta atividade
      </button>
    );
  return (
    <div className="rounded-xl border border-foreground/10 p-3">
      <p className="text-sm font-medium">O que está errado?{respondida ? "" : " Troco-a por outra."}</p>
      <div className="mt-2 flex flex-col gap-1.5">
        {motivos.map((m) => (
          <button
            key={m}
            type="button"
            disabled={aEnviar}
            onClick={async () => {
              await acao("reportar", { atividadeId, motivo: m });
              setFeito(true);
            }}
            className="rounded-lg border border-foreground/10 px-3 py-2 text-left text-sm hover:bg-muted/60"
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

function Atividade({ v, aEnviar, acao }: { v: VistaEstudo; aEnviar: boolean; acao: Acao }) {
  const a = v.atividade!;
  const [escolha, setEscolha] = useState<number | null>(null);
  const [texto, setTexto] = useState("");
  const [dica, setDica] = useState(false);

  // Ao melhorar a resposta, a caixa começa com a resposta anterior.
  const tentativa = a.anteriores?.length ?? 0;
  useEffect(() => {
    if (a.estado === "pronta" && tentativa > 0) setTexto(a.anteriores![tentativa - 1].resposta);
  }, [a.estado, tentativa, a.anteriores]);

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
    const podeMelhorar = d.tipo === "aberta" && respondida && !a.certo && tentativa < MELHORIAS;
    corpo = (
      <div className="space-y-5">
        {d.tipo === "explicacao" ? (
          <section className="overflow-hidden rounded-2xl border border-foreground/10 bg-card">
            {d.imagem ? (
              <figure className="border-b border-foreground/10 bg-muted/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.imagem.url} alt={d.imagem.legenda || d.titulo || ""} className="max-h-80 w-full object-contain" loading="lazy" />
                <figcaption className="px-4 py-2 text-xs text-muted-foreground">
                  {d.imagem.legenda ? <span>{d.imagem.legenda}. </span> : null}
                  <a href={d.imagem.pagina} target="_blank" rel="noopener noreferrer" className="underline">
                    Wikimedia Commons
                  </a>
                  {d.imagem.autor ? `, ${d.imagem.autor}` : ""}
                  {d.imagem.licenca ? `, ${d.imagem.licenca}` : ""}
                </figcaption>
              </figure>
            ) : null}
            <div className="p-5">
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
            </div>
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
                    <span
                      className={cn(
                        "mx-1 inline-block min-w-20 border-b-2 px-1 text-center",
                        respondida ? (a.certo ? "border-emerald-500 text-emerald-600" : "border-red-500 text-red-600") : "border-indigo-600 text-indigo-600",
                      )}
                    >
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
            {a.estado === "pronta" && tentativa > 0 ? (
              <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm leading-relaxed">
                <div className="font-medium">O que faltava na resposta anterior</div>
                <p className="mt-1">{a.anteriores![tentativa - 1].feedback}</p>
              </div>
            ) : null}
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
                  {tentativa > 0 ? "Enviar a resposta melhorada" : "Responder"}
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
            <p className="font-semibold">{a.certo ? "Certo." : a.parcial ? "Está incompleta." : "Ainda não."}</p>
            {d.tipo === "completar" && !a.certo && d.resposta ? (
              <p className="mt-1">
                A resposta era <strong>{d.resposta}</strong>.
              </p>
            ) : null}
            {a.feedback ? <p className="mt-1 leading-relaxed">{a.feedback}</p> : null}
            {d.tipo === "aberta" && d.modelo && !podeMelhorar ? (
              <div className="mt-3 rounded-xl bg-background/60 p-3 text-sm leading-relaxed">
                <div className="font-medium">Uma boa resposta</div>
                <p className="mt-1">{d.modelo}</p>
              </div>
            ) : null}
            {!a.certo && !a.extra && d.tipo !== "aberta" ? (
              <p className="mt-2 text-sm text-muted-foreground">Vais ter mais uma atividade sobre este tema no fim desta etapa.</p>
            ) : null}
          </section>
        ) : null}

        {podeMelhorar ? (
          <BotaoPrincipal disabled={aEnviar} onClick={() => acao("melhorar", { atividadeId: a.id })}>
            Melhorar a resposta
          </BotaoPrincipal>
        ) : null}
        {respondida ? (
          <button
            type="button"
            disabled={aEnviar}
            onClick={() => acao("avancar", { atividadeId: a.id })}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold transition disabled:opacity-40",
              podeMelhorar ? "border border-foreground/15" : "bg-indigo-600 text-white hover:bg-indigo-500",
            )}
          >
            {podeMelhorar ? "Continuar sem melhorar" : "Continuar"} <ArrowRight className="size-5" />
          </button>
        ) : null}

        {!aCorrigir ? <Reportar atividadeId={a.id} aEnviar={aEnviar} acao={acao} respondida={respondida} /> : null}
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

const pct = (certas: number, total: number) => (total ? Math.round((certas / total) * 100) : 0);

function contas(l: ResumoAtividade[]) {
  const feitas = l.filter((r) => r.respondida);
  return { feitas: feitas.length, certas: feitas.filter((r) => r.certo).length };
}

function porConceito(v: VistaEstudo, etapas?: Etapa[]) {
  return v.plano!.conceitos.map((c) => {
    const l = v.resumo.filter((r) => r.respondida && r.conceitos.includes(c.id) && (!etapas || etapas.includes(r.etapa)));
    return { conceito: c, total: l.length, certas: l.filter((r) => r.certo).length };
  });
}

function RelatorioEtapa({ v, etapa, aEnviar, onContinuar }: { v: VistaEstudo; etapa: Etapa; aEnviar: boolean; onContinuar: () => void }) {
  const l = v.resumo.filter((r) => r.etapa === etapa);
  const { feitas, certas } = contas(l);
  const reforco = l.filter((r) => r.extra).length;
  const conceitos = porConceito(v, [etapa]).filter((x) => x.total > 0);
  const dominados = conceitos.filter((x) => x.certas === x.total);
  const dificuldades = conceitos.filter((x) => x.certas < x.total);
  // Evolução: a primeira metade da etapa comparada com a segunda.
  const respondidas = l.filter((r) => r.respondida);
  const meio = Math.ceil(respondidas.length / 2);
  const inicio = contas(respondidas.slice(0, meio));
  const fim = contas(respondidas.slice(meio));
  const ultima = v.atual >= v.total;
  const p = pct(certas, feitas);
  const recomendacao = ultima
    ? "Acabaste as quatro etapas. Vê no relatório final o que dominas e o que ainda deves rever."
    : p >= 80
      ? `Estás preparado para a etapa ${ETAPAS[etapa + 1]}.`
      : `Antes de ${ETAPAS[etapa + 1]}, relê no manual: ${dificuldades.map((x) => x.conceito.nome).join(", ")}. A etapa seguinte volta a estes temas.`;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-foreground/10 bg-card p-6 text-center">
        <p className="text-sm font-medium text-indigo-600">Etapa {etapa + 1} de 4 acabada</p>
        <h1 className="mt-1 text-2xl font-bold">{ETAPAS[etapa]}</h1>
        <p className="mt-4 text-5xl font-bold">{p}%</p>
        <p className="mt-1 text-muted-foreground">
          {certas} certas em {feitas}
        </p>
      </div>
      <section className="grid grid-cols-3 gap-2 text-center">
        <Numero valor={v.previstas[etapa]} nome="Previstas" />
        <Numero valor={feitas} nome="Realizadas" />
        <Numero valor={reforco} nome="De reforço" />
      </section>
      {fim.feitas > 0 ? (
        <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm">
          Evolução: começaste com {pct(inicio.certas, inicio.feitas)}% de respostas certas e acabaste com {pct(fim.certas, fim.feitas)}%.
        </p>
      ) : null}
      <section className="rounded-2xl border border-foreground/10 bg-card p-5">
        <h2 className="font-semibold">Temas abordados</h2>
        <ListaConceitos titulo="Dominados" itens={dominados.map((x) => x.conceito.nome)} cor="text-emerald-600" />
        <ListaConceitos titulo="Com dificuldades" itens={dificuldades.map((x) => x.conceito.nome)} cor="text-red-600" />
      </section>
      <p className="rounded-xl border border-indigo-600/20 bg-indigo-600/5 px-4 py-3 text-sm leading-relaxed">{recomendacao}</p>
      <BotaoPrincipal disabled={aEnviar} onClick={onContinuar}>
        {ultima ? "Ver o relatório final" : `Continuar para ${ETAPAS[etapa + 1]}`} <ArrowRight className="size-5" />
      </BotaoPrincipal>
    </div>
  );
}

function Numero({ valor, nome }: { valor: number | string; nome: string }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-card/60 p-3">
      <div className="text-2xl font-bold">{valor}</div>
      <div className="text-xs text-muted-foreground">{nome}</div>
    </div>
  );
}

function ListaConceitos({ titulo, itens, cor }: { titulo: string; itens: string[]; cor: string }) {
  if (itens.length === 0) return null;
  return (
    <div className="mt-3">
      <div className={cn("text-sm font-medium", cor)}>{titulo}</div>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
        {itens.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}

// O relatório final separa as três coisas que o Pedro pediu: reconhecer (escolha
// múltipla), compreender (completar) e dominar (explicar por palavras suas).
const DIMENSOES: { nome: string; etapas: Etapa[]; texto: string }[] = [
  { nome: "Reconhecimento", etapas: [0, 1], texto: "Identificar a resposta certa entre várias opções." },
  { nome: "Compreensão", etapas: [2], texto: "Completar frases e recuperar os conceitos sem ajuda." },
  { nome: "Domínio", etapas: [3], texto: "Explicar a matéria por palavras tuas." },
];

function RelatorioFinal({ v }: { v: VistaEstudo }) {
  const dims = DIMENSOES.map((d) => {
    const c = contas(v.resumo.filter((r) => d.etapas.includes(r.etapa)));
    return { ...d, p: pct(c.certas, c.feitas), ...c };
  });
  const nivel = (x: { total: number; certas: number }) => (x.total === 0 ? null : x.certas === x.total ? "ok" : x.certas / x.total >= 0.5 ? "meio" : "mal");
  const linhas = v.plano!.conceitos.map((c) => ({
    conceito: c,
    dims: DIMENSOES.map((d) => nivel(porConceito(v, d.etapas).find((x) => x.conceito.id === c.id)!)),
  }));
  const rever = linhas.filter((l) => l.dims[2] !== "ok" || l.dims[1] !== "ok").map((l) => l.conceito.nome);
  const previstas = v.previstas.reduce((a, b) => a + b, 0);
  const feitas = contas(v.resumo).feitas;
  const reconhecimentoAlto = dims[0].p - dims[2].p >= 30;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-foreground/10 bg-card p-6 text-center">
        <p className="text-sm font-medium text-indigo-600">Estudo acabado</p>
        <h1 className="mt-1 text-2xl font-bold">{v.plano!.tema || "O teu estudo"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {feitas} atividades realizadas, {previstas} previstas no plano e {Math.max(0, v.total - previstas)} de reforço.
        </p>
      </div>
      <section className="space-y-2">
        {dims.map((d) => (
          <div key={d.nome} className="rounded-xl border border-foreground/10 bg-card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{d.nome}</span>
              <span className="text-xl font-bold">{d.p}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-indigo-600" style={{ width: `${d.p}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {d.texto} {d.certas} certas em {d.feitas}.
            </p>
          </div>
        ))}
      </section>
      {reconhecimentoAlto ? (
        <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm leading-relaxed">
          Acertas bem quando tens opções, mas ainda custa explicar por palavras tuas. Reconhecer a resposta não é o mesmo que dominar a
          matéria: treina a explicar os temas em voz alta.
        </p>
      ) : null}
      <section className="rounded-2xl border border-foreground/10 bg-card p-5">
        <h2 className="font-semibold">Tema a tema</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="pb-2 text-left font-medium" />
              {DIMENSOES.map((d) => (
                <th key={d.nome} className="pb-2 font-medium">
                  {d.nome.slice(0, 6)}.
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/10">
            {linhas.map((l) => (
              <tr key={l.conceito.id}>
                <td className="py-2 pr-2">{l.conceito.nome}</td>
                {l.dims.map((n, i) => (
                  <td key={i} className="py-2 text-center">
                    {n === "ok" ? (
                      <Check className="mx-auto size-4 text-emerald-600" />
                    ) : n === "meio" ? (
                      <span className="text-amber-600">~</span>
                    ) : n === "mal" ? (
                      <X className="mx-auto size-4 text-red-600" />
                    ) : (
                      <span className="text-muted-foreground">·</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="rounded-xl border border-indigo-600/20 bg-indigo-600/5 px-4 py-3 text-sm leading-relaxed">
        {rever.length ? `Para rever: ${rever.join(", ")}.` : "Dominas todos os temas desta matéria."}
      </p>
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
