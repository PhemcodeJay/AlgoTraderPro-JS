import { RestClientV5, WebsocketClient } from 'bybit-api';
import dotenv from 'dotenv';
import { storage } from './storage';

dotenv.config();

const API_KEY = process.env.BYBIT_API_KEY || '';
const API_SECRET = process.env.BYBIT_API_SECRET || '';

const IS_MAINNET = process.env.BYBIT_MAINNET === 'true';
const IS_TESTNET = process.env.BYBIT_TESTNET === 'true';

// Decide environment: default to mainnet unless TESTNET=true
const USE_MAINNET = IS_TESTNET ? false : IS_MAINNET;

console.log(`[Bybit] Starting client on: ${USE_MAINNET ? 'MAINNET' : 'TESTNET'}`);

export const bybitRestClient = new RestClientV5({
  mainnet: USE_MAINNET,
  key: API_KEY,
  secret: API_SECRET,
});

export const bybitWsClient = new WebsocketClient({
  mainnet: USE_MAINNET,
  key: API_KEY,
  secret: API_SECRET,
  market: 'linear',
});

// Fetch market data
export async function getMarketData(symbols: string[] = ['BTCUSDT', 'ETHUSDT']) {
  const response = await bybitRestClient.getTickers({
    category: 'linear',
    symbol: symbols.join(','),
  });
  const marketData = response.result.list.map((item: any) => ({
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

// Fetch positions
export async function getPositions() {
  const response = await bybitRestClient.getPositionInfo({ category: 'linear' });
  const positions = response.result.list.map((pos: any) => ({
    id: pos.positionIdx.toString(),
    symbol: pos.symbol,
    side: pos.side === 'Buy' ? 'BUY' : 'SELL',
    size: parseFloat(pos.size),
    entryPrice: parseFloat(pos.avgPrice),
    currentPrice: parseFloat(pos.markPrice),
    pnl: parseFloat(pos.unrealisedPnl),
    pnlPercent:
      parseFloat(pos.positionValue) > 0
        ? (parseFloat(pos.unrealisedPnl) / parseFloat(pos.positionValue)) * 100
        : 0,
    status: parseFloat(pos.size) > 0 ? 'OPEN' : 'CLOSED',
    openTime: new Date(parseInt(pos.createdTime)).toISOString(),
    closeTime:
      pos.updatedTime && parseFloat(pos.size) === 0
        ? new Date(parseInt(pos.updatedTime)).toISOString()
        : undefined,
    exitPrice:
      parseFloat(pos.size) === 0 && pos.avgPrice
        ? parseFloat(pos.avgPrice)
        : undefined,
  }));
  await storage.setPositions(positions);
  return positions;
}

// Fetch balance
export async function getBalance() {
  const response = await bybitRestClient.getWalletBalance({ accountType: 'UNIFIED' });
  const usdt = response.result.list[0].coin.find((c: any) => c.coin === 'USDT');
  const balance = {
    capital: parseFloat(usdt?.equity || '0'),
    available: parseFloat(usdt?.availableToWithdraw || '0'),
    used: parseFloat(usdt?.locked || '0'),
  };
  await storage.setBalance(balance);
  return balance;
}

// Generate signals (placeholder; implement your strategy)
export async function scanSignals() {
  const marketData = await getMarketData();
  const signals = marketData.map((data) => ({
    id: require('crypto').randomUUID(),
    symbol: data.symbol,
    type: Math.random() > 0.5 ? 'BUY' as const : 'SELL' as const,
    score: Math.random(),
    price: data.price,
    confidence: data.changePercent24h > 1 ? 'HIGH' as const : 'MEDIUM' as const,
    status: 'PENDING' as const,
    timestamp: new Date().toISOString(),
  }));
  await storage.setSignals(signals);
  return signals;
}

// Execute trade
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
  if (trade.type === 'limit' && trade.price) {
    params.price = trade.price.toString();
  }
  const response = await bybitRestClient.submitOrder(params);
  await getPositions(); // Update positions after trade
  return response.result;
}

// Test connection
export async function testConnection() {
  try {
    const serverTime = await bybitRestClient.getServerTime();
    console.log('Server time response:', serverTime);
    await storage.setConnectionStatus('connected');
    return true;
  } catch (error) {
    await storage.setConnectionStatus('disconnected');
    throw error;
  }
}
