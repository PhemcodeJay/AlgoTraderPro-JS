import { RestClientV5, WebsocketClient, KlineIntervalV3 } from 'bybit-api';
import dotenv from 'dotenv';
import { storage, Position, MarketData, Balance, Signal } from './storage';
import { randomUUID } from 'crypto';
import { IndicatorData, calculateIndicators } from './indicators';

dotenv.config();

// --- Validate environment variables ---
const API_KEY = process.env.BYBIT_API_KEY;
const API_SECRET = process.env.BYBIT_API_SECRET;
const USE_MAINNET = process.env.BYBIT_MAINNET === 'true' || process.env.BYBIT_TESTNET === 'false';

if (!API_KEY || !API_SECRET) {
  console.warn('[Bybit] Warning: BYBIT_API_KEY and BYBIT_API_SECRET not set. Using demo mode.');
  // Don't exit - allow the app to run in demo mode without real API access
}

console.log(`[Bybit] Client starting on: ${USE_MAINNET ? 'MAINNET' : 'TESTNET'}`);

// --- Base URLs ---
const BASE_URL = USE_MAINNET
  ? 'https://api.bybit.com'
  : 'https://api-testnet.bybit.com';

const WS_URL = USE_MAINNET
  ? 'wss://stream.bybit.com/v5/public/linear'
  : 'wss://stream-testnet.bybit.com/v5/public/linear';

// --- REST Client ---
export const bybitRestClient = new RestClientV5({
  key: API_KEY,
  secret: API_SECRET,
  baseUrl: BASE_URL,
});

// --- WebSocket Client ---
export const bybitWsClient = new WebsocketClient({
  market: 'v5',
  wsUrl: WS_URL,
});

// --- Safe subscription wrapper with retry ---
async function safeSubscribe(topics: string[], retries = 3, delay = 1000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await bybitWsClient.subscribe(topics);
      console.log('[Bybit WS] Subscribed to topics:', topics);
      return;
    } catch (err: any) {
      console.error(`[Bybit WS] Subscription failed (attempt ${i + 1}/${retries}):`, err.message);
      if (i < retries - 1) await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('[Bybit WS] Max subscription retries reached');
}

// --- Initialize WebSocket with retry limit ---
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

export function initWebSocket() {
  bybitWsClient.on('open', async () => {
    console.log('[Bybit WS] Connected');
    reconnectAttempts = 0;
    try {
      await safeSubscribe(['tickers.BTCUSDT', 'tickers.ETHUSDT']);
    } catch (err: any) {
      console.error('[Bybit WS] Failed to subscribe:', err.message);
    }
  });

  bybitWsClient.on('update', async (msg: any) => {
    if (msg.topic?.startsWith('tickers.')) {
      try {
        const data = msg.data;
        const update: MarketData = {
          symbol: data.symbol,
          price: parseFloat(data.lastPrice) || 0,
          change24h: parseFloat(data.price24hPcnt) || 0,
          changePercent24h: parseFloat(data.price24hPcnt) * 100 || 0,
          volume24h: parseFloat(data.turnover24h) || 0,
          high24h: parseFloat(data.highPrice24h) || 0,
          low24h: parseFloat(data.lowPrice24h) || 0,
        };
        const current = await storage.getMarketData().catch((err) => {
          console.error('[Storage] getMarketData failed:', err);
          return [] as MarketData[];
        });
        const idx = current.findIndex((d) => d.symbol === update.symbol);
        if (idx >= 0) current[idx] = update;
        else current.push(update);
        await storage.setMarketData(current).catch((err) => {
          console.error('[Storage] setMarketData failed:', err);
        });
      } catch (err: any) {
        console.error('[Bybit WS] Error updating market data:', err.message);
      }
    }
  });

  bybitWsClient.on('error', (err: any) => {
    console.error('[Bybit WS] Error:', err?.message || err);
  });

  bybitWsClient.on('close', () => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[Bybit WS] Max reconnect attempts reached, stopping retries');
      return;
    }
    reconnectAttempts++;
    console.warn(`[Bybit WS] Connection closed, reconnecting (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
    setTimeout(initWebSocket, 3000);
  });
}
initWebSocket();

// --- Fetch market data with retry ---
export async function getMarketData(symbols: string[] = ['BTCUSDT', 'ETHUSDT'], retries = 3): Promise<MarketData[]> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await bybitRestClient.getTickers({ category: 'linear', symbol: symbols.join(',') });
      const marketData: MarketData[] = response.result.list.map((item: any) => ({
        symbol: item.symbol,
        price: parseFloat(item.lastPrice) || 0,
        change24h: parseFloat(item.price24hPcnt) || 0,
        changePercent24h: parseFloat(item.price24hPcnt) * 100 || 0,
        volume24h: parseFloat(item.turnover24h) || 0,
        high24h: parseFloat(item.highPrice24h) || 0,
        low24h: parseFloat(item.lowPrice24h) || 0,
      }));
      await storage.setMarketData(marketData).catch((err) => {
        console.error('[Storage] setMarketData failed:', err);
      });
      return marketData;
    } catch (err: any) {
      console.error(`[Bybit] getMarketData failed (attempt ${i + 1}/${retries}):`, err.message);
      if (i < retries - 1) await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  console.error('[Bybit] Max retries reached for getMarketData');
  return [];
}

// --- Fetch positions ---
export async function getPositions(): Promise<Position[]> {
  try {
    const response = await bybitRestClient.getPositionInfo({ category: 'linear' });
    const positions: Position[] = response.result.list.map((pos: any) => ({
      id: pos.positionIdx.toString(),
      symbol: pos.symbol,
      side: pos.side === 'Buy' ? 'BUY' : 'SELL',
      size: parseFloat(pos.size) || 0,
      entryPrice: parseFloat(pos.avgPrice) || 0,
      currentPrice: parseFloat(pos.markPrice) || 0,
      pnl: parseFloat(pos.unrealisedPnl) || 0,
      pnlPercent: parseFloat(pos.positionValue) > 0
        ? (parseFloat(pos.unrealisedPnl) / parseFloat(pos.positionValue)) * 100
        : 0,
      status: parseFloat(pos.size) > 0 ? 'OPEN' : 'CLOSED',
      openTime: new Date(Number(pos.createdTime)).toISOString(),
      closeTime: pos.updatedTime && parseFloat(pos.size) === 0
        ? new Date(Number(pos.updatedTime)).toISOString()
        : undefined,
      exitPrice: parseFloat(pos.size) === 0 && pos.avgPrice ? parseFloat(pos.avgPrice) : undefined,
      leverage: parseFloat(pos.leverage) || 10,
      stopLoss: parseFloat(pos.stopLoss) || undefined,
      takeProfit: parseFloat(pos.takeProfit) || undefined,
      liquidationPrice: parseFloat(pos.liqPrice) || undefined,
      trailingStop: parseFloat(pos.trailingStop) || undefined,
    }));
    await storage.setPositions(positions).catch((err) => {
      console.error('[Storage] setPositions failed:', err);
    });
    return positions;
  } catch (err: any) {
    console.error('[Bybit] getPositions failed:', err.message);
    return [];
  }
}

// --- Fetch balance ---
export async function getBalance(): Promise<Balance> {
  try {
    const response = await bybitRestClient.getWalletBalance({ accountType: 'UNIFIED' });
    const usdt = response.result.list[0].coin.find((c: any) => c.coin === 'USDT');
    const balance: Balance = {
      capital: parseFloat(usdt?.equity || '0'),
      available: parseFloat(usdt?.availableToWithdraw || '0'),
      used: parseFloat(usdt?.locked || '0'),
    };
    await storage.setBalance(balance).catch((err) => {
      console.error('[Storage] setBalance failed:', err);
    });
    return balance;
  } catch (err: any) {
    console.error('[Bybit] getBalance failed:', err.message);
    return { capital: 0, available: 0, used: 0 };
  }
}

// --- Scan trading signals ---
export async function scanSignals(interval: KlineIntervalV3 | string = '15', limit: number = 50): Promise<Signal[]> {
  const symbols = ['BTCUSDT', 'ETHUSDT'];
  const signals: Signal[] = [];
  const tradingConfig = await storage.getTradingConfig().catch((err) => {
    console.error('[Storage] getTradingConfig failed:', err);
    return { leverage: 10, stopLossPercent: 2, takeProfitPercent: 4 };
  });

  for (const symbol of symbols) {
    try {
      const kline = await bybitRestClient.getKline({ category: 'linear', symbol, interval: interval as KlineIntervalV3, limit });
      const closes = kline.result.list.map((c: any) => parseFloat(c[4])).reverse();
      const highs = kline.result.list.map((c: any) => parseFloat(c[2])).reverse();
      const lows = kline.result.list.map((c: any) => parseFloat(c[3])).reverse();
      if (closes.length < 20) continue;

      const shortMA = closes.slice(-5).reduce((a, b) => a + b, 0) / 5;
      const longMA = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;

      let type: 'BUY' | 'SELL' | null = null;
      if (shortMA > longMA) type = 'BUY';
      if (shortMA < longMA) type = 'SELL';

      if (type) {
        const currentPrice = closes[closes.length - 1];
        const indicators = calculateIndicators(closes, highs, lows, []); // Fixed: Pass arrays separately
        const atr = indicators.atr[indicators.atr.length - 1] || 0;
        const leverage = tradingConfig.leverage || 10;
        const riskReward = 2;
        const atrMultiplier = 2;
        const margin_usdt = 1.0;

        const stopLoss = type === 'BUY'
          ? currentPrice * (1 - (tradingConfig.stopLossPercent || 2) / 100)
          : currentPrice * (1 + (tradingConfig.stopLossPercent || 2) / 100);
        const takeProfit = type === 'BUY'
          ? currentPrice * (1 + (tradingConfig.takeProfitPercent || 4) / 100)
          : currentPrice * (1 - (tradingConfig.takeProfitPercent || 4) / 100);
        const liquidationPrice = type === 'BUY'
          ? currentPrice * (1 - 0.9 / leverage)
          : currentPrice * (1 + 0.9 / leverage);
        const trailingStop = type === 'BUY'
          ? stopLoss + (Math.abs(currentPrice - stopLoss) * 0.5)
          : stopLoss - (Math.abs(currentPrice - stopLoss) * 0.5);

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
          confidence: Math.abs(shortMA - longMA) / longMA > 0.01 ? 'HIGH' : 'MEDIUM',
          status: 'PENDING',
          timestamp: new Date().toISOString(),
          interval,
          signal_type: type.toLowerCase(),
          indicators,
          entry: parseFloat(currentPrice.toFixed(6)),
          sl: parseFloat(stopLoss.toFixed(6)),
          tp: parseFloat(takeProfit.toFixed(6)),
          trail: parseFloat(trailingStop.toFixed(6)),
          liquidation: parseFloat(liquidationPrice.toFixed(6)),
          margin_usdt,
          bb_slope: indicators.bollinger.upper.length ? 'Contracting' : 'Neutral',
          market: 'Normal',
          leverage,
          risk_reward: riskReward,
          atr_multiplier: atrMultiplier,
          created_at: new Date().toISOString(),
          signals: ['MA_CROSSOVER'],
        });
      }
    } catch (err: any) {
      console.error(`[Bybit] scanSignals failed for ${symbol}:`, err.message);
    }
  }

  await storage.setSignals(signals).catch((err) => {
    console.error('[Storage] setSignals failed:', err);
  });
  return signals;
}

// --- Execute trade ---
export async function executeTrade(trade: {
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  type: 'market' | 'limit';
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
}) {
  try {
    const params: any = {
      category: 'linear',
      symbol: trade.symbol,
      side: trade.side === 'BUY' ? 'Buy' : 'Sell',
      orderType: trade.type,
      qty: trade.size.toString(),
    };

    if (trade.type === 'limit' && trade.price) params.price = trade.price.toString();
    if (trade.stopLoss) params.stopLoss = trade.stopLoss.toString();
    if (trade.takeProfit) params.takeProfit = trade.takeProfit.toString();

    const response = await bybitRestClient.submitOrder(params);
    await getPositions().catch((err) => {
      console.error('[Storage] getPositions after trade failed:', err);
    });
    return response.result;
  } catch (err: any) {
    console.error('[Bybit] executeTrade failed:', err.message);
    throw err;
  }
}

// --- Test connection ---
export async function testConnection(): Promise<boolean> {
  try {
    const serverTime = await bybitRestClient.getServerTime();
    console.log('[Bybit REST] Server time:', serverTime);
    await storage.setConnectionStatus('connected').catch((err) => {
      console.error('[Storage] setConnectionStatus failed:', err);
    });
    return true;
  } catch (err: any) {
    await storage.setConnectionStatus('disconnected').catch((err) => {
      console.error('[Storage] setConnectionStatus failed:', err);
    });
    console.error('[Bybit REST] Connection failed:', err.message);
    return false;
  }
}