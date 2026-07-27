// Turns a name into a URL-friendly slug: lowercase, accent-free, hyphenated.
// Decomposing with NFD separates accents from their base letters; dropping every
// non-ASCII character then removes the accents while keeping the base letters.
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Slugs that would be shadowed by an application route. A company whose slug
// lands on one of these would be permanently unreachable at /{empresa}, because
// Next resolves static segments before dynamic ones. Reserved eagerly: taking a
// name off the list later is free, freeing one that is already in use is not.
const RESERVED_SLUGS = new Set([
  // Existing routes
  "dashboard",
  "login",
  "forgot-password",
  "reset-password",
  "s",
  "api",
  "_next",
  "favicon.ico",
  // Pages we are likely to add
  "produtos",
  "precos",
  "sobre",
  "contacto",
  "ajuda",
  "suporte",
  "blog",
  "docs",
  "termos",
  "privacidade",
  "admin",
  "empresa",
  "demo",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

// Alphabet without easily confused characters (no 0/O, 1/I) for short codes.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Random short code (default 10 chars) used in the public QR URL. Uses Web Crypto,
// available both in Node and the edge runtime.
export function randomCode(length = 10): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}
