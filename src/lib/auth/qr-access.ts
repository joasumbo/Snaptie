import { SignJWT, jwtVerify } from "jose";

// Proof that a visitor already entered the access PIN of a given QR, kept in a
// signed cookie so a private page does not ask for the PIN on every visit.
// Separate from the dashboard session: this grants nothing but that one page.

export const ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function accessCookieName(qrId: string): string {
  return `snaptie_qr_${qrId}`;
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signAccess(qrId: string): Promise<string> {
  return new SignJWT({ qrId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function hasAccess(
  token: string | undefined,
  qrId: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });
    return payload.qrId === qrId;
  } catch {
    return false;
  }
}
