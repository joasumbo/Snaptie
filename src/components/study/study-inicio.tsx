"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Camera, ImagePlus, Loader2, X } from "lucide-react";
import { DESCRICAO_ETAPAS, ETAPAS } from "@/lib/study/tipos";
import { lerGuardados, guardarEstudo, type EstudoGuardado } from "@/components/study/guardados";

const MAX = 5;

// Reduz a fotografia no próprio telemóvel: a IA lê bem a 1600 px e o envio
// fica dez vezes mais leve.
async function reduzir(f: File): Promise<string> {
  const bmp = await createImageBitmap(f);
  const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * escala);
  c.height = Math.round(bmp.height * escala);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL("image/jpeg", 0.82).split(",")[1];
}

export function StudyInicio() {
  const router = useRouter();
  const [fotos, setFotos] = useState<{ ficheiro: File; url: string }[]>([]);
  const [codigo, setCodigo] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [guardados, setGuardados] = useState<EstudoGuardado[]>([]);
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setGuardados(lerGuardados());
    try {
      setCodigo(localStorage.getItem("study-codigo") ?? "");
    } catch {}
  }, []);

  function juntar(lista: FileList | null) {
    if (!lista) return;
    const novas = Array.from(lista)
      .filter((f) => f.type.startsWith("image/"))
      .map((ficheiro) => ({ ficheiro, url: URL.createObjectURL(ficheiro) }));
    setFotos((a) => [...a, ...novas].slice(0, MAX));
    setErro(null);
  }

  async function comecar() {
    setAEnviar(true);
    setErro(null);
    try {
      const imagens = await Promise.all(fotos.map((f) => reduzir(f.ficheiro)));
      const r = await fetch("/api/study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, imagens }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.id) throw new Error(d.erro || "Não foi possível começar. Tenta de novo.");
      try {
        localStorage.setItem("study-codigo", codigo);
      } catch {}
      guardarEstudo({ id: d.id, criado: Date.now() });
      router.push(`/study/${d.id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível começar.");
      setAEnviar(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-card/60 px-3 py-1 text-sm text-muted-foreground">
          <BookOpen className="size-4" />
          Snaptie Study
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Estuda a matéria do teu manual</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
          Fotografa as páginas que tens de estudar. O explicador lê-as, faz o plano e acompanha-te em quatro etapas até
          dominares tudo.
        </p>

        <ol className="mt-8 grid gap-2 sm:grid-cols-2">
          {ETAPAS.map((e, i) => (
            <li key={e} className="rounded-xl border border-foreground/10 bg-card/60 p-3">
              <div className="text-sm font-semibold">
                {i + 1}. {e}
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">{DESCRICAO_ETAPAS[i]}</div>
            </li>
          ))}
        </ol>

        <section className="mt-8 rounded-2xl border border-foreground/10 bg-card p-5">
          <h2 className="font-semibold">As páginas do manual</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Até {MAX} páginas do mesmo tema. Fotografa a página inteira, direita e com boa luz.
          </p>

          {fotos.length > 0 ? (
            <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {fotos.map((f, i) => (
                <li key={f.url} className="relative aspect-[3/4] overflow-hidden rounded-lg border border-foreground/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={`Página ${i + 1}`} className="size-full object-cover" />
                  <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white">{i + 1}</span>
                  <button
                    type="button"
                    aria-label="Tirar esta fotografia"
                    onClick={() => setFotos((a) => a.filter((x) => x.url !== f.url))}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {fotos.length < MAX ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => camara.current?.click()}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 font-medium text-white transition hover:bg-indigo-500"
              >
                <Camera className="size-5" />
                Tirar fotografia
              </button>
              <button
                type="button"
                onClick={() => galeria.current?.click()}
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-foreground/15 font-medium transition hover:bg-muted"
              >
                <ImagePlus className="size-5" />
                Escolher da galeria
              </button>
              <input ref={camara} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (juntar(e.target.files), (e.target.value = ""))} />
              <input ref={galeria} type="file" accept="image/*" multiple hidden onChange={(e) => (juntar(e.target.files), (e.target.value = ""))} />
            </div>
          ) : null}

          <label className="mt-5 block text-sm font-medium" htmlFor="codigo">
            Código de acesso
          </label>
          <input
            id="codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            autoComplete="off"
            className="mt-1.5 h-11 w-full rounded-xl border border-foreground/15 bg-background px-3 outline-none focus:border-indigo-500"
            placeholder="O código que te deram"
          />

          {erro ? <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600">{erro}</p> : null}

          <button
            type="button"
            disabled={fotos.length === 0 || aEnviar}
            onClick={comecar}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground font-semibold text-background transition disabled:opacity-40"
          >
            {aEnviar ? <Loader2 className="size-5 animate-spin" /> : null}
            {aEnviar ? "A enviar as fotografias" : "Começar o estudo"}
          </button>
        </section>

        {guardados.length > 0 ? (
          <section className="mt-8">
            <h2 className="font-semibold">Os teus estudos</h2>
            <ul className="mt-3 divide-y divide-foreground/10 rounded-2xl border border-foreground/10">
              {guardados.map((g) => (
                <li key={g.id}>
                  <Link href={`/study/${g.id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-muted/50">
                    <span className="truncate">{g.tema || "Estudo sem nome"}</span>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {new Date(g.criado).toLocaleDateString("pt-PT", { day: "numeric", month: "short" })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}
