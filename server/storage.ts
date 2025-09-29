import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { UserType, InsertUser } from '@shared/schema';
import { fileURLToPath } from 'url';
import { IndicatorData } from './indicators';
import { scanSignals } from './bybitClient'; // Import scanSignals for real signal generation

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Interfaces matching App.tsx and SettingsPanel.tsx
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

// Storage interface
export interface IStorage {
  init(): Promise<void>;
  getUser(id: string): Promise<UserType | undefined>;
  getUserByUsername(username: string): Promise<UserType | undefined>;
  createUser(user: InsertUser): Promise<UserType>;
  getPositions(): Promise<Position[]>;
  setPositions(positions: Position[]): Promise<void>;
  addPosition(position: Position): Promise<void>;
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

// Simple locking mechanism to prevent concurrent file access
class FileLock {
  private isLocked: boolean = false;
  private queue: Array<() => void> = [];

  async acquire(): Promise<void> {
    if (this.isLocked) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    } else {
      this.isLocked = true;
    }
  }

  release(): void {
    this.isLocked = false;
    const next = this.queue.shift();
    if (next) next();
  }
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<string, UserType>;
  private positions: Map<string, Position>;
  private signals: Map<string, Signal>;
  private marketData: Map<string, MarketData>;
  private balance: Balance;
  private apiConfig: ApiConfig;
  private notificationConfig: NotificationConfig;
  private tradingConfig: TradingConfig;
  private appStatus: AppStatus;
  private connectionStatus: string;
  private readonly DATA_FILE: string;
  private fileLock: FileLock;

  constructor() {
    this.DATA_FILE = path.join(__dirname, 'data.json');
    this.fileLock = new FileLock();
    this.users = new Map();
    this.positions = new Map();
    this.signals = new Map();
    this.marketData = new Map();
    this.balance = { capital: 0, available: 0, used: 0 };
    this.apiConfig = { bybitApiKey: '', bybitApiSecret: '', bybitTestnet: true };
    this.notificationConfig = {
      discordEnabled: false,
      discordWebhook: '',
      telegramEnabled: false,
      telegramBotToken: '',
      telegramChatId: '',
      whatsappEnabled: false,
      whatsappNumber: '',
    };
    this.tradingConfig = {
      maxPositions: 5,
      riskPerTrade: 2.0,
      leverage: 10,
      stopLossPercent: 5.0,
      takeProfitPercent: 15.0,
      scanInterval: 300,
    };
    this.appStatus = { tradingMode: 'virtual', isAutomatedTradingEnabled: false };
    this.connectionStatus = 'disconnected';
  }

  async init(): Promise<void> {
    try {
      await this.initialize();
      console.log('[Storage] Initialized successfully');
    } catch (error: any) {
      console.error('[Storage] Failed to initialize:', error.message);
      // Don't throw; use in-memory defaults to keep server running
    }
  }

  private async initialize(): Promise<void> {
    const maxRetries = 3;
    let lastError: any = null;
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.loadFromFile();
        return;
      } catch (error: any) {
        lastError = error;
        console.error(`[Storage] Load attempt ${i + 1}/${maxRetries} failed:`, error.message);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    console.warn('[Storage] All load attempts failed, using in-memory defaults:', lastError.message);
    await this.saveToFile(); // Initialize empty data.json
  }

  private async saveToFile(): Promise<void> {
    const maxRetries = 3;
    let lastError: any = null;
    await this.fileLock.acquire();
    try {
      for (let i = 0; i < maxRetries; i++) {
        try {
          const data = {
            users: Array.from(this.users.entries()),
            positions: Array.from(this.positions.entries()),
            signals: Array.from(this.signals.entries()),
            marketData: Array.from(this.marketData.entries()),
            balance: this.balance,
            apiConfig: this.apiConfig,
            notificationConfig: this.notificationConfig,
            tradingConfig: this.tradingConfig,
            appStatus: this.appStatus,
            connectionStatus: this.connectionStatus,
          };
          await fs.writeFile(this.DATA_FILE, JSON.stringify(data, null, 2), { flag: 'w' });
          return;
        } catch (error: any) {
          lastError = error;
          console.error(`[Storage] Save attempt ${i + 1}/${maxRetries} failed:`, error.message);
          if (i < maxRetries - 1) await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      console.error('[Storage] All save attempts failed:', lastError.message);
    } finally {
      this.fileLock.release();
    }
  }

  private async loadFromFile(): Promise<void> {
    await this.fileLock.acquire();
    try {
      const data = await fs.readFile(this.DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      this.users = new Map(parsed.users || []);
      this.positions = new Map(parsed.positions || []);
      this.signals = new Map(parsed.signals || []);
      this.marketData = new Map(parsed.marketData || []);
      this.balance = parsed.balance || this.balance;
      this.apiConfig = parsed.apiConfig || this.apiConfig;
      this.notificationConfig = parsed.notificationConfig || this.notificationConfig;
      this.tradingConfig = parsed.tradingConfig || this.tradingConfig;
      this.appStatus = parsed.appStatus || this.appStatus;
      this.connectionStatus = parsed.connectionStatus || this.connectionStatus;
      console.log('[Storage] Loaded data from file successfully');
    } catch (error: any) {
      console.warn('[Storage] No data file found or parse error, using in-memory defaults');
      throw error; // Propagate to initialize for retry
    } finally {
      this.fileLock.release();
    }
  }

  async getUser(id: string): Promise<UserType | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<UserType | undefined> {
    return Array.from(this.users.values()).find((user) => user.name === username);
  }

  async createUser(insertUser: InsertUser): Promise<UserType> {
    const id = randomUUID();
    const user: UserType = { ...insertUser, id };
    this.users.set(id, user);
    await this.saveToFile();
    return user;
  }

  async getPositions(): Promise<Position[]> {
    return Array.from(this.positions.values());
  }

  async setPositions(positions: Position[]): Promise<void> {
    this.positions = new Map(positions.map((p) => [p.id, p]));
    await this.saveToFile();
  }

  async addPosition(position: Position): Promise<void> {
    this.positions.set(position.id, position);
    await this.saveToFile();
  }

  async getSignals(): Promise<Signal[]> {
    return Array.from(this.signals.values());
  }

  async setSignals(signals: Signal[]): Promise<void> {
    this.signals = new Map(signals.map((s) => [s.id, s]));
    await this.saveToFile();
  }

  async addSignal(signal: Signal): Promise<void> {
    this.signals.set(signal.id, signal);
    await this.saveToFile();
  }

  async generateSignals(): Promise<Signal[]> {
    try {
      // Use scanSignals from bybitClient.ts for real signal generation
      const signals = await scanSignals('60'); // Use 60-minute interval as default
      await this.setSignals(signals);
      return signals;
    } catch (error: any) {
      console.error('[Storage] generateSignals failed:', error.message);
      return [];
    }
  }

  async getMarketData(): Promise<MarketData[]> {
    return Array.from(this.marketData.values());
  }

  async setMarketData(marketData: MarketData[]): Promise<void> {
    this.marketData = new Map(marketData.map((m) => [m.symbol, m]));
    await this.saveToFile();
  }

  async getBalance(): Promise<Balance> {
    return { ...this.balance };
  }

  async setBalance(balance: Balance): Promise<void> {
    this.balance = { ...balance };
    await this.saveToFile();
  }

  async getApiConfig(): Promise<ApiConfig> {
    return { ...this.apiConfig };
  }

  async setApiConfig(config: ApiConfig): Promise<void> {
    this.apiConfig = { ...config };
    await this.saveToFile();
  }

  async getNotificationConfig(): Promise<NotificationConfig> {
    return { ...this.notificationConfig };
  }

  async setNotificationConfig(config: NotificationConfig): Promise<void> {
    this.notificationConfig = { ...config };
    await this.saveToFile();
  }

  async getTradingConfig(): Promise<TradingConfig> {
    return { ...this.tradingConfig };
  }

  async setTradingConfig(config: TradingConfig): Promise<void> {
    this.tradingConfig = { ...config };
    await this.saveToFile();
  }

  async getAppStatus(): Promise<AppStatus> {
    return { ...this.appStatus };
  }

  async setAppStatus(status: AppStatus): Promise<void> {
    this.appStatus = { ...status };
    await this.saveToFile();
  }

  async getConnectionStatus(): Promise<string> {
    return this.connectionStatus;
  }

  async setConnectionStatus(status: string): Promise<void> {
    this.connectionStatus = status;
    await this.saveToFile();
  }

  getMarketDataSync(): MarketData[] {
    return Array.from(this.marketData.values());
  }
}

export const storage = new MemStorage();