import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/** Core user table backing the managed OAuth flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** Public access requests originating from the Dala landing page. */
export const accessRequests = mysqlTable(
  "accessRequests",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    company: varchar("company", { length: 160 }),
    message: text("message"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("accessRequests_createdAt_idx").on(table.createdAt)],
);

/** File metadata; the actual bytes reside in managed S3 storage. */
export const workspaceFiles = mysqlTable(
  "workspaceFiles",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
    fileKey: varchar("fileKey", { length: 512 }).notNull().unique(),
    url: varchar("url", { length: 768 }).notNull(),
    originalName: varchar("originalName", { length: 255 }).notNull(),
    mimeType: varchar("mimeType", { length: 150 }).notNull(),
    sizeBytes: int("sizeBytes").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("workspaceFiles_owner_createdAt_idx").on(table.ownerId, table.createdAt)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type WorkspaceFile = typeof workspaceFiles.$inferSelect;
