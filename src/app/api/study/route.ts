import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { visitorIp } from "@/lib/rate-limit";
import { MAX_PAGINAS, criarEstudo } from "@/lib/study/motor";

export const dynamic = "force-dynamic";

// Começa um estudo a partir das fotografias (JPEG em base64, já reduzidas no
// telemóvel). Enquanto a IA está emprestada, só entra quem tem o código.

const POR_IP_DIA = 10;
const EM_LEITURA_MAX = 2;
const TAMANHO_MAX = 4_000_000; // por fotografia, em base64

function codigoCerto(dado: string) {
  const certo = process.env.STUDY_CODIGO;
  if (!certo) return true;
  const a = Buffer.from(dado.trim().toLowerCase());
  const b = Buffer.from(certo.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  let corpo: { codigo?: unknown; imagens?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return Response.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  if (!codigoCerto(String(corpo.codigo ?? ""))) return Response.json({ erro: "O código de acesso não está certo." }, { status: 403 });

  const imagens = Array.isArray(corpo.imagens) ? corpo.imagens.filter((x): x is string => typeof x === "string") : [];
  if (imagens.length === 0) return Response.json({ erro: "Escolhe pelo menos uma fotografia." }, { status: 400 });
  if (imagens.length > MAX_PAGINAS) return Response.json({ erro: `No máximo ${MAX_PAGINAS} fotografias.` }, { status: 400 });
  if (imagens.some((x) => x.length > TAMANHO_MAX || !/^[A-Za-z0-9+/=]+$/.test(x)))
    return Response.json({ erro: "Uma das fotografias é grande demais ou não é válida." }, { status: 400 });

  const ip = await visitorIp();
  const desde = new Date(Date.now() - 24 * 3600_000);
  if ((await prisma.studySessao.count({ where: { ip, createdAt: { gte: desde } } })) >= POR_IP_DIA)
    return Response.json({ erro: "Chegaste ao limite de estudos por hoje. Volta amanhã." }, { status: 429 });
  const aLer = await prisma.studySessao.count({
    where: { estado: { in: ["a_ler", "a_planear"] }, updatedAt: { gte: new Date(Date.now() - 10 * 60_000) } },
  });
  if (aLer >= EM_LEITURA_MAX)
    return Response.json({ erro: "Estou a ler as fotografias de outro aluno. Tenta de novo daqui a uns minutos." }, { status: 429 });

  const id = await criarEstudo(imagens, ip);
  return Response.json({ id });
}
