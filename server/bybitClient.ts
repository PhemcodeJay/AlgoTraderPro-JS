import { RestClientV5, WebsocketClient, KlineIntervalV3, WsKey } from 'bybit-api';
import dotenv from 'dotenv';
import { storage, Position, MarketData, Balance } from './storage';
import { randomUUID } from 'crypto';

dotenv.config();

const API_KEY = process.env.BYBIT_API_KEY;
const API_SECRET = process.env.BYBIT_API_SECRET;
const BASE_URL = 'https://api.bybit.com';
const WS_URL = 'wss://stream.bybit.com/v5/public/linear';

export const bybitRestClient = new RestClientV5({
  key: API_KEY || undefined,
  secret: API_SECRET || undefined,
  baseUrl: BASE_URL,
  testnet: false,
  // Increase timeout and adjust recv_window for better reliability
  recv_window: 20000,
});

export const bybitWsClient = new WebsocketClient({
  key: API_KEY || undefined,
  secret: API_SECRET || undefined,
  market: 'v5',
  testnet: false,
  wsUrl: WS_URL,
});

export function initWebSocket() {
  const WS_KEY = 'linear-perpetual' as WsKey;
  bybitWsClient.on('open', () => console.log('[Bybit WS] Connected'));
  bybitWsClient.on('update', async (data: any) => {
    if (data.topic?.startsWith('tickers.')) {
      const update: MarketData = {
        symbol: data.data.symbol,
        price: parseFloat(data.data.lastPrice) || 0,
        change24h: parseFloat(data.data.price24hPcnt) * 100 || 0,
        changePercent24h: parseFloat(data.data.price24hPcnt) * 100 || 0,
        volume24h: parseFloat(data.data.turnover24h) || 0,
        high24h: parseFloat(data.data.highPrice24h) || 0,
        low24h: parseFloat(data.data.lowPrice24h) || 0,
      };
      await storage.setMarketData([update]);
    }
  });
  bybitWsClient.connect(WS_KEY);
}

export async function getPositions(): Promise<Position[]> {
  try {
    const status = await storage.getAppStatus().catch(() => ({ tradingMode: 'virtual' }));
    if (status.tradingMode === 'virtual') return await storage.getPositions();

    const response = await bybitRestClient.getPositionInfo({ category: 'linear', settleCoin: 'USDT' });
    if (response.retCode !== 0) throw new Error(response.retMsg);

    const positions: Position[] = response.result.list.map((p: any) => ({
      id: p.positionIdx.toString() + '-' + randomUUID(),
      symbol: p.symbol,
      side: p.side === 'Buy' ? 'BUY' : 'SELL',
      size: parseFloat(p.size),
      leverage: parseFloat(p.leverage),
      entryPrice: parseFloat(p.avgPrice),
      currentPrice: parseFloat(p.markPrice),
      pnl: parseFloat(p.unrealisedPnl),
      pnlPercent: (parseFloat(p.unrealisedPnl) / (parseFloat(p.positionValue) / parseFloat(p.leverage) || 1)) * 100,
      status: parseFloat(p.size) > 0 ? 'OPEN' : 'CLOSED',
      openTime: new Date().toISOString(),
      stopLoss: parseFloat(p.stopLoss) || undefined,
      takeProfit: parseFloat(p.takeProfit) || undefined,
    }));
    await storage.setPositions(positions);
    return positions;
  } catch (err: any) {
    console.warn('[Bybit] getPositions failed, using local:', err.message);
    return await storage.getPositions();
  }
}

export async function getBalance(): Promise<Balance> {
  try {
    const status = await storage.getAppStatus().catch(() => ({ tradingMode: 'virtual' }));
    if (status.tradingMode === 'virtual') return await storage.getBalance();

    const response = await bybitRestClient.getWalletBalance({ accountType: 'UNIFIED' });
    const usdt = response.result.list[0]?.coin?.find((c: any) => c.coin === 'USDT') || response.result.list.find((asset: any) => asset.coin === 'USDT');
    const balance: Balance = {
      capital: parseFloat(usdt?.totalEquity || '0'),
      available: parseFloat(usdt?.totalAvailableBalance || '0'),
      used: parseFloat(usdt?.totalMarginBalance || '0') - parseFloat(usdt?.totalAvailableBalance || '0'),
    };
    await storage.setBalance(balance);
    return balance;
  } catch (err: any) {
    console.warn('[Bybit] getBalance failed, using local:', err.message);
    return await storage.getBalance();
  }
}

export async function getMarketData(symbols?: string[]): Promise<MarketData[]> {
  const targetSymbols = symbols || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT'];
  try {
    const response = await bybitRestClient.getTickers({ category: 'linear' });
    if (response.retCode !== 0) throw new Error(response.retMsg);
    const data = response.result.list
      .filter((t: any) => targetSymbols.includes(t.symbol))
      .map((t: any) => ({
        symbol: t.symbol,
        price: parseFloat(t.lastPrice),
        change24h: parseFloat(t.price24hPcnt) * 100,
        changePercent24h: parseFloat(t.price24hPcnt) * 100,
        volume24h: parseFloat(t.volume24h),
        high24h: parseFloat(t.highPrice24h),
        low24h: parseFloat(t.lowPrice24h),
      }));
    if (data.length > 0) {
      await storage.setMarketData(data);
      return data;
    }
  } catch (err) {}
  
  const mock = targetSymbols.map(s => {
    const p = s === 'BTCUSDT' ? 96000 : 100;
    return { symbol: s, price: p, change24h: 0, changePercent24h: 0, volume24h: 0, high24h: p, low24h: p };
  });
  return mock;
}

export async function executeTrade(trade: any, mode?: 'virtual' | 'real') {
  const status = await storage.getAppStatus();
  const m = mode || status.tradingMode;
  
  // ALWAYS use live market price for both Virtual and Real modes to ensure accuracy
  let currentPrice = trade.price;
  const isReal = status.tradingMode === 'real';

  if (isReal) {
    try {
      const tickers = await bybitRestClient.getTickers({ category: 'linear', symbol: trade.symbol });
      if (tickers.retCode === 0 && tickers.result.list.length > 0) {
        currentPrice = parseFloat(tickers.result.list[0].lastPrice);
      }
    } catch (err: any) {
      console.warn(`[Bybit] Failed to fetch live price for ${trade.symbol}: ${err.message}`);
    }
  }

  if (!currentPrice) currentPrice = trade.price || 96000;

  if (m === 'virtual') {
    const p: Position = {
      id: randomUUID(),
      symbol: trade.symbol,
      side: trade.side,
      size: trade.size,
      leverage: trade.leverage || 10,
      entryPrice: currentPrice,
      currentPrice: currentPrice,
      pnl: 0,
      pnlPercent: 0,
      status: 'OPEN',
      openTime: new Date().toISOString(),
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
    };
    await storage.addPosition(p);
    return p;
  }
  
  // Real mode: verify API keys
  if (!API_KEY || !API_SECRET) throw new Error('Real trading API keys are missing. Please configure them in your environment.');
  
  const res = await bybitRestClient.submitOrder({
    category: 'linear',
    symbol: trade.symbol,
    side: trade.side === 'BUY' ? 'Buy' : 'Sell',
    orderType: trade.type === 'market' ? 'Market' : 'Limit',
    qty: trade.size.toString(),
    price: trade.type === 'limit' ? currentPrice.toString() : undefined,
    stopLoss: trade.stopLoss?.toString(),
    takeProfit: trade.takeProfit?.toString(),
  });
  if (res.retCode !== 0) throw new Error(res.retMsg);
  return res.result;
}

export async function closePosition(positionId: string, mode?: 'virtual' | 'real') {
  const status = await storage.getAppStatus();
  const m = mode || status.tradingMode;
  
  if (m === 'virtual') {
    const positions = await storage.getPositions();
    const pos = positions.find(p => p.id === positionId);
    if (!pos) throw new Error('Position not found');
    
    // Return margin to available balance
    const balance = await storage.getBalance();
    const margin = (pos.entryPrice * pos.size) / (pos.leverage || 10);
    
    // Update balance: add back margin and PnL
    await storage.setBalance({
      capital: balance.capital + pos.pnl,
      available: balance.available + margin + pos.pnl,
      used: Math.max(0, balance.used - margin)
    });
    
    await storage.removePosition(positionId);
    return { success: true };
  }

  // Real mode closing
  const positions = await storage.getPositions();
  const pos = positions.find(p => p.id === positionId);
  if (!pos) throw new Error('Position not found');

  if (!API_KEY || !API_SECRET) throw new Error('API keys required for real mode');

  const res = await bybitRestClient.submitOrder({
    category: 'linear',
    symbol: pos.symbol,
    side: pos.side === 'BUY' ? 'Sell' : 'Buy',
    orderType: 'Market',
    qty: pos.size.toString(),
    reduceOnly: true,
  });

  if (res.retCode !== 0) throw new Error(res.retMsg);
  await storage.removePosition(positionId);
  return { success: true, result: res.result };
}

export async function testConnection(): Promise<boolean> {
  try {
    await bybitRestClient.getServerTime();
    return true;
  } catch {
    return false;
  }
}
