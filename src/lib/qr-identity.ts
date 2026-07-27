import "server-only";

import { prisma } from "@/lib/prisma";
import { randomCode, slugify } from "@/lib/slug";

// Both identifiers of a QR are unique across the whole platform, so generating
// them needs the database. They live here rather than inside one server action
// because companies also create QR codes (the default page of a new company).

export async function uniqueQrSlug(nome: string): Promise<string> {
  const base = slugify(nome) || "qr";
  let slug = base;
  let n = 1;
  while (true) {
    const existing = await prisma.qrCode.findUnique({ where: { slug } });
    if (!existing) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

// Random short code used in the public URL (snaptie.net/{empresa}/{codigo}).
export async function uniqueQrCode(): Promise<string> {
  while (true) {
    const codigo = randomCode(10);
    const existing = await prisma.qrCode.findUnique({ where: { codigo } });
    if (!existing) return codigo;
  }
}
