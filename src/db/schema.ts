import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const pickups = sqliteTable("pickups", {
  id: text("id").primaryKey(),
  userName: text("user_name").notNull(),
  slot: text("slot").notNull(),
  partner: text("partner").notNull().default("—"),
  waste: text("waste").notNull(),
  status: text("status").notNull().default("scheduled"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const partners = sqliteTable("partners", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  zone: text("zone").notNull(),
  status: text("status").notNull().default("offline"),
  kyc: text("kyc").notNull().default("pending"),
  rating: text("rating").notNull().default("—"),
  phone: text("phone"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const bags = sqliteTable("bags", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  batch: text("batch").notNull(),
  userName: text("user_name").notNull().default("—"),
  category: text("category").notNull().default("—"),
  status: text("status").notNull().default("unassigned"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const supportTickets = sqliteTable("support_tickets", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  fromLabel: text("from_label").notNull(),
  summary: text("summary").notNull(),
  status: text("status").notNull().default("open"),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const featureFlags = sqliteTable("feature_flags", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Pickup = typeof pickups.$inferSelect;
export type Partner = typeof partners.$inferSelect;
export type Bag = typeof bags.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;
