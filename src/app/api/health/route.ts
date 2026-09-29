// Usado pelo healthcheck do contentor. Não toca na base de dados de propósito:
// o Neon cobra as horas em que está acordado, e um healthcheck que abria a
// página inicial de 30 em 30 segundos nunca o deixava adormecer.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true });
}
