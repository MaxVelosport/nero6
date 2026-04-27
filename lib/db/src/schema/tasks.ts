import { pgTable, text, serial, timestamp, real, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const taskTypeEnum = pgEnum("neyrozachet_task_type", ["homework", "test", "coursework", "lab", "essay", "diploma", "other"]);
export const solvingModeEnum = pgEnum("neyrozachet_solving_mode", ["fast", "standard", "premium"]);
export const taskStatusEnum = pgEnum("neyrozachet_task_status", ["pending", "processing", "completed", "failed"]);

export const tasksTable = pgTable("Neyrozachet_tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  title: text("title").notNull(),
  description: text("description"),
  subject: text("subject").notNull(),
  taskType: taskTypeEnum("task_type").notNull().default("homework"),
  educationLevel: text("education_level"),
  solvingMode: solvingModeEnum("solving_mode").notNull().default("standard"),
  status: taskStatusEnum("status").notNull().default("pending"),
  complexityScore: real("complexity_score"),
  estimatedCost: real("estimated_cost").notNull().default(0),
  actualCost: real("actual_cost"),
  estimatedTime: integer("estimated_time"),
  result: text("result"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
