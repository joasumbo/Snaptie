import { SignJWT, jwtVerify, decodeJwt } from "jose";

// Reset tokens are signed with a per-user key derived from the current password
// hash, so a token becomes invalid as soon as the password changes (single use).
function key(passwordHash: string): Uint8Array {
  return new TextEncoder().encode((process.env.AUTH_SECRET ?? "") + passwordHash);
}

export async function createResetToken(
  userId: string,
  passwordHash: string,
): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key(passwordHash));
}

// Reads the user id from the token without verifying (to look up the user).
export function readUserId(token: string): string | null {
  try {
    return decodeJwt(token).sub ?? null;
  } catch {
    return null;
  }
}

export async function verifyResetToken(
  token: string,
  passwordHash: string,
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(passwordHash));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
