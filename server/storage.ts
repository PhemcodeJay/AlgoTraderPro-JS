import { randomUUID } from 'crypto';
import path from 'path';
import { UserType, InsertUser } from '@shared/schema';
import { fileURLToPath } from 'url';
import { IndicatorData } from './indicators';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Position {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  leverage: number;
  entryPrice: number;
  currentPrice?: number;
  exitPrice?: number;
  pnl: number;
  pnlPercent: number;
  status: 'OPEN' | 'CLOSED';
  openTime: string;
  closeTime?: string;
  stopLoss?: number;
  takeProfit?: number;
  liquidationPrice?: number;
  trailingStop?: number;
}

export interface Signal {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  score: number;
  price: number;
  stopLoss: number;
  takeProfit: number;
  liquidationPrice: number;
  trailingStop?: number;
  currentMarketPrice: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'EXECUTED' | 'EXPIRED';
  timestamp: string;
  executedPrice?: number;
  interval: string;
  signal_type: string;
  indicators: IndicatorData;
  entry: number;
  sl: number;
  tp: number;
  trail: number;
  liquidation: number;
  margin_usdt: number;
  bb_slope: string;
  market: string;
  leverage: number;
  risk_reward: number;
  atr_multiplier: number;
  created_at: string;
  signals: string[];
}

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

export interface Balance {
  capital: number;
  available: number;
  used: number;
}

export interface ApiConfig {
  bybitApiKey: string;
  bybitApiSecret: string;
  bybitTestnet: boolean;
}

export interface NotificationConfig {
  discordEnabled: boolean;
  discordWebhook: string;
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  whatsappEnabled: boolean;
  whatsappNumber: string;
}

export interface TradingConfig {
  maxPositions: number;
  riskPerTrade: number;
  leverage: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  scanInterval: number;
}

export interface AppStatus {
  tradingMode: 'virtual' | 'real';
  isAutomatedTradingEnabled: boolean;
}

export interface IStorage {
  init(): Promise<void>;
  getUser(id: string): Promise<UserType | undefined>;
  getUserByUsername(username: string): Promise<UserType | undefined>;
  createUser(user: InsertUser): Promise<UserType>;
  getPositions(): Promise<Position[]>;
  setPositions(positions: Position[]): Promise<void>;
  addPosition(position: Position): Promise<void>;
  removePosition(id: string): Promise<void>;
  getSignals(): Promise<Signal[]>;
  setSignals(signals: Signal[]): Promise<void>;
  addSignal(signal: Signal): Promise<void>;
  generateSignals(): Promise<Signal[]>;
  getMarketData(): Promise<MarketData[]>;
  setMarketData(marketData: MarketData[]): Promise<void>;
  getBalance(): Promise<Balance>;
  setBalance(balance: Balance): Promise<void>;
  getApiConfig(): Promise<ApiConfig>;
  setApiConfig(config: ApiConfig): Promise<void>;
  getNotificationConfig(): Promise<NotificationConfig>;
  setNotificationConfig(config: NotificationConfig): Promise<void>;
  getTradingConfig(): Promise<TradingConfig>;
  setTradingConfig(config: TradingConfig): Promise<void>;
  getAppStatus(): Promise<AppStatus>;
  setAppStatus(status: AppStatus): Promise<void>;
  getConnectionStatus(): Promise<string>;
  setConnectionStatus(status: string): Promise<void>;
  getMarketDataSync(): MarketData[];
}

export class SqliteStorage implements IStorage {
  private db!: Database;
  private marketData: Map<string, MarketData> = new Map();
  private connectionStatus: string = 'disconnected';

  async init(): Promise<void> {
    this.db = await open({
      filename: path.join(__dirname, 'trading.db'),
      driver: sqlite3.Database
    });

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS positions (
        id TEXT PRIMARY KEY,
        data TEXT
      );
      CREATE TABLE IF NOT EXISTS signals (
        id TEXT PRIMARY KEY,
        timestamp DATETIME,
        data TEXT
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    console.log('[Storage] SQLite initialized');
  }

  async getUser(id: string): Promise<UserType | undefined> { return undefined; }
  async getUserByUsername(username: string): Promise<UserType | undefined> { return undefined; }
  async createUser(user: InsertUser): Promise<UserType> { throw new Error('Not implemented'); }

  async getPositions(): Promise<Position[]> {
    const rows = await this.db.all('SELECT data FROM positions');
    return rows.map(r => JSON.parse(r.data));
  }

  async setPositions(positions: Position[]): Promise<void> {
    await this.db.run('DELETE FROM positions');
    for (const p of positions) {
      await this.db.run('INSERT INTO positions (id, data) VALUES (?, ?)', p.id, JSON.stringify(p));
    }
  }

  async addPosition(position: Position): Promise<void> {
    await this.db.run('INSERT OR REPLACE INTO positions (id, data) VALUES (?, ?)', position.id, JSON.stringify(position));
  }

  async removePosition(id: string): Promise<void> {
    await this.db.run('DELETE FROM positions WHERE id = ?', id);
  }

  async getSignals(): Promise<Signal[]> {
    const rows = await this.db.all('SELECT data FROM signals ORDER BY timestamp DESC LIMIT 50');
    return rows.map(r => JSON.parse(r.data));
  }

  async setSignals(signals: Signal[]): Promise<void> {
    // Clear old signals for the same interval to ensure user only sees fresh real-time data
    if (signals.length > 0) {
      const interval = signals[0].interval;
      // We need to parse data to filter by interval, but it's better to just clear all
      // or at least clear enough so only recent ones remain.
      // For simplicity and to fix the "old prices" issue, we'll clear older signals.
      await this.db.run('DELETE FROM signals');
    }
    for (const s of signals) {
      await this.db.run('INSERT OR REPLACE INTO signals (id, timestamp, data) VALUES (?, ?, ?)', 
        s.id, s.timestamp, JSON.stringify(s));
    }
  }

  async addSignal(signal: Signal): Promise<void> {
    await this.db.run('INSERT OR REPLACE INTO signals (id, timestamp, data) VALUES (?, ?, ?)', 
      signal.id, signal.timestamp, JSON.stringify(signal));
  }

  async generateSignals(): Promise<Signal[]> { return this.getSignals(); }
  async getMarketData(): Promise<MarketData[]> { return Array.from(this.marketData.values()); }
  async setMarketData(data: MarketData[]): Promise<void> {
    for (const m of data) this.marketData.set(m.symbol, m);
  }

  private async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const row = await this.db.get('SELECT value FROM settings WHERE key = ?', key);
    return row ? JSON.parse(row.value) : defaultValue;
  }

  private async setSetting(key: string, value: any): Promise<void> {
    await this.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, JSON.stringify(value));
  }

  async getBalance(): Promise<Balance> {
    return this.getSetting('balance', { capital: 10000, available: 10000, used: 0 });
  }
  async setBalance(balance: Balance): Promise<void> { await this.setSetting('balance', balance); }

  async getApiConfig(): Promise<ApiConfig> {
    return this.getSetting('apiConfig', { bybitApiKey: '', bybitApiSecret: '', bybitTestnet: true });
  }
  async setApiConfig(config: ApiConfig): Promise<void> { await this.setSetting('apiConfig', config); }

  async getNotificationConfig(): Promise<NotificationConfig> {
    return this.getSetting('notificationConfig', {
      discordEnabled: false,
      discordWebhook: '',
      telegramEnabled: false,
      telegramBotToken: '',
      telegramChatId: '',
      whatsappEnabled: false,
      whatsappNumber: '',
    });
  }
  async setNotificationConfig(config: NotificationConfig): Promise<void> { await this.setSetting('notificationConfig', config); }

  async getTradingConfig(): Promise<TradingConfig> {
    return this.getSetting('tradingConfig', {
      maxPositions: 5,
      riskPerTrade: 2.0,
      leverage: 10,
      stopLossPercent: 5.0,
      takeProfitPercent: 15.0,
      scanInterval: 300,
    });
  }
  async setTradingConfig(config: TradingConfig): Promise<void> { await this.setSetting('tradingConfig', config); }

  async getAppStatus(): Promise<AppStatus> {
    return this.getSetting('appStatus', { tradingMode: 'virtual', isAutomatedTradingEnabled: false });
  }
  async setAppStatus(status: AppStatus): Promise<void> { await this.setSetting('appStatus', status); }

  async getConnectionStatus(): Promise<string> { return this.connectionStatus; }
  async setConnectionStatus(status: string): Promise<void> { this.connectionStatus = status; }
  getMarketDataSync(): MarketData[] { return Array.from(this.marketData.values()); }
}

export const storage = new SqliteStorage();
