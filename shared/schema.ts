import { sql } from "drizzle-orm";
import { pgTable, varchar, text, decimal, timestamp, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --- Trades table ---
export const trades = pgTable("trades", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(),
  side: varchar("side", { length: 4 }).notNull().$type<'BUY' | 'SELL'>(),
  quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
  entryPrice: decimal("entry_price", { precision: 18, scale: 8 }).notNull(),
  exitPrice: decimal("exit_price", { precision: 18, scale: 8 }),
  stopLoss: decimal("stop_loss", { precision: 18, scale: 8 }),
  takeProfit: decimal("take_profit", { precision: 18, scale: 8 }),
  leverage: integer("leverage").default(10),
  status: text("status").notNull().default("OPEN").$type<'OPEN' | 'CLOSED'>(),
  tradingMode: text("trading_mode").notNull().$type<'virtual' | 'real'>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
  pnl: decimal("pnl", { precision: 18, scale: 8 }),
});

// --- Signals table ---
export const signals = pgTable("signals", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(),
  signalType: varchar("signal_type", { length: 4 }).notNull().$type<'BUY' | 'SELL'>(),
  score: decimal("score", { precision: 10, scale: 2 }).notNull(),
  entryPrice: decimal("entry_price", { precision: 18, scale: 8 }).notNull(),
  stopLoss: decimal("stop_loss", { precision: 18, scale: 8 }),
  takeProfit: decimal("take_profit", { precision: 18, scale: 8 }),
  indicators: json("indicators").$type<Record<string, number>>(),
  createdAt: timestamp("created_at").defaultNow(),
  status: varchar("status", { length: 20 }).notNull().$type<'PENDING' | 'EXECUTED' | 'EXPIRED'>().default('PENDING'),
  confidence: varchar("confidence", { length: 20 }).notNull().$type<'HIGH' | 'MEDIUM' | 'LOW'>().default('MEDIUM'),
  executedPrice: decimal("executed_price", { precision: 18, scale: 8 }),
});

// --- Settings table ---
export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// --- Wallet balances table ---
export const walletBalances = pgTable("wallet_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tradingMode: text("trading_mode").notNull().unique().$type<'virtual' | 'real'>(),
  capital: decimal("capital", { precision: 18, scale: 8 }).notNull(),
  available: decimal("available", { precision: 18, scale: 8 }).notNull(),
  used: decimal("used", { precision: 18, scale: 8 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// --- Users table ---
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Insert schemas ---
export const insertTradeSchema = createInsertSchema(trades).omit({ id: true, createdAt: true });
export const insertSignalSchema = createInsertSchema(signals).omit({ id: true, createdAt: true });
export const insertSettingSchema = createInsertSchema(settings).omit({ id: true, updatedAt: true });
export const insertWalletBalanceSchema = createInsertSchema(walletBalances).omit({ id: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });

// --- Types ---
export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type InsertSignal = z.infer<typeof insertSignalSchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type WalletBalance = typeof walletBalances.$inferSelect;
export type InsertWalletBalance = z.infer<typeof insertWalletBalanceSchema>;
export type UserType = z.infer<typeof insertUserSchema> & { id: string };
export type InsertUser = z.infer<typeof insertUserSchema>;

// --- Position interface ---
export interface Position {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  entryPrice: number;
  currentPrice?: number;
  exitPrice?: number;
  pnl: number;
  pnlPercent: number;
  status: 'OPEN' | 'CLOSED';
  openTime: Date | null;
  closeTime?: Date | null;
  leverage: number; // Added to match trades table
}

// --- Signal interface ---
export interface Signal {
  id: string;
  symbol: string;
  signalType: 'BUY' | 'SELL';
  score: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  indicators?: Record<string, number>;
  createdAt: Date | null;
  status: 'PENDING' | 'EXECUTED' | 'EXPIRED';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  executedPrice?: number;
}

// --- DashboardStats interface ---
export interface DashboardStats {
  totalPnL: number;
  winRate: number;
  totalTrades: number;
  activePositions: number;
}

// --- Optional DB insert function ---
export const insertUser = (user: UserType) => {
  // implement database insert logic here
};