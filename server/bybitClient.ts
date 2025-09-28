import { RestClientV5, WebsocketClient } from 'bybit-api';
import dotenv from 'dotenv';
import { storage, Position, MarketData, Balance, Signal } from './storage';
import { randomUUID } from 'crypto';

dotenv.config();

const API_KEY = process.env.BYBIT_API_KEY || '';
const API_SECRET = process.env.BYBIT_API_SECRET || '';
const IS_MAINNET = process.env.BYBIT_MAINNET === 'true';
const IS_TESTNET = process.env.BYBIT_TESTNET === 'true';
const USE_MAINNET = IS_TESTNET ? false : IS_MAINNET;

console.log(`[Bybit] Client starting on: ${USE_MAINNET ? 'MAINNET' : 'TESTNET'}`);

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
  market: 'linear',
  wsUrl: WS_URL,
});

// --- Safe subscription wrapper ---
async function safeSubscribe(topics: string[]) {
  try {
    await bybitWsClient.subscribe(topics);
    console.log('[Bybit WS] Subscribed to topics:', topics);
  } catch (err) {
    console.error('[Bybit WS] Subscription failed:', err);
  }
}

// --- Initialize WebSocket ---
export function initWebSocket() {
  bybitWsClient.on('open', async () => {
    console.log('[Bybit WS] Connected');
    await safeSubscribe(['tickers.BTCUSDT', 'tickers.ETHUSDT']);
  });

  bybitWsClient.on('update', (msg: any) => {
    if (msg.topic?.startsWith('tickers.')) {
      const data = msg.data;
      const current = storage.getMarketDataSync() || [];
      const idx = current.findIndex(d => d.symbol === data.symbol);
      const updated: MarketData = {
        symbol: data.symbol,
        price: parseFloat(data.lastPrice),
        change24h: parseFloat(data.price24hPcnt),
        changePercent24h: parseFloat(data.price24hPcnt) * 100,
        volume24h: parseFloat(data.turnover24h),
        high24h: parseFloat(data.highPrice24h),
        low24h: parseFloat(data.lowPrice24h),
      };
      if (idx >= 0) current[idx] = updated;
      else current.push(updated);
      storage.setMarketData(current);
    }
  });

  bybitWsClient.on('error', (err: any) => {
    console.error('[Bybit WS] Error:', err);
  });

  bybitWsClient.on('close', () => {
    console.warn('[Bybit WS] Connection closed, reconnecting...');
    setTimeout(initWebSocket, 3000);
  });

  // WebSocket auto-connects on instantiation
}
initWebSocket();

// --- Fetch market data ---
export async function getMarketData(symbols: string[] = ['BTCUSDT', 'ETHUSDT']): Promise<MarketData[]> {
  const response = await bybitRestClient.getTickers({ category: 'linear', symbol: symbols.join(',') });
  const marketData: MarketData[] = response.result.list.map((item: any) => ({
    symbol: item.symbol,
    price: parseFloat(item.lastPrice),
    change24h: parseFloat(item.price24hPcnt),
    changePercent24h: parseFloat(item.price24hPcnt) * 100,
    volume24h: parseFloat(item.turnover24h),
    high24h: parseFloat(item.highPrice24h),
    low24h: parseFloat(item.lowPrice24h),
  }));
  await storage.setMarketData(marketData);
  return marketData;
}

// --- Fetch positions ---
export async function getPositions(): Promise<Position[]> {
  const response = await bybitRestClient.getPositionInfo({ category: 'linear' });
  const positions: Position[] = response.result.list.map((pos: any) => ({
    id: pos.positionIdx.toString(),
    symbol: pos.symbol,
    side: pos.side === 'Buy' ? 'BUY' : 'SELL',
    size: parseFloat(pos.size),
    entryPrice: parseFloat(pos.avgPrice),
    currentPrice: parseFloat(pos.markPrice),
    pnl: parseFloat(pos.unrealisedPnl),
    pnlPercent: parseFloat(pos.positionValue) > 0
      ? (parseFloat(pos.unrealisedPnl) / parseFloat(pos.positionValue)) * 100
      : 0,
    status: parseFloat(pos.size) > 0 ? 'OPEN' : 'CLOSED',
    openTime: new Date(Number(pos.createdTime)).toISOString(),
    closeTime: pos.updatedTime && parseFloat(pos.size) === 0
      ? new Date(Number(pos.updatedTime)).toISOString()
      : undefined,
    exitPrice: parseFloat(pos.size) === 0 && pos.avgPrice ? parseFloat(pos.avgPrice) : undefined,
    leverage: pos.leverage ?? 10,
  }));
  await storage.setPositions(positions);
  return positions;
}

// --- Fetch balance ---
export async function getBalance(): Promise<Balance> {
  const response = await bybitRestClient.getWalletBalance({ accountType: 'UNIFIED' });
  const usdt = response.result.list[0].coin.find((c: any) => c.coin === 'USDT');
  const balance: Balance = {
    capital: parseFloat(usdt?.equity || '0'),
    available: parseFloat(usdt?.availableToWithdraw || '0'),
    used: parseFloat(usdt?.locked || '0'),
  };
  await storage.setBalance(balance);
  return balance;
}

// --- Scan trading signals ---
export async function scanSignals(): Promise<Signal[]> {
  const symbols = ['BTCUSDT', 'ETHUSDT'];
  const signals: Signal[] = [];

  for (const symbol of symbols) {
    const kline = await bybitRestClient.getKline({ category: 'linear', symbol, interval: '15', limit: 50 });
    const closes = kline.result.list.map((c: any) => parseFloat(c[4])).reverse();
    if (closes.length < 20) continue;

    const shortMA = closes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const longMA = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;

    let type: 'BUY' | 'SELL' | null = null;
    if (shortMA > longMA) type = 'BUY';
    if (shortMA < longMA) type = 'SELL';

    if (type) {
      signals.push({
        id: randomUUID(),
        symbol,
        type,
        score: Math.abs(shortMA - longMA),
        price: closes[closes.length - 1],
        confidence: Math.abs(shortMA - longMA) / longMA > 0.01 ? 'HIGH' : 'MEDIUM',
        status: 'PENDING',
        timestamp: new Date().toISOString(),
      });
    }
  }

  await storage.setSignals(signals);
  return signals;
}

// --- Execute trade ---
export async function executeTrade(trade: {
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  type: 'market' | 'limit';
  price?: number;
}) {
  const params: any = {
    category: 'linear',
    symbol: trade.symbol,
    side: trade.side === 'BUY' ? 'Buy' : 'Sell',
    orderType: trade.type,
    qty: trade.size.toString(),
  };

  if (trade.type === 'limit' && trade.price) params.price = trade.price.toString();

  const response = await bybitRestClient.submitOrder(params);
  await getPositions(); // refresh positions
  return response.result;
}

// --- Test connection ---
export async function testConnection(): Promise<boolean> {
  try {
    const serverTime = await bybitRestClient.getServerTime();
    console.log('[Bybit REST] Server time:', serverTime);
    await storage.setConnectionStatus('connected');
    return true;
  } catch (error) {
    await storage.setConnectionStatus('disconnected');
    console.error('[Bybit REST] Connection failed:', error);
    return false;
  }
}
