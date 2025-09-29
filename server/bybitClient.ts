import { RestClientV5, WebsocketClient, KlineIntervalV3, WsKey } from 'bybit-api';
import dotenv from 'dotenv';
import { storage, Position, MarketData, Balance, Signal } from './storage';
import { randomUUID } from 'crypto';
import { IndicatorData, calculateIndicators, scoreSignal, EnhancedSignalScore } from './indicators';
import { MLFilter } from './ml';

dotenv.config();

// Initialize MLFilter
const { applyML } = new MLFilter();

// --- Validate environment variables ---
const API_KEY = process.env.BYBIT_API_KEY;
const API_SECRET = process.env.BYBIT_API_SECRET;
const USE_MAINNET = process.env.BYBIT_MAINNET === 'true';

if (!API_KEY || !API_SECRET) {
  console.warn('[Bybit] Warning: BYBIT_API_KEY and BYBIT_API_SECRET not set. Using demo mode.');
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
  key: API_KEY,
  secret: API_SECRET,
  market: 'v5',
  testnet: !USE_MAINNET,
  wsUrl: WS_URL,
});

// --- Safe subscription wrapper with retry ---
async function safeSubscribe(topics: string[], retries = 3, delay = 1000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      bybitWsClient.subscribe(topics);
      console.log('[Bybit WS] Subscribed to topics:', topics);
      return;
    } catch (err: unknown) {
      console.error(
        `[Bybit WS] Subscription failed (attempt ${i + 1}/${retries}):`,
        err instanceof Error ? err.message : err
      );
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw new Error('[Bybit WS] Max subscription retries reached');
}

// --- Initialize WebSocket with retry limit ---
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

// --- Initialize WebSocket with retry limit ---
export function initWebSocket() {
  const wsKey = 0; // numeric key for Linear Perpetual market
  
  bybitWsClient.on('open', async () => {
    console.log('[Bybit WS] Connected');
    reconnectAttempts = 0;
    try {
      await safeSubscribe(['tickers.BTCUSDT', 'tickers.ETHUSDT'], wsKey);
    } catch (err: unknown) {
      console.error(
        '[Bybit WS] Failed to subscribe:',
        err instanceof Error ? err.message : err
      );
    }
  });

  bybitWsClient.on('update', async (data: any) => {
    if (data.topic?.startsWith('tickers.')) {
      const symbol = data.data.symbol;
      const marketData: MarketData = {
        symbol,
        price: parseFloat(data.data.lastPrice || '0'),
        change24h: parseFloat(data.data.price24hPcnt || '0') * 100,
        changePercent24h: parseFloat(data.data.price24hPcnt || '0') * 100,
        volume24h: parseFloat(data.data.volume24h || '0'),
        high24h: parseFloat(data.data.highPrice24h || '0'),
        low24h: parseFloat(data.data.lowPrice24h || '0'),
      };
      await storage.setMarketData([marketData]).catch((err: unknown) => {
        console.error('[Storage] setMarketData failed:', err);
      });
    }
  });

  bybitWsClient.on('response', (msg: unknown) => {
    console.log('[Bybit WS] Response:', msg);
  });

  bybitWsClient.on('reconnect', () => {
    reconnectAttempts++;
    console.log(
      `[Bybit WS] Reconnecting (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
    );

    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[Bybit WS] Max reconnect attempts reached. Stopping.');
      bybitWsClient.close(wsKey); // ✅ enum
    } else {
      bybitWsClient.connect(wsKey); // ✅ enum
    }
  });

  bybitWsClient.on('close', () => {
    console.log('[Bybit WS] Connection closed');
  });

  bybitWsClient.connect(wsKey); // ✅ initial connect uses enum
}

// --- Get positions ---
export async function getPositions(): Promise<Position[]> {
  try {
    const response = await bybitRestClient.getPositionInfo({ category: 'linear' });
    const positions: Position[] = response.result.list.map((pos: any) => ({
      id: pos.positionIdx + '-' + randomUUID(),
      symbol: pos.symbol,
      side: pos.side as 'BUY' | 'SELL',
      size: parseFloat(pos.size),
      entryPrice: parseFloat(pos.avgPrice),
      currentPrice: parseFloat(pos.markPrice),
      exitPrice: pos.positionValue ? parseFloat(pos.positionValue) : undefined,
      pnl: parseFloat(pos.unrealisedPnl || '0'),
      pnlPercent:
        (parseFloat(pos.unrealisedPnl || '0') /
          parseFloat(pos.positionValue || '1')) *
        100,
      status: pos.size === '0' ? 'CLOSED' : 'OPEN',
      openTime: new Date(pos.createdTime).toISOString(),
      closeTime: pos.updatedTime
        ? new Date(pos.updatedTime).toISOString()
        : undefined,
      leverage: parseFloat(pos.leverage || '1'),
    }));
    await storage.setPositions(positions).catch((err: unknown) => {
      console.error('[Storage] setPositions failed:', err);
    });
    return positions;
  } catch (err: any) {
    console.error('[Bybit] getPositions failed:', err.message);
    return [];
  }
}

// --- Get balance ---
export async function getBalance(): Promise<Balance> {
  try {
    const response = await bybitRestClient.getWalletBalance({
      accountType: 'UNIFIED',
    });
    const usdt = response.result.list.find((asset: any) => asset.coin === 'USDT');
    const balance: Balance = {
      capital: parseFloat(usdt?.totalEquity || '0'),
      available: parseFloat(usdt?.totalAvailableBalance || '0'),
      used:
        parseFloat(usdt?.totalMarginBalance || '0') -
        parseFloat(usdt?.totalAvailableBalance || '0'),
    };
    await storage.setBalance(balance).catch((err: unknown) => {
      console.error('[Storage] setBalance failed:', err);
    });
    return balance;
  } catch (err: any) {
    console.error('[Bybit] getBalance failed:', err.message);
    return { capital: 0, available: 0, used: 0 };
  }
}

// --- Scan signals ---
type ValidInterval =
  | '1'
  | '3'
  | '5'
  | '15'
  | '30'
  | '60'
  | '120'
  | '240'
  | '360'
  | '720'
  | 'D'
  | 'W'
  | 'M';

export interface EnhancedSignal extends Signal {
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

async function getTopSymbols(limit: number = 50): Promise<string[]> {
  try {
    const response = await bybitRestClient.getTickers({ category: 'linear' });
    const tickers = response.result.list;
    const usdtPairs = tickers
      .filter((ticker: any) => ticker.symbol.endsWith('USDT'))
      .map((ticker: any) => ({
        symbol: ticker.symbol,
        volume: parseFloat(ticker.volume24h || '0'),
        price: parseFloat(ticker.lastPrice || '0'),
      }))
      .filter((pair: any) => pair.volume > 0 && pair.price > 0)
      .sort((a: any, b: any) => b.volume - a.volume)
      .slice(0, limit)
      .map((pair: any) => pair.symbol);
    return usdtPairs.length > 0
      ? usdtPairs
      : ['BTCUSDT', 'ETHUSDT', 'DOGEUSDT', 'SOLUSDT', 'XRPUSDT'];
  } catch (err: unknown) {
    console.error(
      `[getTopSymbols] Error fetching symbols:`,
      err instanceof Error ? err.message : err
    );
    return ['BTCUSDT', 'ETHUSDT', 'DOGEUSDT', 'SOLUSDT', 'XRPUSDT'];
  }
}

function enhanceSignal(
  signal: EnhancedSignal,
  indicators: IndicatorData,
  scores: EnhancedSignalScore,
  interval: string
): EnhancedSignal {
  const price = signal.price || 0;
  const atr = indicators.atr[indicators.atr.length - 1] || 0;
  const leverage = 10;
  const atrMultiplier = 2;
  const riskReward = 2;
  const type = signal.type || 'BUY';
  const signal_type =
    type === 'BUY' && scores.buyScore > scores.sellScore ? 'buy' : 'sell';
  const stopLoss =
    type === 'BUY'
      ? price - atr * atrMultiplier
      : price + atr * atrMultiplier;
  const takeProfit =
    type === 'BUY'
      ? price + atr * atrMultiplier * riskReward
      : price - atr * atrMultiplier * riskReward;
  const liquidationPrice =
    type === 'BUY' ? price * (1 - 1 / leverage) : price * (1 + 1 / leverage);
  const marginUsdt = (price * 0.1) / leverage;
  const trailingStop = atr * 0.5;

  return {
    ...signal,
    interval,
    signal_type,
    indicators,
    entry: price,
    sl: parseFloat(stopLoss.toFixed(6)),
    tp: parseFloat(takeProfit.toFixed(6)),
    trail: parseFloat(trailingStop.toFixed(6)),
    liquidation: parseFloat(liquidationPrice.toFixed(6)),
    margin_usdt: marginUsdt,
    bb_slope: indicators.bollinger.upper.length ? 'Contracting' : 'Neutral',
    market: 'Normal',
    leverage,
    risk_reward: riskReward,
    atr_multiplier: atrMultiplier,
    created_at: new Date().toISOString(),
    signals: ['MA_CROSSOVER'],
  };
}

export async function scanSignals(params: {
  interval?: ValidInterval;
  limit?: number;
} = {}): Promise<EnhancedSignal[]> {
  const { interval = '60', limit = 50 } = params;
  const symbols = await getTopSymbols(limit);
  const signals: EnhancedSignal[] = [];
  const topN = Math.min(limit, 10);

  for (const symbol of symbols) {
    try {
      const kline = await bybitRestClient.getKline({
        category: 'linear',
        symbol,
        interval,
        limit: 100,
      });

      const closes: number[] = kline.result.list
        .map((c: any) => parseFloat(c[4]))
        .reverse();
      const highs: number[] = kline.result.list
        .map((c: any) => parseFloat(c[2]))
        .reverse();
      const lows: number[] = kline.result.list
        .map((c: any) => parseFloat(c[3]))
        .reverse();
      const volumes: number[] = kline.result.list
        .map((c: any) => parseFloat(c[5]))
        .reverse();

      if (closes.length < 20) {
        console.warn(`[scanSignals] Insufficient kline data for ${symbol}`);
        continue;
      }

      const scores = scoreSignal(closes, highs, lows, volumes);
      const indicators = calculateIndicators(closes, highs, lows, volumes);
      const type = scores.buyScore > scores.sellScore ? 'BUY' : 'SELL';
      const score = type === 'BUY' ? scores.buyScore : scores.sellScore;

      if (score < (type === 'BUY' ? 40 : 50)) {
        continue;
      }

      const baseSignal: EnhancedSignal = {
        id: randomUUID(),
        symbol,
        type,
        score,
        price: closes[closes.length - 1],
        currentMarketPrice: closes[closes.length - 1],
        confidence:
          score > 70 ? 'HIGH' : score > 50 ? 'MEDIUM' : 'LOW',
        status: 'PENDING',
        timestamp: new Date().toISOString(),
        stopLoss: 0,
        takeProfit: 0,
        liquidationPrice: 0,
        interval,
        signal_type: type === 'BUY' ? 'buy' : 'sell',
        indicators: {
          sma20: [],
          sma50: [],
          ema20: [],
          rsi: [],
          macd: { macd: [], signal: [], histogram: [] },
          bollinger: { upper: [], middle: [], lower: [] },
          atr: [],
        },
        entry: 0,
        sl: 0,
        tp: 0,
        trail: 0,
        liquidation: 0,
        margin_usdt: 0,
        bb_slope: 'Neutral',
        market: 'Normal',
        leverage: 10,
        risk_reward: 2,
        atr_multiplier: 2,
        created_at: new Date().toISOString(),
        signals: [],
      };

      let finalSignal = enhanceSignal(baseSignal, indicators, scores, interval);
      try {
        finalSignal = applyML(
          finalSignal,
          closes,
          highs,
          lows,
          volumes
        ) as EnhancedSignal;
      } catch (err: unknown) {
        console.warn(
          `[scanSignals] ML filter failed for ${symbol}:`,
          err instanceof Error ? err.message : err
        );
      }

      signals.push(finalSignal);
    } catch (err: unknown) {
      console.error(
        `[scanSignals] Error for ${symbol}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  const sortedSignals = signals
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
  if (sortedSignals.length < symbols.length) {
    console.warn(
      `[scanSignals] Only ${sortedSignals.length} of ${symbols.length} symbols analyzed successfully`
    );
  }

  await storage.setSignals(sortedSignals).catch((err: unknown) => {
    console.error('[Storage] setSignals failed:', err);
  });
  return sortedSignals;
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

    if (trade.type === 'limit' && trade.price)
      params.price = trade.price.toString();
    if (trade.stopLoss) params.stopLoss = trade.stopLoss.toString();
    if (trade.takeProfit) params.takeProfit = trade.takeProfit.toString();

    const response = await bybitRestClient.submitOrder(params);
    await getPositions().catch((err: unknown) => {
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
    await storage.setConnectionStatus('connected').catch((err: unknown) => {
      console.error('[Storage] setConnectionStatus failed:', err);
    });
    return true;
  } catch (err: any) {
    await storage.setConnectionStatus('disconnected').catch((err: unknown) => {
      console.error('[Storage] setConnectionStatus failed:', err);
    });
    console.error('[Bybit REST] Connection failed:', err.message);
    return false;
  }
}
