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
