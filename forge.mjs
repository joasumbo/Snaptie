import { readFileSync } from "node:fs";
import { SignJWT } from "jose";

const env = readFileSync(".env", "utf8");
const m = env.split(/\r?\n/).find((l) => l.startsWith("AUTH_SECRET="));
let secret = m.slice("AUTH_SECRET=".length).trim();
if (secret.startsWith('"') && secret.endsWith('"')) secret = secret.slice(1, -1);

const token = await new SignJWT({
  userId: "cmqbsxu800000m2hwtq49bvom", // Administrador Snaptie (ADMIN)
  role: "ADMIN",
  companyId: null,
})
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("7d")
  .sign(new TextEncoder().encode(secret));

console.log(token);
