import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { accessRequests, InsertUser, users, workspaceFiles } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((field) => {
    if (user[field] === undefined) return;
    const value = user[field] ?? null;
    values[field] = value;
    updateSet[field] = value;
  });

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (!Object.keys(updateSet).length) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function createAccessRequest(input: {
  name: string;
  email: string;
  company?: string;
  message?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("The database is unavailable. Please try again shortly.");
  await db.insert(accessRequests).values({
    name: input.name,
    email: input.email,
    company: input.company || null,
    message: input.message || null,
  });
}

export async function createWorkspaceFile(input: {
  ownerId: number;
  fileKey: string;
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("The database is unavailable. Please try again shortly.");
  await db.insert(workspaceFiles).values(input);
}

export async function listWorkspaceFiles(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("The database is unavailable. Please try again shortly.");
  return db.select().from(workspaceFiles).where(eq(workspaceFiles.ownerId, ownerId)).orderBy(desc(workspaceFiles.createdAt));
}
