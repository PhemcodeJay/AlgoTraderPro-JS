// server/index.ts
import dotenv3 from "dotenv";
import express2 from "express";
import cors from "cors";
import http from "http";

// server/routes.ts
import { createServer } from "http";
import { WebSocketServer } from "ws";

// server/storage.ts
import { randomUUID as randomUUID2 } from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// server/bybitClient.ts
import { RestClientV5, WebsocketClient } from "bybit-api";
import dotenv from "dotenv";
import { randomUUID } from "crypto";

// server/indicators.ts
function SMA(data, period) {
  if (data.length < period) return new Array(data.length).fill(0);
  const sma = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(0);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const sum = slice.reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }
  return sma;
}
function EMA(data, period) {
  if (data.length < period) return new Array(data.length).fill(0);
  const k = 2 / (period + 1);
  const ema = [data[0]];
  for (let i = 1; i < data.length; i++) {
    const emaVal = data[i] * k + ema[ema.length - 1] * (1 - k);
    ema.push(emaVal);
  }
  return ema;
}
function RSI(data, period = 14) {
  if (data.length < period + 1) return new Array(data.length).fill(50);
  const gains = [];
  const losses = [];
  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  const rsi = [50];
  for (let i = period; i < gains.length; i++) {
    const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsiVal = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
    rsi.push(rsiVal);
  }
  while (rsi.length < data.length) {
    rsi.unshift(50);
  }
  return rsi;
}
function MACD(data, fast = 12, slow = 26, signalPeriod = 9) {
  if (data.length < slow) {
    return { macd: new Array(data.length).fill(0), signal: new Array(data.length).fill(0), histogram: new Array(data.length).fill(0) };
  }
  const emaFast = EMA(data, fast);
  const emaSlow = EMA(data, slow);
  const macdLine = emaFast.map((fast2, i) => fast2 - emaSlow[i]);
  const signalLine = EMA(macdLine, signalPeriod);
  const histogram = macdLine.map((macd, i) => macd - signalLine[i]);
  return { macd: macdLine, signal: signalLine, histogram };
}
function BollingerBands(data, period = 20, multiplier = 2) {
  if (data.length < period) {
    return { upper: new Array(data.length).fill(0), middle: new Array(data.length).fill(0), lower: new Array(data.length).fill(0) };
  }
  const middle = SMA(data, period);
  const upper = [];
  const lower = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(0);
      lower.push(0);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = middle[i];
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const stdDev = Math.sqrt(variance);
      upper.push(mean + multiplier * stdDev);
      lower.push(mean - multiplier * stdDev);
    }
  }
  return { upper, middle, lower };
}
function ATR(high, low, close, period = 14) {
  if (high.length < period + 1 || high.length !== low.length || high.length !== close.length) {
    return new Array(high.length).fill(0);
  }
  const trs = [];
  for (let i = 1; i < high.length; i++) {
    const tr = Math.max(
      high[i] - low[i],
      Math.abs(high[i] - close[i - 1]),
      Math.abs(low[i] - close[i - 1])
    );
    trs.push(tr);
  }
  const atr = [0];
  for (let i = period; i < trs.length + 1; i++) {
    const atrVal = trs.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
    atr.push(atrVal);
  }
  while (atr.length < high.length) {
    atr.push(atr[atr.length - 1] || 0);
  }
  return atr;
}
function calculateIndicators(closes, highs, lows, volumes) {
  if (closes.length < 20) return {
    sma20: [],
    sma50: [],
    ema20: [],
    rsi: [],
    macd: { macd: [], signal: [], histogram: [] },
    bollinger: { upper: [], middle: [], lower: [] },
    atr: []
  };
  const sma20 = SMA(closes, 20);
  const sma50 = SMA(closes, 50);
  const ema20 = EMA(closes, 20);
  const rsi = RSI(closes, 14);
  const macd = MACD(closes);
  const bollinger = BollingerBands(closes);
  const atr = ATR(highs, lows, closes, 14);
  return { sma20, sma50, ema20, rsi, macd, bollinger, atr };
}
function scoreSignal(closes, highs, lows, volumes) {
  if (closes.length < 20) return { buyScore: 0, sellScore: 0, signals: [] };
  const indicators = calculateIndicators(closes, highs, lows, volumes);
  const price = closes[closes.length - 1];
  let buyScore = 0;
  let sellScore = 0;
  const signals = [];
  const rsi = indicators.rsi[indicators.rsi.length - 1] || 50;
  if (rsi < 30) {
    buyScore += 25;
    signals.push("RSI_OVERSOLD");
  } else if (rsi > 70) {
    sellScore += 25;
    signals.push("RSI_OVERBOUGHT");
  } else if (20 <= rsi && rsi <= 30) {
    buyScore += 10;
    signals.push("RSI_NEAR_OVERSOLD");
  } else if (70 <= rsi && rsi <= 80) {
    sellScore += 10;
    signals.push("RSI_NEAR_OVERBOUGHT");
  } else if (rsi < 20) {
    buyScore += 5;
    signals.push("RSI_EXTREME_OVERSOLD");
  } else if (rsi > 80) {
    sellScore += 5;
    signals.push("RSI_EXTREME_OVERBOUGHT");
  }
  const macd = indicators.macd.macd[indicators.macd.macd.length - 1] || 0;
  const macdSignal = indicators.macd.signal[indicators.macd.signal.length - 1] || 0;
  const macdHist = indicators.macd.histogram[indicators.macd.histogram.length - 1] || 0;
  if (macd > macdSignal && macdHist > 0) {
    buyScore += 20;
    signals.push("MACD_BULLISH");
  } else if (macd < macdSignal && macdHist < 0) {
    sellScore += 20;
    signals.push("MACD_BEARISH");
  }
  if (Math.abs(macdHist) > 0.01) {
    buyScore += 8;
    sellScore += 8;
    signals.push("MACD_STRONG");
  }
  const bbUpper = indicators.bollinger.upper[indicators.bollinger.upper.length - 1] || 0;
  const bbLower = indicators.bollinger.lower[indicators.bollinger.lower.length - 1] || 0;
  if (price <= bbLower) {
    buyScore += 15;
    signals.push("BB_OVERSOLD");
  } else if (price >= bbUpper) {
    sellScore += 15;
    signals.push("BB_OVERBOUGHT");
  }
  const avgVolume = volumes.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, volumes.length) || 1;
  const volumeRatio = volumes[volumes.length - 1] / avgVolume;
  if (volumeRatio > 2) {
    buyScore += 12;
    sellScore += 12;
    signals.push("VOLUME_VERY_HIGH");
  } else if (volumeRatio > 1.5) {
    buyScore += 6;
    sellScore += 6;
    signals.push("VOLUME_HIGH");
  }
  let trendScore = 0;
  if (indicators.sma20.length > 1 && indicators.sma50.length > 1) {
    if (indicators.sma20[indicators.sma20.length - 1] > indicators.sma50[indicators.sma50.length - 1]) {
      trendScore += 1;
      signals.push("SMA20_ABOVE_SMA50");
    }
    if (price > indicators.sma20[indicators.sma20.length - 1]) {
      trendScore += 1;
      signals.push("PRICE_ABOVE_SMA20");
    }
    if (indicators.sma20[indicators.sma20.length - 1] > indicators.sma20[indicators.sma20.length - 2]) {
      trendScore += 1;
      signals.push("SMA20_UPTREND");
    }
  }
  buyScore += trendScore * 3;
  sellScore += trendScore * 3;
  if (trendScore >= 2) {
    buyScore += 15;
    signals.push("TREND_BULLISH");
  }
  const atr = indicators.atr[indicators.atr.length - 1] || 0;
  const volatility = price > 0 ? atr / price * 100 : 0;
  if (0.5 <= volatility && volatility <= 3) {
    buyScore += 5;
    sellScore += 5;
    signals.push("VOLATILITY_NORMAL");
  } else if (volatility > 5) {
    buyScore -= 10;
    sellScore -= 10;
    signals.push("VOLATILITY_HIGH");
  }
  return {
    buyScore: Math.min(Math.max(buyScore, 0), 100),
    sellScore: Math.min(Math.max(sellScore, 0), 100),
    signals
  };
}

// server/bybitClient.ts
dotenv.config();
var API_KEY = process.env.BYBIT_API_KEY;
var API_SECRET = process.env.BYBIT_API_SECRET;
var USE_MAINNET = process.env.BYBIT_MAINNET === "true" || process.env.BYBIT_TESTNET === "false";
if (!API_KEY || !API_SECRET) {
  console.warn("[Bybit] Warning: BYBIT_API_KEY and BYBIT_API_SECRET not set. Using demo mode.");
}
console.log(`[Bybit] Client starting on: ${USE_MAINNET ? "MAINNET" : "TESTNET"}`);
var BASE_URL = USE_MAINNET ? "https://api.bybit.com" : "https://api-testnet.bybit.com";
var WS_URL = USE_MAINNET ? "wss://stream.bybit.com/v5/public/linear" : "wss://stream-testnet.bybit.com/v5/public/linear";
var bybitRestClient = new RestClientV5({
  key: API_KEY,
  secret: API_SECRET,
  baseUrl: BASE_URL
});
var bybitWsClient = new WebsocketClient({
  market: "v5",
  wsUrl: WS_URL
});
async function safeSubscribe(topics, retries = 3, delay = 1e3) {
  for (let i = 0; i < retries; i++) {
    try {
      await bybitWsClient.subscribe(topics);
      console.log("[Bybit WS] Subscribed to topics:", topics);
      return;
    } catch (err) {
      console.error(`[Bybit WS] Subscription failed (attempt ${i + 1}/${retries}):`, err.message);
      if (i < retries - 1) await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("[Bybit WS] Max subscription retries reached");
}
var reconnectAttempts = 0;
var MAX_RECONNECT_ATTEMPTS = 10;
function initWebSocket() {
  bybitWsClient.on("open", async () => {
    console.log("[Bybit WS] Connected");
    reconnectAttempts = 0;
    try {
      await safeSubscribe(["tickers.BTCUSDT", "tickers.ETHUSDT"]);
    } catch (err) {
      console.error("[Bybit WS] Failed to subscribe:", err.message);
    }
  });
  bybitWsClient.on("update", async (msg) => {
    if (msg.topic?.startsWith("tickers.")) {
      try {
        const data = msg.data;
        const update = {
          symbol: data.symbol,
          price: parseFloat(data.lastPrice) || 0,
          change24h: parseFloat(data.price24hPcnt) || 0,
          changePercent24h: parseFloat(data.price24hPcnt) * 100 || 0,
          volume24h: parseFloat(data.turnover24h) || 0,
          high24h: parseFloat(data.highPrice24h) || 0,
          low24h: parseFloat(data.lowPrice24h) || 0
        };
        const current = await storage.getMarketData().catch((err) => {
          console.error("[Storage] getMarketData failed:", err);
          return [];
        });
        const idx = current.findIndex((d) => d.symbol === update.symbol);
        if (idx >= 0) current[idx] = update;
        else current.push(update);
        await storage.setMarketData(current).catch((err) => {
          console.error("[Storage] setMarketData failed:", err);
        });
      } catch (err) {
        console.error("[Bybit WS] Error updating market data:", err.message);
      }
    }
  });
  bybitWsClient.on("error", (err) => {
    console.error("[Bybit WS] Error:", err?.message || err);
  });
  bybitWsClient.on("close", () => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error("[Bybit WS] Max reconnect attempts reached, stopping retries");
      return;
    }
    reconnectAttempts++;
    console.warn(`[Bybit WS] Connection closed, reconnecting (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
    setTimeout(initWebSocket, 3e3);
  });
}
initWebSocket();
async function getMarketData(symbols = ["BTCUSDT", "ETHUSDT"], retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await bybitRestClient.getTickers({ category: "linear", symbol: symbols.join(",") });
      const marketData = response.result.list.map((item) => ({
        symbol: item.symbol,
        price: parseFloat(item.lastPrice) || 0,
        change24h: parseFloat(item.price24hPcnt) || 0,
        changePercent24h: parseFloat(item.price24hPcnt) * 100 || 0,
        volume24h: parseFloat(item.turnover24h) || 0,
        high24h: parseFloat(item.highPrice24h) || 0,
        low24h: parseFloat(item.lowPrice24h) || 0
      }));
      await storage.setMarketData(marketData).catch((err) => {
        console.error("[Storage] setMarketData failed:", err);
      });
      return marketData;
    } catch (err) {
      console.error(`[Bybit] getMarketData failed (attempt ${i + 1}/${retries}):`, err.message);
      if (i < retries - 1) await new Promise((resolve) => setTimeout(resolve, 1e3));
    }
  }
  console.error("[Bybit] Max retries reached for getMarketData");
  return [];
}
async function getPositions() {
  try {
    const response = await bybitRestClient.getPositionInfo({ category: "linear" });
    const positions = response.result.list.map((pos) => ({
      id: pos.positionIdx.toString(),
      symbol: pos.symbol,
      side: pos.side === "Buy" ? "BUY" : "SELL",
      size: parseFloat(pos.size) || 0,
      entryPrice: parseFloat(pos.avgPrice) || 0,
      currentPrice: parseFloat(pos.markPrice) || 0,
      pnl: parseFloat(pos.unrealisedPnl) || 0,
      pnlPercent: parseFloat(pos.positionValue) > 0 ? parseFloat(pos.unrealisedPnl) / parseFloat(pos.positionValue) * 100 : 0,
      status: parseFloat(pos.size) > 0 ? "OPEN" : "CLOSED",
      openTime: new Date(Number(pos.createdTime)).toISOString(),
      closeTime: pos.updatedTime && parseFloat(pos.size) === 0 ? new Date(Number(pos.updatedTime)).toISOString() : void 0,
      exitPrice: parseFloat(pos.size) === 0 && pos.avgPrice ? parseFloat(pos.avgPrice) : void 0,
      leverage: parseFloat(pos.leverage) || 10,
      stopLoss: parseFloat(pos.stopLoss) || void 0,
      takeProfit: parseFloat(pos.takeProfit) || void 0,
      liquidationPrice: parseFloat(pos.liqPrice) || void 0,
      trailingStop: parseFloat(pos.trailingStop) || void 0
    }));
    await storage.setPositions(positions).catch((err) => {
      console.error("[Storage] setPositions failed:", err);
    });
    return positions;
  } catch (err) {
    console.error("[Bybit] getPositions failed:", err.message);
    return [];
  }
}
async function getBalance() {
  try {
    const response = await bybitRestClient.getWalletBalance({ accountType: "UNIFIED" });
    const usdt = response.result.list[0].coin.find((c) => c.coin === "USDT");
    const balance = {
      capital: parseFloat(usdt?.equity || "0"),
      available: parseFloat(usdt?.availableToWithdraw || "0"),
      used: parseFloat(usdt?.locked || "0")
    };
    await storage.setBalance(balance).catch((err) => {
      console.error("[Storage] setBalance failed:", err);
    });
    return balance;
  } catch (err) {
    console.error("[Bybit] getBalance failed:", err.message);
    return { capital: 0, available: 0, used: 0 };
  }
}
async function scanSignals(interval = "15", limit = 50) {
  const symbols = ["BTCUSDT", "ETHUSDT"];
  const signals = [];
  const tradingConfig = await storage.getTradingConfig().catch((err) => {
    console.error("[Storage] getTradingConfig failed:", err);
    return { leverage: 10, stopLossPercent: 2, takeProfitPercent: 4 };
  });
  for (const symbol of symbols) {
    try {
      const kline = await bybitRestClient.getKline({ category: "linear", symbol, interval, limit });
      const closes = kline.result.list.map((c) => parseFloat(c[4])).reverse();
      const highs = kline.result.list.map((c) => parseFloat(c[2])).reverse();
      const lows = kline.result.list.map((c) => parseFloat(c[3])).reverse();
      if (closes.length < 20) continue;
      const shortMA = closes.slice(-5).reduce((a, b) => a + b, 0) / 5;
      const longMA = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      let type = null;
      if (shortMA > longMA) type = "BUY";
      if (shortMA < longMA) type = "SELL";
      if (type) {
        const currentPrice = closes[closes.length - 1];
        const indicators = calculateIndicators(closes, highs, lows, []);
        const atr = indicators.atr[indicators.atr.length - 1] || 0;
        const leverage = tradingConfig.leverage || 10;
        const riskReward = 2;
        const atrMultiplier = 2;
        const margin_usdt = 1;
        const stopLoss = type === "BUY" ? currentPrice * (1 - (tradingConfig.stopLossPercent || 2) / 100) : currentPrice * (1 + (tradingConfig.stopLossPercent || 2) / 100);
        const takeProfit = type === "BUY" ? currentPrice * (1 + (tradingConfig.takeProfitPercent || 4) / 100) : currentPrice * (1 - (tradingConfig.takeProfitPercent || 4) / 100);
        const liquidationPrice = type === "BUY" ? currentPrice * (1 - 0.9 / leverage) : currentPrice * (1 + 0.9 / leverage);
        const trailingStop = type === "BUY" ? stopLoss + Math.abs(currentPrice - stopLoss) * 0.5 : stopLoss - Math.abs(currentPrice - stopLoss) * 0.5;
        signals.push({
          id: randomUUID(),
          symbol,
          type,
          score: Math.abs(shortMA - longMA),
          price: currentPrice,
          stopLoss: parseFloat(stopLoss.toFixed(6)),
          takeProfit: parseFloat(takeProfit.toFixed(6)),
          liquidationPrice: parseFloat(liquidationPrice.toFixed(6)),
          trailingStop: parseFloat(trailingStop.toFixed(6)),
          currentMarketPrice: currentPrice,
          confidence: Math.abs(shortMA - longMA) / longMA > 0.01 ? "HIGH" : "MEDIUM",
          status: "PENDING",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          interval,
          signal_type: type.toLowerCase(),
          indicators,
          entry: parseFloat(currentPrice.toFixed(6)),
          sl: parseFloat(stopLoss.toFixed(6)),
          tp: parseFloat(takeProfit.toFixed(6)),
          trail: parseFloat(trailingStop.toFixed(6)),
          liquidation: parseFloat(liquidationPrice.toFixed(6)),
          margin_usdt,
          bb_slope: indicators.bollinger.upper.length ? "Contracting" : "Neutral",
          market: "Normal",
          leverage,
          risk_reward: riskReward,
          atr_multiplier: atrMultiplier,
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          signals: ["MA_CROSSOVER"]
        });
      }
    } catch (err) {
      console.error(`[Bybit] scanSignals failed for ${symbol}:`, err.message);
    }
  }
  await storage.setSignals(signals).catch((err) => {
    console.error("[Storage] setSignals failed:", err);
  });
  return signals;
}
async function executeTrade(trade) {
  try {
    const params = {
      category: "linear",
      symbol: trade.symbol,
      side: trade.side === "BUY" ? "Buy" : "Sell",
      orderType: trade.type,
      qty: trade.size.toString()
    };
    if (trade.type === "limit" && trade.price) params.price = trade.price.toString();
    if (trade.stopLoss) params.stopLoss = trade.stopLoss.toString();
    if (trade.takeProfit) params.takeProfit = trade.takeProfit.toString();
    const response = await bybitRestClient.submitOrder(params);
    await getPositions().catch((err) => {
      console.error("[Storage] getPositions after trade failed:", err);
    });
    return response.result;
  } catch (err) {
    console.error("[Bybit] executeTrade failed:", err.message);
    throw err;
  }
}
async function testConnection() {
  try {
    const serverTime = await bybitRestClient.getServerTime();
    console.log("[Bybit REST] Server time:", serverTime);
    await storage.setConnectionStatus("connected").catch((err) => {
      console.error("[Storage] setConnectionStatus failed:", err);
    });
    return true;
  } catch (err) {
    await storage.setConnectionStatus("disconnected").catch((err2) => {
      console.error("[Storage] setConnectionStatus failed:", err2);
    });
    console.error("[Bybit REST] Connection failed:", err.message);
    return false;
  }
}

// server/storage.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var FileLock = class {
  isLocked = false;
  queue = [];
  async acquire() {
    if (this.isLocked) {
      await new Promise((resolve) => this.queue.push(resolve));
    } else {
      this.isLocked = true;
    }
  }
  release() {
    this.isLocked = false;
    const next = this.queue.shift();
    if (next) next();
  }
};
var MemStorage = class {
  users;
  positions;
  signals;
  marketData;
  balance;
  apiConfig;
  notificationConfig;
  tradingConfig;
  appStatus;
  connectionStatus;
  DATA_FILE;
  fileLock;
  constructor() {
    this.DATA_FILE = path.join(__dirname, "data.json");
    this.fileLock = new FileLock();
    this.users = /* @__PURE__ */ new Map();
    this.positions = /* @__PURE__ */ new Map();
    this.signals = /* @__PURE__ */ new Map();
    this.marketData = /* @__PURE__ */ new Map();
    this.balance = { capital: 0, available: 0, used: 0 };
    this.apiConfig = { bybitApiKey: "", bybitApiSecret: "", bybitTestnet: true };
    this.notificationConfig = {
      discordEnabled: false,
      discordWebhook: "",
      telegramEnabled: false,
      telegramBotToken: "",
      telegramChatId: "",
      whatsappEnabled: false,
      whatsappNumber: ""
    };
    this.tradingConfig = {
      maxPositions: 5,
      riskPerTrade: 2,
      leverage: 10,
      stopLossPercent: 5,
      takeProfitPercent: 15,
      scanInterval: 300
    };
    this.appStatus = { tradingMode: "virtual", isAutomatedTradingEnabled: false };
    this.connectionStatus = "disconnected";
  }
  async init() {
    try {
      await this.initialize();
      console.log("[Storage] Initialized successfully");
    } catch (error) {
      console.error("[Storage] Failed to initialize:", error.message);
    }
  }
  async initialize() {
    const maxRetries = 3;
    let lastError = null;
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.loadFromFile();
        return;
      } catch (error) {
        lastError = error;
        console.error(`[Storage] Load attempt ${i + 1}/${maxRetries} failed:`, error.message);
        await new Promise((resolve) => setTimeout(resolve, 1e3));
      }
    }
    console.warn("[Storage] All load attempts failed, using in-memory defaults:", lastError.message);
    await this.saveToFile();
  }
  async saveToFile() {
    const maxRetries = 3;
    let lastError = null;
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
            connectionStatus: this.connectionStatus
          };
          await fs.writeFile(this.DATA_FILE, JSON.stringify(data, null, 2), { flag: "w" });
          return;
        } catch (error) {
          lastError = error;
          console.error(`[Storage] Save attempt ${i + 1}/${maxRetries} failed:`, error.message);
          if (i < maxRetries - 1) await new Promise((resolve) => setTimeout(resolve, 1e3));
        }
      }
      console.error("[Storage] All save attempts failed:", lastError.message);
    } finally {
      this.fileLock.release();
    }
  }
  async loadFromFile() {
    await this.fileLock.acquire();
    try {
      const data = await fs.readFile(this.DATA_FILE, "utf-8");
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
      console.log("[Storage] Loaded data from file successfully");
    } catch (error) {
      console.warn("[Storage] No data file found or parse error, using in-memory defaults");
      throw error;
    } finally {
      this.fileLock.release();
    }
  }
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByUsername(username) {
    return Array.from(this.users.values()).find((user) => user.name === username);
  }
  async createUser(insertUser) {
    const id = randomUUID2();
    const user = { ...insertUser, id };
    this.users.set(id, user);
    await this.saveToFile();
    return user;
  }
  async getPositions() {
    return Array.from(this.positions.values());
  }
  async setPositions(positions) {
    this.positions = new Map(positions.map((p) => [p.id, p]));
    await this.saveToFile();
  }
  async addPosition(position) {
    this.positions.set(position.id, position);
    await this.saveToFile();
  }
  async getSignals() {
    return Array.from(this.signals.values());
  }
  async setSignals(signals) {
    this.signals = new Map(signals.map((s) => [s.id, s]));
    await this.saveToFile();
  }
  async addSignal(signal) {
    this.signals.set(signal.id, signal);
    await this.saveToFile();
  }
  async generateSignals() {
    try {
      const signals = await scanSignals("60");
      await this.setSignals(signals);
      return signals;
    } catch (error) {
      console.error("[Storage] generateSignals failed:", error.message);
      return [];
    }
  }
  async getMarketData() {
    return Array.from(this.marketData.values());
  }
  async setMarketData(marketData) {
    this.marketData = new Map(marketData.map((m) => [m.symbol, m]));
    await this.saveToFile();
  }
  async getBalance() {
    return { ...this.balance };
  }
  async setBalance(balance) {
    this.balance = { ...balance };
    await this.saveToFile();
  }
  async getApiConfig() {
    return { ...this.apiConfig };
  }
  async setApiConfig(config2) {
    this.apiConfig = { ...config2 };
    await this.saveToFile();
  }
  async getNotificationConfig() {
    return { ...this.notificationConfig };
  }
  async setNotificationConfig(config2) {
    this.notificationConfig = { ...config2 };
    await this.saveToFile();
  }
  async getTradingConfig() {
    return { ...this.tradingConfig };
  }
  async setTradingConfig(config2) {
    this.tradingConfig = { ...config2 };
    await this.saveToFile();
  }
  async getAppStatus() {
    return { ...this.appStatus };
  }
  async setAppStatus(status) {
    this.appStatus = { ...status };
    await this.saveToFile();
  }
  async getConnectionStatus() {
    return this.connectionStatus;
  }
  async setConnectionStatus(status) {
    this.connectionStatus = status;
    await this.saveToFile();
  }
  getMarketDataSync() {
    return Array.from(this.marketData.values());
  }
};
var storage = new MemStorage();

// server/ml.ts
var MLFilter = class {
  /**
   * Apply ML weighting to a single signal
   */
  applyML(signal, closes, highs, lows, volumes) {
    const scores = scoreSignal(closes, highs, lows, volumes);
    const baseScore = signal.type === "BUY" ? scores.buyScore : scores.sellScore;
    let mlScore = 0.9;
    const indicators = signal.indicators;
    const signals = signal.signals || [];
    const rsi = indicators.rsi[indicators.rsi.length - 1] || 50;
    const macdHist = indicators.macd.histogram[indicators.macd.histogram.length - 1] || 0;
    const volatility = signal.indicators.atr[signal.indicators.atr.length - 1] / signal.price * 100 || 0;
    if (signals.includes("RSI_OVERSOLD") || signals.includes("BB_OVERSOLD")) {
      mlScore += 0.1;
    } else if (signals.includes("RSI_OVERBOUGHT") || signals.includes("BB_OVERBOUGHT")) {
      mlScore -= 0.1;
    }
    if (signals.includes("MACD_BULLISH") && macdHist > 0.01) {
      mlScore += 0.05;
    } else if (signals.includes("MACD_BEARISH") && macdHist < -0.01) {
      mlScore -= 0.05;
    }
    if (signals.includes("TREND_BULLISH") && signal.type === "BUY") {
      mlScore += 0.1;
    }
    if (volatility > 5) {
      mlScore -= 0.15;
    } else if (volatility < 1) {
      mlScore += 0.05;
    }
    mlScore = Math.min(Math.max(mlScore, 0), 1);
    const finalScore = 0.5 * baseScore + 0.5 * mlScore * 100;
    let confidence = "LOW";
    if (finalScore > 70) confidence = "HIGH";
    else if (finalScore > 40) confidence = "MEDIUM";
    return {
      ...signal,
      score: finalScore,
      confidence,
      executedPrice: signal.executedPrice ?? void 0
    };
  }
  /**
   * Filter multiple signals using ML
   */
  async filterSignals(signals) {
    const filtered = [];
    const marketData = await storage.getMarketData();
    for (const signal of signals) {
      if (signal.status !== "PENDING") continue;
      try {
        const kline = await bybitRestClient.getKline({
          category: "linear",
          symbol: signal.symbol,
          interval: signal.interval,
          limit: 100
        });
        const closes = kline.result.list.map((c) => parseFloat(c[4])).reverse();
        const highs = kline.result.list.map((c) => parseFloat(c[2])).reverse();
        const lows = kline.result.list.map((c) => parseFloat(c[3])).reverse();
        const volumes = kline.result.list.map((c) => parseFloat(c[5])).reverse();
        if (closes.length < 20) {
          console.warn(`[MLFilter] Insufficient data for ${signal.symbol}`);
          continue;
        }
        const updatedSignal = this.applyML(signal, closes, highs, lows, volumes);
        if (updatedSignal.score >= 40) {
          filtered.push(updatedSignal);
        }
      } catch (err) {
        console.error(`[MLFilter] Error processing ${signal.symbol}:`, err.message ?? err);
      }
    }
    await storage.setSignals(filtered);
    return filtered;
  }
};
async function processSignals() {
  const signals = await storage.getSignals();
  const mlFilter = new MLFilter();
  return mlFilter.filterSignals(signals);
}

// server/automatedTrader.ts
import { randomUUID as randomUUID3 } from "crypto";
var mapIntervalToKline = (intervalSeconds) => {
  const intervalMap = {
    60: "1",
    // 1 minute
    300: "5",
    // 5 minutes
    900: "15",
    // 15 minutes
    3600: "60",
    // 1 hour
    14400: "240",
    // 4 hours
    86400: "D"
    // 1 day
  };
  return intervalMap[intervalSeconds] || "15";
};
async function automatedTrader(mode = "virtual") {
  try {
    const tradingConfig = await storage.getTradingConfig().catch((err) => {
      console.error("[AutomatedTrader] Failed to get trading config:", err);
      return {
        maxPositions: 5,
        riskPerTrade: 2,
        leverage: 10,
        stopLossPercent: 5,
        takeProfitPercent: 15,
        scanInterval: 300
      };
    });
    const scanInterval = tradingConfig.scanInterval * 1e3;
    const maxPositions = tradingConfig.maxPositions;
    const klineInterval = mapIntervalToKline(tradingConfig.scanInterval);
    console.info(`[AutomatedTrader] Starting automated trading in ${mode} mode...`);
    while (true) {
      const status = await storage.getAppStatus().catch((err) => {
        console.error("[AutomatedTrader] Failed to get app status:", err);
        return { tradingMode: mode, isAutomatedTradingEnabled: true };
      });
      if (!status.isAutomatedTradingEnabled) {
        console.info("[AutomatedTrader] Automated trading disabled, stopping loop.");
        break;
      }
      try {
        const positions = await storage.getPositions().catch((err) => {
          console.error("[AutomatedTrader] Failed to get positions:", err);
          return [];
        });
        const openPositions = positions.filter((p) => p.status === "OPEN").length;
        if (openPositions >= maxPositions) {
          console.info(`[AutomatedTrader] Max positions (${maxPositions}) reached, skipping scan`);
          await new Promise((resolve) => setTimeout(resolve, scanInterval));
          continue;
        }
        const signals = await scanSignals(klineInterval, 10).catch((err) => {
          console.error("[AutomatedTrader] scanSignals failed:", err);
          return [];
        });
        console.info(`[AutomatedTrader] ${signals.length} signals scanned`);
        let processedSignals = [];
        try {
          processedSignals = await processSignals();
          console.info(`[AutomatedTrader] ${processedSignals.length} signals after ML processing`);
        } catch (err) {
          console.error("[AutomatedTrader] processSignals failed:", err.message);
          processedSignals = signals;
        }
        for (const signal of processedSignals) {
          if (signal.status !== "PENDING") continue;
          try {
            console.info(`[AutomatedTrader] Processing signal ${signal.id} for ${signal.symbol}`);
            const trade = {
              symbol: signal.symbol,
              side: signal.type,
              size: signal.margin_usdt * signal.leverage,
              // Placeholder; adjust as needed
              type: "market",
              price: signal.price,
              stopLoss: signal.stopLoss,
              takeProfit: signal.takeProfit
            };
            const position = await executeTrade(trade);
            if (position) {
              const newPosition = {
                id: randomUUID3(),
                // Ensure crypto.randomUUID is available
                symbol: signal.symbol,
                side: signal.type,
                size: trade.size,
                leverage: signal.leverage,
                entryPrice: signal.price,
                currentPrice: signal.currentMarketPrice,
                pnl: 0,
                pnlPercent: 0,
                status: "OPEN",
                openTime: (/* @__PURE__ */ new Date()).toISOString(),
                stopLoss: signal.stopLoss,
                takeProfit: signal.takeProfit,
                liquidationPrice: signal.liquidationPrice,
                trailingStop: signal.trailingStop
              };
              await storage.addPosition(newPosition).catch((err) => {
                console.error("[AutomatedTrader] Failed to add position:", err);
              });
              console.info(
                `[AutomatedTrader] Trade executed for ${signal.symbol} - Entry: ${newPosition.entryPrice}, Size: ${newPosition.size}`
              );
            } else {
              console.warn(`[AutomatedTrader] Trade execution failed for ${signal.symbol}`);
            }
          } catch (err) {
            console.error(`[AutomatedTrader] Trade execution failed for ${signal.symbol}:`, err.message);
          }
        }
      } catch (err) {
        console.error(`[AutomatedTrader] Error in trading loop:`, err.message);
        if (err.message.includes("API key invalid") || err.message.includes("Network error")) {
          console.error("[AutomatedTrader] Critical error, stopping trading");
          await stopAutomatedTrading();
          break;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, scanInterval));
    }
    console.info("[AutomatedTrader] Automated trading stopped.");
  } catch (err) {
    console.error("[AutomatedTrader] Fatal error:", err.message);
    throw err;
  }
}
async function startAutomatedTrading(mode = "virtual") {
  try {
    const status = await storage.getAppStatus().catch((err) => {
      console.error("[AutomatedTrader] Failed to get app status:", err);
      return { tradingMode: mode, isAutomatedTradingEnabled: false };
    });
    if (!status.isAutomatedTradingEnabled) {
      await storage.setAppStatus({ ...status, isAutomatedTradingEnabled: true }).catch((err) => {
        console.error("[AutomatedTrader] Failed to set app status:", err);
      });
      automatedTrader(mode).catch((err) => {
        console.error("[AutomatedTrader] Unhandled error:", err);
      });
    } else {
      console.info("[AutomatedTrader] Automated trading already running.");
    }
  } catch (err) {
    console.error("[AutomatedTrader] Failed to start automated trading:", err.message);
  }
}
async function stopAutomatedTrading() {
  try {
    const status = await storage.getAppStatus().catch((err) => {
      console.error("[AutomatedTrader] Failed to get app status:", err);
      return { tradingMode: "virtual", isAutomatedTradingEnabled: true };
    });
    await storage.setAppStatus({ ...status, isAutomatedTradingEnabled: false }).catch((err) => {
      console.error("[AutomatedTrader] Failed to set app status:", err);
    });
    console.info("[AutomatedTrader] Stopping automated trading...");
  } catch (err) {
    console.error("[AutomatedTrader] Failed to stop automated trading:", err.message);
  }
}

// server/notifications.ts
import fetch from "node-fetch";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as dotenv2 from "dotenv";
import FormData from "form-data";
dotenv2.config();
var DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";
var TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
var TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
var WHATSAPP_NUMBER = process.env.WHATSAPP_TO || "";
function formatSignalBlock(signal) {
  return `\u{1F4B9} **${signal.symbol}**
\u{1F539} **${signal.type}** | Score: ${signal.score.toFixed(1)}
\u{1F539} Entry: ${signal.entry.toFixed(2)} | Confidence: ${signal.confidence}
\u{1F539} Stop Loss: ${signal.sl.toFixed(2)} | Take Profit: ${signal.tp.toFixed(2)}
\u{1F539} Leverage: ${signal.leverage}x | Risk/Reward: ${signal.risk_reward.toFixed(2)}
\u{1F539} Interval: ${signal.interval} | Market: ${signal.market}
\u{1F539} Generated: ${signal.created_at}
`;
}
async function generatePDFBytes(signals) {
  if (!signals.length) return new Uint8Array();
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 10;
  let y = 800;
  page.drawText("AlgoTrader Pro - Trading Signals", {
    x: 50,
    y,
    size: 14,
    font,
    color: rgb(0, 0, 0)
  });
  y -= 20;
  for (let i = 0; i < signals.length && i < 25; i++) {
    const s = signals[i];
    const lines = [
      `Signal #${i + 1}: ${s.symbol}`,
      `Type: ${s.type} | Score: ${s.score.toFixed(1)}`,
      `Entry: ${s.entry.toFixed(2)} | Confidence: ${s.confidence}`,
      `Stop Loss: ${s.sl.toFixed(2)} | Take Profit: ${s.tp.toFixed(2)}`,
      `Leverage: ${s.leverage}x | Risk/Reward: ${s.risk_reward.toFixed(2)}`,
      `Interval: ${s.interval} | Market: ${s.market}`,
      `Generated: ${s.created_at}`,
      "----------------------------------------"
    ];
    for (const line of lines) {
      page.drawText(line, { x: 50, y, size: fontSize, font, color: rgb(0, 0, 0) });
      y -= 12;
    }
    y -= 5;
    if (y < 50) break;
  }
  return await pdfDoc.save();
}
async function sendDiscord(signals) {
  if (!DISCORD_WEBHOOK_URL || !signals.length) {
    console.warn("[sendDiscord] No webhook URL or signals provided");
    return;
  }
  try {
    const message = signals.slice(0, 5).map(formatSignalBlock).join("\n");
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message })
    });
    if (!response.ok) {
      console.error(`[sendDiscord] Failed to send message: ${response.statusText}`);
      return;
    }
    const pdfBytes = await generatePDFBytes(signals);
    if (pdfBytes.length) {
      const formData = new FormData();
      formData.append("file", Buffer.from(pdfBytes), { filename: "signals.pdf", contentType: "application/pdf" });
      formData.append("payload_json", JSON.stringify({ content: "Trading Signals PDF" }));
      const fileResponse = await fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${formData.getBoundary()}`,
          "Content-Length": formData.getLengthSync().toString()
        },
        body: formData.getBuffer()
      });
      if (!fileResponse.ok) {
        console.error(`[sendDiscord] Failed to send PDF: ${fileResponse.statusText}`);
      } else {
        console.info("[sendDiscord] PDF sent successfully");
      }
    }
  } catch (err) {
    console.error(`[sendDiscord] Error:`, err.message ?? err);
  }
}
async function sendTelegram(signals) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || !signals.length) {
    console.warn("[sendTelegram] Missing bot token, chat ID, or signals");
    return;
  }
  try {
    const message = signals.slice(0, 5).map(formatSignalBlock).join("\n");
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      body: new URLSearchParams({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: "Markdown" })
    });
    if (!response.ok) {
      console.error(`[sendTelegram] Failed to send message: ${response.statusText}`);
      return;
    }
    const pdfBytes = await generatePDFBytes(signals);
    if (pdfBytes.length) {
      const formData = new FormData();
      formData.append("chat_id", TELEGRAM_CHAT_ID);
      formData.append("document", Buffer.from(pdfBytes), { filename: "signals.pdf", contentType: "application/pdf" });
      const fileUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`;
      const fileResponse = await fetch(fileUrl, {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${formData.getBoundary()}`,
          "Content-Length": formData.getLengthSync().toString()
        },
        body: formData.getBuffer()
      });
      if (!fileResponse.ok) {
        console.error(`[sendTelegram] Failed to send PDF: ${fileResponse.statusText}`);
      } else {
        console.info("[sendTelegram] PDF sent successfully");
      }
    }
  } catch (err) {
    console.error(`[sendTelegram] Error:`, err.message ?? err);
  }
}
function sendWhatsApp(signals, toNumber) {
  toNumber = toNumber || WHATSAPP_NUMBER;
  if (!toNumber || !signals.length) {
    console.warn("[sendWhatsApp] Missing phone number or signals");
    return;
  }
  try {
    const message = signals.slice(0, 3).map(formatSignalBlock).join("\n");
    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/${toNumber}?text=${encoded}`;
    console.info(`[sendWhatsApp] WhatsApp URL generated: ${url}`);
  } catch (err) {
    console.error(`[sendWhatsApp] Error:`, err.message ?? err);
  }
}
async function sendAllNotifications(signals) {
  if (!signals.length) {
    console.warn("[sendAllNotifications] No signals to send");
    return;
  }
  await Promise.all([
    sendDiscord(signals),
    sendTelegram(signals),
    sendWhatsApp(signals)
  ]);
}

// server/routes.ts
async function registerRoutes(app2) {
  const httpServer = createServer(app2);
  app2.get("/api/positions", async (req, res) => {
    try {
      const positions = await getPositions();
      res.json(positions);
    } catch (error) {
      console.error("[Routes] Failed to fetch positions:", error.message ?? error);
      res.status(500).json({ error: "Failed to fetch positions" });
    }
  });
  app2.get("/api/signals", async (req, res) => {
    try {
      const signals = await storage.getSignals();
      res.json(signals);
    } catch (error) {
      console.error("[Routes] Failed to fetch signals:", error.message ?? error);
      res.status(500).json({ error: "Failed to fetch signals" });
    }
  });
  app2.post("/api/scan-signals", async (req, res) => {
    try {
      const { interval = "15", limit = 50 } = req.body;
      if (!interval || typeof interval !== "string" || !limit || typeof limit !== "number") {
        return res.status(400).json({ error: "Invalid interval or limit" });
      }
      const signals = await scanSignals(interval, limit);
      await sendAllNotifications(signals);
      res.json(signals);
    } catch (error) {
      console.error("[Routes] Failed to scan signals:", error.message ?? error);
      res.status(500).json({ error: "Failed to scan signals" });
    }
  });
  app2.post("/api/trade", async (req, res) => {
    try {
      const trade = req.body;
      if (!trade.symbol || !trade.side || !["BUY", "SELL"].includes(trade.side) || !trade.size || !["market", "limit"].includes(trade.type)) {
        return res.status(400).json({ error: "Invalid trade parameters" });
      }
      const result = await executeTrade(trade);
      res.json(result);
    } catch (error) {
      console.error("[Routes] Failed to execute trade:", error.message ?? error);
      res.status(500).json({ error: "Failed to execute trade" });
    }
  });
  app2.get("/api/market-data", async (req, res) => {
    try {
      const data = await getMarketData();
      res.json(data);
    } catch (error) {
      console.error("[Routes] Failed to fetch market data:", error.message ?? error);
      res.status(500).json({ error: "Failed to fetch market data" });
    }
  });
  app2.get("/api/balance", async (req, res) => {
    try {
      const balance = await getBalance();
      res.json(balance);
    } catch (error) {
      console.error("[Routes] Failed to fetch balance:", error.message ?? error);
      res.status(500).json({ error: "Failed to fetch balance" });
    }
  });
  app2.post("/api/test-connection", async (req, res) => {
    try {
      const success = await testConnection();
      res.json({ success });
    } catch (error) {
      console.error("[Routes] Failed to test connection:", error.message ?? error);
      res.status(500).json({ error: "Failed to test connection" });
    }
  });
  app2.post("/api/automated-trading", async (req, res) => {
    try {
      const { enabled, mode = "virtual" } = req.body;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "Invalid enabled parameter" });
      }
      if (enabled) {
        await startAutomatedTrading(mode);
      } else {
        await stopAutomatedTrading();
      }
      res.json({ success: true });
    } catch (error) {
      console.error("[Routes] Failed to toggle automated trading:", error.message ?? error);
      res.status(500).json({ error: "Failed to toggle automated trading" });
    }
  });
  app2.get("/api/app-status", async (req, res) => {
    try {
      const status = await storage.getAppStatus();
      res.json(status);
    } catch (error) {
      console.error("[Routes] Failed to fetch app status:", error.message ?? error);
      res.status(500).json({ error: "Failed to fetch app status" });
    }
  });
  app2.post("/api/app-status", async (req, res) => {
    try {
      const status = req.body;
      await storage.setAppStatus(status);
      res.json({ success: true });
    } catch (error) {
      console.error("[Routes] Failed to update app status:", error.message ?? error);
      res.status(500).json({ error: "Failed to update app status" });
    }
  });
  app2.get("/api/api-config", async (req, res) => {
    try {
      const config2 = await storage.getApiConfig();
      res.json(config2);
    } catch (error) {
      console.error("[Routes] Failed to fetch API config:", error.message ?? error);
      res.status(500).json({ error: "Failed to fetch API config" });
    }
  });
  app2.post("/api/api-config", async (req, res) => {
    try {
      const config2 = req.body;
      await storage.setApiConfig(config2);
      res.json({ success: true });
    } catch (error) {
      console.error("[Routes] Failed to save API config:", error.message ?? error);
      res.status(500).json({ error: "Failed to save API config" });
    }
  });
  app2.get("/api/notification-config", async (req, res) => {
    try {
      const config2 = await storage.getNotificationConfig();
      res.json(config2);
    } catch (error) {
      console.error("[Routes] Failed to fetch notification config:", error.message ?? error);
      res.status(500).json({ error: "Failed to fetch notification config" });
    }
  });
  app2.post("/api/notification-config", async (req, res) => {
    try {
      const config2 = req.body;
      await storage.setNotificationConfig(config2);
      res.json({ success: true });
    } catch (error) {
      console.error("[Routes] Failed to save notification config:", error.message ?? error);
      res.status(500).json({ error: "Failed to save notification config" });
    }
  });
  app2.get("/api/trading-config", async (req, res) => {
    try {
      const config2 = await storage.getTradingConfig();
      res.json(config2);
    } catch (error) {
      console.error("[Routes] Failed to fetch trading config:", error.message ?? error);
      res.status(500).json({ error: "Failed to fetch trading config" });
    }
  });
  app2.post("/api/trading-config", async (req, res) => {
    try {
      const config2 = req.body;
      await storage.setTradingConfig(config2);
      res.json({ success: true });
    } catch (error) {
      console.error("[Routes] Failed to save trading config:", error.message ?? error);
      res.status(500).json({ error: "Failed to save trading config" });
    }
  });
  app2.get("/api/connection-status", async (req, res) => {
    try {
      const status = await storage.getConnectionStatus();
      res.json({ status });
    } catch (error) {
      console.error("[Routes] Failed to fetch connection status:", error.message ?? error);
      res.status(500).json({ error: "Failed to fetch connection status" });
    }
  });
  app2.post("/api/send-notifications", async (req, res) => {
    try {
      const { signals = await storage.getSignals() } = req.body;
      await sendAllNotifications(signals);
      res.json({ success: true });
    } catch (error) {
      console.error("[Routes] Failed to send notifications:", error.message ?? error);
      res.status(500).json({ error: "Failed to send notifications" });
    }
  });
  const marketWSS = new WebSocketServer({ server: httpServer, path: "/ws/market-data" });
  const positionsWSS = new WebSocketServer({ server: httpServer, path: "/ws/positions" });
  const signalsWSS = new WebSocketServer({ server: httpServer, path: "/ws/signals" });
  bybitWsClient.on("update", async (data) => {
    if (data.topic?.startsWith("tickers.")) {
      try {
        const update = {
          symbol: data.data.symbol,
          price: parseFloat(data.data.lastPrice) || 0,
          change24h: parseFloat(data.data.price24hPcnt) || 0,
          changePercent24h: parseFloat(data.data.price24hPcnt) * 100 || 0,
          volume24h: parseFloat(data.data.turnover24h) || 0,
          high24h: parseFloat(data.data.highPrice24h) || 0,
          low24h: parseFloat(data.data.lowPrice24h) || 0
        };
        const marketData = await storage.getMarketData();
        const index = marketData.findIndex((d) => d.symbol === update.symbol);
        if (index >= 0) marketData[index] = update;
        else marketData.push(update);
        await storage.setMarketData(marketData);
        marketWSS.clients.forEach((client) => {
          if (client.readyState === client.OPEN) client.send(JSON.stringify(update));
        });
      } catch (err) {
        console.error("[WebSocket] Error broadcasting market data:", err.message ?? err);
      }
    }
  });
  marketWSS.on("connection", (ws) => {
    console.log("[WebSocket] Market WS client connected");
    ws.on("close", () => console.log("[WebSocket] Market WS client disconnected"));
  });
  positionsWSS.on("connection", async (ws) => {
    console.log("[WebSocket] Positions WS client connected");
    try {
      const positions = await storage.getPositions();
      ws.send(JSON.stringify({ action: "update", data: positions }));
    } catch (err) {
      console.error("[WebSocket] Error sending initial positions:", err.message ?? err);
    }
    ws.on("close", () => console.log("[WebSocket] Positions WS client disconnected"));
  });
  signalsWSS.on("connection", async (ws) => {
    console.log("[WebSocket] Signals WS client connected");
    try {
      const signals = await storage.getSignals();
      ws.send(JSON.stringify({ action: "update", data: signals }));
    } catch (err) {
      console.error("[WebSocket] Error sending initial signals:", err.message ?? err);
    }
    ws.on("close", () => console.log("[WebSocket] Signals WS client disconnected"));
  });
  setInterval(async () => {
    try {
      const positions = await getPositions();
      positionsWSS.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify({ action: "update", data: positions }));
        }
      });
      const signals = await storage.getSignals();
      signalsWSS.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify({ action: "update", data: signals }));
        }
      });
    } catch (err) {
      console.error("[WebSocket] Error polling positions or signals:", err.message ?? err);
    }
  }, 3e4);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs2 from "fs";
import path3 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path2 from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path2.resolve(import.meta.dirname, "client", "src"),
      "@shared": path2.resolve(import.meta.dirname, "shared"),
      "@assets": path2.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path2.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path2.resolve(import.meta.dirname, "server/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    },
    host: "0.0.0.0",
    allowedHosts: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
import { fileURLToPath as fileURLToPath2 } from "url";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path3.dirname(__filename2);
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server2) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server: server2 },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path3.resolve(
        __dirname2,
        "..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path3.resolve(__dirname2, "..", "public");
  if (!fs2.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path3.resolve(distPath, "index.html"));
  });
}

// server/index.ts
dotenv3.config();
process.on("uncaughtException", (error) => {
  log(`[Uncaught Exception] ${error.message}
${error.stack}`);
});
process.on("unhandledRejection", (reason, promise) => {
  log(`[Unhandled Rejection] at: ${promise} reason: ${reason}`);
});
var app = express2();
var PORT = parseInt(process.env.PORT || "5000", 10);
var server = http.createServer(app);
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:8000",
      "http://localhost:3000",
      "http://0.0.0.0:5000",
      "http://0.0.0.0:8000",
      process.env.FRONTEND_URL || "http://localhost:3000",
      /\.replit\.app$/,
      /\.repl\.co$/
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);
app.use(express2.json({ limit: "10mb" }));
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path4 = req.path;
  let capturedJsonResponse;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path4.startsWith("/api") || path4.startsWith("/ws")) {
      let logLine = `${req.method} ${path4} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse)
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "\u2026";
      log(logLine);
    }
  });
  next();
});
app.get("/", (_req, res) => {
  res.send("AlgoTraderPro Backend Running");
});
(async () => {
  try {
    try {
      await storage.init();
    } catch (error) {
      log(`[Storage] Failed to initialize: ${error.message}, using in-memory defaults`);
    }
    await registerRoutes(app);
    app.use(
      (err, _req, res, _next) => {
        const status2 = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        const stack = process.env.NODE_ENV === "development" ? err.stack : void 0;
        res.status(status2).json({ message, stack });
        log(
          `[Error] ${status2} - ${message}${stack ? `
${stack}` : ""}`
        );
      }
    );
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }
    server.listen(PORT, "0.0.0.0", () => {
      log(`Server running on http://0.0.0.0:${PORT}`);
    });
    const status = await storage.getAppStatus();
    if (status.isAutomatedTradingEnabled) {
      log(
        `[Server] Starting automated trading in ${status.tradingMode || "virtual"} mode`
      );
      try {
        await startAutomatedTrading(status.tradingMode || "virtual");
      } catch (error) {
        log(`[AutomatedTrading] Failed to start: ${error.message}`);
      }
    }
  } catch (error) {
    log(`[Server] Failed to start server: ${error.message ?? error}`);
    process.exit(1);
  }
})();
