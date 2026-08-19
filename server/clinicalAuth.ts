import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { promisify } from "node:util";
import { scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { parse } from "cookie";
import type { Response } from "express";
import { ENV } from "./_core/env";

const SESSION_COOKIE = "neuroscan_clinician_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const scrypt = promisify(scryptCallback);

export type ClinicianSession = { clinicianId: number; sessionVersion: number };

function sessionKey() {
  if (!ENV.cookieSecret) throw new Error("Session signing is not configured.");
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, encoded: string) {
  if (encoded.startsWith("$2")) { try { return await bcrypt.compare(password, encoded); } catch { return false; } }
  const [algorithm, salt, storedHash] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !storedHash) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(storedHash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export function needsPasswordUpgrade(encoded: string) { return encoded.startsWith("scrypt$"); }

export async function createClinicianSession(clinicianId: number, sessionVersion: number) {
  return new SignJWT({ kind: "clinician", sv: sessionVersion })
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
    if (payload.kind !== "clinician" || !payload.sub || !/^\d+$/.test(payload.sub) || typeof payload.sv !== "number") return null;
    return { clinicianId: Number(payload.sub), sessionVersion: payload.sv };
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

export function hashRateLimitKey(scope: string, identifier: string) {
  return createHash("sha256").update(`${scope}:${identifier.trim().toLowerCase()}`).digest("hex");
}

export { SESSION_COOKIE };
