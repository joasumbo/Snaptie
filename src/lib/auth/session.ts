import "server-only";

import { cookies } from "next/headers";
import {
  COOKIE_NAME,
  MAX_AGE_SECONDS,
  encodeSession,
  decodeSession,
  type SessionPayload,
} from "./jwt";

export type { SessionPayload };

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await encodeSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return decodeSession(cookieStore.get(COOKIE_NAME)?.value);
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
