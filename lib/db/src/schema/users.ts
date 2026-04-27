import { pgTable, text, serial, timestamp, real, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const educationLevelEnum = pgEnum("neyrozachet_education_level", ["school", "bachelor", "master", "phd", "other"]);

export const usersTable = pgTable("Neyrozachet_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  educationLevel: educationLevelEnum("education_level").default("bachelor"),
  institution: text("institution"),
  specialty: text("specialty"),
  balance: real("balance").notNull().default(0),
  subscriptionUntil: timestamp("subscription_until", { withTimezone: true }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
