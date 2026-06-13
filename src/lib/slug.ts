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
