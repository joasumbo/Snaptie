import {
  Globe,
  Phone,
  Mail,
  MapPin,
  Wifi,
  FileText,
  MessageCircle,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { BlockType } from "@prisma/client";
import { DEFAULT_ICON, isContentBlock, actionHref } from "@/lib/qr";

const ICONS: Record<string, LucideIcon> = {
  Globe,
  Phone,
  Mail,
  MapPin,
  Wifi,
  FileText,
  MessageCircle,
  Type,
};

export type QrPageBlock = {
  id: string;
  tipo: BlockType;
  titulo: string;
  cor: string | null;
  descricao: string | null;
  conteudo: Record<string, unknown>;
};

export type QrPageData = {
  nome: string;
  descricao: string | null;
  logo: string | null;
  imagemCapa: string | null;
  logoTamanho: string;
  logoForma: string;
  nomeTamanho: string;
  mostrarLogo: boolean;
  mostrarNome: boolean;
  corPrimaria: string | null;
  companyNome: string;
  blocks: QrPageBlock[];
};

const LOGO_SIZE: Record<string, number> = { P: 48, M: 64, G: 88 };
const NAME_SIZE: Record<string, string> = {
  P: "text-lg",
  M: "text-xl",
  G: "text-2xl",
};

function str(c: Record<string, unknown>, k: string): string {
  return typeof c[k] === "string" ? (c[k] as string) : "";
}

function list(c: Record<string, unknown>, k: string): string[] {
  return Array.isArray(c[k]) ? (c[k] as unknown[]).filter((v): v is string => typeof v === "string") : [];
}

function ActionButton({
  block,
  primary,
}: {
  block: QrPageBlock;
  primary: string;
}) {
  const color = block.cor || primary;
  const Icon = ICONS[DEFAULT_ICON[block.tipo] ?? ""] ?? Globe;
  const inner = (
    <div className="flex items-center gap-3">
      <Icon className="size-5 shrink-0 opacity-90" />
      <div className="min-w-0 text-left">
        <div className="truncate font-medium leading-tight">{block.titulo}</div>
        {block.descricao ? (
          <div className="truncate text-xs opacity-80">{block.descricao}</div>
        ) : null}
      </div>
    </div>
  );

  // Wi-Fi and plain text do not navigate; render as a card.
  if (block.tipo === "WIFI") {
    const ssid = str(block.conteudo, "ssid");
    const pass = str(block.conteudo, "password");
    return (
      <div
        className="rounded-xl px-4 py-3 text-white shadow-sm"
        style={{ backgroundColor: color }}
      >
        {inner}
        <div className="mt-2 text-sm opacity-90">
          <div>Rede: {ssid || "—"}</div>
          <div>Palavra-passe: {pass || "—"}</div>
        </div>
      </div>
    );
  }
  if (block.tipo === "TEXTO") {
    return (
      <div className="rounded-xl border bg-white px-4 py-3 text-left">
        <div className="font-medium">{block.titulo}</div>
        <p className="mt-1 whitespace-pre-line text-sm text-zinc-600">
          {str(block.conteudo, "texto")}
        </p>
      </div>
    );
  }

  const href = actionHref(block.tipo, block.conteudo);
  return (
    <a
      href={href ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="block rounded-xl px-4 py-3 text-white shadow-sm transition-transform hover:scale-[1.02]"
      style={{ backgroundColor: color }}
    >
      {inner}
    </a>
  );
}

function ContentElement({ block }: { block: QrPageBlock }) {
  if (block.tipo === "IMAGEM") {
    const url = str(block.conteudo, "url");
    if (!url) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={block.titulo} className="w-full rounded-xl object-cover" />
    );
  }
  if (block.tipo === "VIDEO") {
    const url = str(block.conteudo, "url");
    if (!url) return null;
    return <video src={url} controls className="w-full rounded-xl" />;
  }
  if (block.tipo === "CARROSSEL") {
    const imgs = list(block.conteudo, "imagens");
    if (imgs.length === 0) return null;
    // Always swipes horizontally; the orientation only controls the image shape
    // (landscape rectangle vs portrait rectangle).
    const landscape = str(block.conteudo, "orientacao") === "horizontal";
    const aspect = landscape ? "aspect-[4/3]" : "aspect-[3/4]";
    return (
      <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
        {imgs.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt={`${block.titulo} ${i + 1}`}
            className={`${aspect} w-full shrink-0 snap-center rounded-xl object-cover`}
          />
        ))}
      </div>
    );
  }
  return null;
}

export function QrPage({ data }: { data: QrPageData }) {
  const primary = data.corPrimaria || "#6366f1";
  const logo = data.logo;
  const logoSize = LOGO_SIZE[data.logoTamanho] ?? 64;
  const logoRounded = data.logoForma === "quadrado" ? "rounded-2xl" : "rounded-full";
  const nameClass = NAME_SIZE[data.nomeTamanho] ?? "text-xl";

  return (
    <div
      className="min-h-full bg-white"
      style={{
        background: `radial-gradient(120% 55% at 50% 0%, ${primary}22, #ffffff 60%)`,
      }}
    >
      {data.imagemCapa ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.imagemCapa}
          alt=""
          className="h-40 w-full object-cover"
        />
      ) : null}

      <div className="mx-auto flex max-w-md flex-col items-center px-5 py-8 text-center">
        {data.mostrarLogo ? (
          logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={data.companyNome}
              className={`${logoRounded} object-cover shadow-sm`}
              style={{ width: logoSize, height: logoSize }}
            />
          ) : (
            <div
              className={`${logoRounded} flex items-center justify-center font-bold text-white shadow-sm`}
              style={{ width: logoSize, height: logoSize, backgroundColor: primary }}
            >
              {data.companyNome.charAt(0)}
            </div>
          )
        ) : null}

        {data.mostrarNome ? (
          <h1 className={`mt-3 font-semibold text-zinc-900 ${nameClass}`}>
            {data.nome}
          </h1>
        ) : null}
        {data.descricao ? (
          <p className="mt-1 text-sm text-zinc-500">{data.descricao}</p>
        ) : null}

        <div className="mt-6 flex w-full flex-col gap-3">
          {data.blocks.length === 0 ? (
            <p className="text-sm text-zinc-400">Sem conteúdos.</p>
          ) : (
            data.blocks.map((block) =>
              isContentBlock(block.tipo) ? (
                <ContentElement key={block.id} block={block} />
              ) : (
                <ActionButton key={block.id} block={block} primary={primary} />
              ),
            )
          )}
        </div>

        <p className="mt-10 text-xs text-zinc-400">Powered by Snaptie</p>
      </div>
    </div>
  );
}
