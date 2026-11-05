"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Download, Play, X } from "lucide-react";

// Carrosséis da página pública: o de imagens (que pode passar sozinho) e o de
// vídeos, que abre em ecrã inteiro.

// O vídeo carrega só o necessário para mostrar o primeiro fotograma (#t=0.1);
// sem isto, no iPhone a caixa ficava branca até se carregar no play.
export function videoComFotograma(url: string): string {
  return url.includes("#") ? url : `${url}#t=0.1`;
}

export function CarrosselImagens({
  imagens,
  titulo,
  aspect,
  automatico,
  intervalo,
}: {
  imagens: string[];
  titulo: string;
  aspect: string;
  automatico: boolean;
  intervalo: number;
}) {
  const t = useTranslations("PublicPage");
  const faixa = useRef<HTMLDivElement>(null);
  const [atual, setAtual] = useState(0);
  // Quando o visitante desliza, a passagem automática pára um bocado: não se
  // tira a imagem que ele está a ver.
  const pausaAte = useRef(0);
  const muitas = imagens.length > 1;

  const irPara = useCallback((i: number) => {
    const el = faixa.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = faixa.current;
    if (!el) return;
    const aoDeslizar = () => setAtual(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener("scroll", aoDeslizar, { passive: true });
    return () => el.removeEventListener("scroll", aoDeslizar);
  }, []);

  useEffect(() => {
    if (!automatico || !muitas) return;
    const id = setInterval(() => {
      if (Date.now() < pausaAte.current || document.hidden) return;
      const el = faixa.current;
      if (!el) return;
      const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      irPara((i + 1) % imagens.length);
    }, Math.max(2, intervalo) * 1000);
    return () => clearInterval(id);
  }, [automatico, muitas, intervalo, imagens.length, irPara]);

  return (
    <div>
      <div
        ref={faixa}
        onPointerDown={() => (pausaAte.current = Date.now() + 8000)}
        onTouchStart={() => (pausaAte.current = Date.now() + 8000)}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none]"
      >
        {imagens.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt={`${titulo} ${i + 1}`}
            className={`${aspect} w-full shrink-0 snap-center rounded-xl object-cover`}
          />
        ))}
      </div>
      {muitas ? (
        automatico ? (
          // Com passagem automática, os pontos dizem onde se está e deixam saltar.
          <div className="mt-2 flex justify-center gap-1.5">
            {imagens.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${i + 1}`}
                onClick={() => {
                  pausaAte.current = Date.now() + 8000;
                  irPara(i);
                }}
                className={`h-1.5 rounded-full transition-all ${i === atual ? "w-4 bg-zinc-700" : "w-1.5 bg-zinc-300"}`}
              />
            ))}
          </div>
        ) : (
          <div className="mt-1.5 flex items-center justify-center gap-1 text-xs text-zinc-400">
            <ChevronLeft className="size-3.5" />
            <span>{t("swipeMore")}</span>
            <ChevronRight className="size-3.5" />
          </div>
        )
      ) : null}
    </div>
  );
}

export function CarrosselVideos({ videos, titulo }: { videos: string[]; titulo: string }) {
  const t = useTranslations("Elementos");
  const [aberto, setAberto] = useState<number | null>(null);

  return (
    <div className="text-left">
      {titulo ? <div className="mb-2 font-medium text-zinc-900">{titulo}</div> : null}
      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {videos.map((v, i) => (
          <button
            key={v}
            type="button"
            onClick={() => setAberto(i)}
            aria-label={t("videoAbrir", { n: i + 1 })}
            className="relative aspect-[9/16] w-[42%] shrink-0 snap-start overflow-hidden rounded-xl bg-zinc-900"
          >
            <video
              src={videoComFotograma(v)}
              preload="metadata"
              muted
              playsInline
              className="pointer-events-none size-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-black/45 text-white">
                <Play className="size-5 fill-current" />
              </span>
            </span>
          </button>
        ))}
      </div>
      {aberto !== null ? <EcraVideos videos={videos} inicio={aberto} onFechar={() => setAberto(null)} /> : null}
    </div>
  );
}

// Os vídeos em ecrã inteiro, um de cada vez: desliza-se para o lado para
// passar ao seguinte, e só o que está à vista toca.
function EcraVideos({ videos, inicio, onFechar }: { videos: string[]; inicio: number; onFechar: () => void }) {
  const t = useTranslations("Elementos");
  const faixa = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLVideoElement | null)[]>([]);
  const [atual, setAtual] = useState(inicio);
  // Guardado numa ref: a função muda a cada desenho do pai, e o efeito abaixo
  // só pode correr ao abrir (senão voltava a saltar para o primeiro vídeo).
  const fechar = useRef(onFechar);
  fechar.current = onFechar;

  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const el = faixa.current;
    if (el) el.scrollLeft = inicio * el.clientWidth;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar.current();
    window.addEventListener("keydown", tecla);
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener("keydown", tecla);
    };
  }, [inicio]);

  useEffect(() => {
    const el = faixa.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          const v = e.target as HTMLVideoElement;
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            setAtual(Number(v.dataset.i));
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        }
      },
      { root: el, threshold: [0, 0.6, 1] },
    );
    refs.current.forEach((v) => v && obs.observe(v));
    return () => obs.disconnect();
  }, []);

  const ir = (i: number) => {
    const el = faixa.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div ref={faixa} className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]">
        {videos.map((v, i) => (
          <div key={v} className="flex h-full w-full shrink-0 snap-center items-center justify-center">
            <video
              ref={(el) => {
                refs.current[i] = el;
              }}
              data-i={i}
              src={v}
              controls
              playsInline
              preload={Math.abs(i - inicio) <= 1 ? "auto" : "metadata"}
              className="max-h-full w-full object-contain"
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onFechar}
        aria-label={t("fechar")}
        className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-full bg-black/60 text-white"
        style={{ marginTop: "env(safe-area-inset-top)" }}
      >
        <X className="size-5" />
      </button>
      {videos.length > 1 ? (
        <>
          <div
            className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-sm text-white"
            style={{ marginTop: "env(safe-area-inset-top)" }}
          >
            {atual + 1} / {videos.length}
          </div>
          {atual > 0 ? (
            <button
              type="button"
              onClick={() => ir(atual - 1)}
              aria-label={t("anterior")}
              className="absolute left-2 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white sm:flex"
            >
              <ChevronLeft className="size-5" />
            </button>
          ) : null}
          {atual < videos.length - 1 ? (
            <button
              type="button"
              onClick={() => ir(atual + 1)}
              aria-label={t("seguinte")}
              className="absolute right-2 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white sm:flex"
            >
              <ChevronRight className="size-5" />
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// O QR da própria página, para quem o quiser guardar, imprimir ou partilhar.
export function DescarregarQr({ titulo, codigo }: { titulo: string; codigo?: string }) {
  const t = useTranslations("Elementos");
  return (
    <div className="rounded-xl border bg-white p-4 text-center">
      <div className="font-medium text-zinc-900">{titulo || t("qrTitle")}</div>
      {codigo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/qr/publico/${encodeURIComponent(codigo)}?format=svg`}
            alt=""
            className="mx-auto mt-3 size-40"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={`/api/qr/publico/${encodeURIComponent(codigo)}?format=png&download=1`}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium text-zinc-800"
            >
              <Download className="size-4" />
              PNG
            </a>
            <a
              href={`/api/qr/publico/${encodeURIComponent(codigo)}?format=svg&download=1`}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium text-zinc-800"
            >
              <Download className="size-4" />
              SVG
            </a>
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">{t("qrPreview")}</p>
      )}
    </div>
  );
}
