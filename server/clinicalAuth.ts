import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { jwtVerify, SignJWT } from "jose";
import { parse } from "cookie";
import type { Response } from "express";
import { ENV } from "./_core/env";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "neuroscan_clinician_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

export type ClinicianSession = { clinicianId: number };

function sessionKey() {
  if (!ENV.cookieSecret) throw new Error("Session signing is not configured.");
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, hash] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export async function createClinicianSession(clinicianId: number) {
  return new SignJWT({ kind: "clinician" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(clinicianId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(sessionKey());
}

export function setClinicianSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: ENV.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS * 1000,
  });
}

export function clearClinicianSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: ENV.isProduction, sameSite: "lax", path: "/" });
}

export async function readClinicianSession(cookieHeader?: string): Promise<ClinicianSession | null> {
  const token = parse(cookieHeader || "")[SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey());
    if (payload.kind !== "clinician" || !payload.sub || !/^\d+$/.test(payload.sub)) return null;
    return { clinicianId: Number(payload.sub) };
  } catch {
    return null;
  }
}

export function createResetToken() {
  return randomBytes(32).toString("base64url");
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export { SESSION_COOKIE };
