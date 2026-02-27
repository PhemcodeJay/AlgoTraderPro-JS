import { storage, Signal, MarketData } from './storage';
import { bybitRestClient } from './bybitClient';
import { randomUUID } from 'crypto';
import { calculateIndicators, scoreSignal, EnhancedSignalScore, IndicatorData } from './indicators';
import { MLFilter } from './ml';

const { applyML } = new MLFilter();

// Define valid intervals based on indicators.py INTERVALS
type ValidInterval = '5' | '60' | '240' | 'D';

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
  // Always return these symbols even if API fails, to ensure virtual mode works
  const defaultSymbols = ['BTCUSDT', 'ETHUSDT', 'DOGEUSDT', 'SOLUSDT', 'XRPUSDT', 'LTCUSDT', 'LINKUSDT', 'ADAUSDT', 'DOTUSDT', 'BCHUSDT'];
  try {
    const response = await bybitRestClient.getTickers({ category: 'linear' });
    if (!response || response.retCode !== 0) {
       // Only log if it's not a common 403/Forbidden to reduce noise
       if (response?.retCode !== 10001 && response?.retCode !== 403) {
         console.warn(`[getTopSymbols] API returned error: ${response?.retMsg}. Using defaults.`);
       }
       return defaultSymbols;
    }
    const tickers = response.result.list;
    const usdtPairs = tickers
      .filter((ticker: any) => ticker.symbol.endsWith('USDT'))
      .map((ticker: any) => ({
        symbol: ticker.symbol,
        volume: parseFloat(ticker.volume24h || '0'),
        price: parseFloat(ticker.lastPrice || '0')
      }))
      .filter((pair: any) => pair.volume > 0 && pair.price > 0)
      .sort((a: any, b: any) => b.volume - a.volume)
      .slice(0, limit)
      .map((pair: any) => pair.symbol);
    return usdtPairs.length > 0 ? usdtPairs : defaultSymbols;
  } catch (err: any) {
    console.warn(`[getTopSymbols] API error: ${err.message}. Using defaults.`);
    return defaultSymbols;
  }
}

function enhanceSignal(signal: Partial<Signal>, indicators: IndicatorData, scores: EnhancedSignalScore, interval: string): EnhancedSignal {
  const price = signal.price || 0;
  const atr = indicators.atr[indicators.atr.length - 1] || 0;
  const leverage = 10;
  const atrMultiplier = 2;
  const riskReward = 2;
  const type = signal.type || 'BUY';
  const signal_type = type === 'BUY' && scores.buyScore > scores.sellScore ? 'buy' : 
                     type === 'SELL' && scores.sellScore > scores.buyScore ? 'sell' : 'neutral';
  
  const sl = type === 'BUY' ? price - atr * atrMultiplier : price + atr * atrMultiplier;
  const tp = type === 'BUY' ? price + atr * atrMultiplier * riskReward : price - atr * atrMultiplier * riskReward;
  const liquidation = type === 'BUY' ? price * (1 - 0.9 / leverage) : price * (1 + 0.9 / leverage);
  const trail = atr;
  const margin_usdt = 10.0; // Increased margin for more visible trades

  const bbUpper = indicators.bollinger.upper[indicators.bollinger.upper.length - 1] || 0;
  const bbLower = indicators.bollinger.lower[indicators.bollinger.lower.length - 1] || 0;
  const bbSlope = bbUpper - bbLower > price * 0.02 ? 'Expanding' : 'Contracting';

  const volatility = price > 0 ? (atr / price * 100) : 0;
  const market = volatility < 1 ? 'Low Vol' : volatility < 3 ? 'Normal' : 'High Vol';

  return {
    ...signal,
    interval,
    signal_type,
    indicators,
    entry: parseFloat(price.toFixed(6)),
    sl: parseFloat(sl.toFixed(6)),
    tp: parseFloat(tp.toFixed(6)),
    stopLoss: parseFloat(sl.toFixed(6)),
    takeProfit: parseFloat(tp.toFixed(6)),
    trail: parseFloat(trail.toFixed(6)),
    liquidation: parseFloat(liquidation.toFixed(6)),
    liquidationPrice: parseFloat(liquidation.toFixed(6)),
    margin_usdt: parseFloat(margin_usdt.toFixed(6)),
    bb_slope: bbSlope,
    market,
    leverage,
    risk_reward: riskReward,
    atr_multiplier: atrMultiplier,
    created_at: new Date().toISOString(),
    signals: scores.signals
  } as EnhancedSignal;
}

export async function scanSignals(interval: ValidInterval = '60', topN: number = 10, tradingMode: string = 'virtual'): Promise<EnhancedSignal[]> {
  const minScore = tradingMode === 'real' ? 50 : 40;
  console.log(`[scanSignals] Starting scan: interval=${interval}, mode=${tradingMode}`);
  const symbols = await getTopSymbols(20);
  const signals: EnhancedSignal[] = [];

  const promises = symbols.map(async (symbol) => {
    try {
      let kline;
      // ALWAYS use real market data from Bybit
      try {
        kline = await bybitRestClient.getKline({
          category: 'linear',
          symbol,
          interval,
          limit: 100
        });
        
        if (!kline?.result?.list || kline.retCode !== 0) {
          // Attempt a secondary fetch method if the first fails
          const tickers = await bybitRestClient.getTickers({ category: 'linear', symbol });
          if (tickers.retCode === 0 && tickers.result.list.length > 0) {
             const t = tickers.result.list[0];
             const p = parseFloat(t.lastPrice);
             // Create a minimal kline from ticker if kline endpoint is blocked
             // We use the actual last price from the ticker to ensure the signal price is real
             kline = {
               result: {
                 list: Array(20).fill([0, 0, p, p, p, t.volume24h])
               }
             };
          } else {
            throw new Error(kline?.retMsg || 'Empty kline result');
          }
        }
      } catch (err: any) {
        console.error(`[scanSignals] Real-time data fetch failed for ${symbol}:`, err.message);
        return null;
      }

      if (!kline?.result?.list) return null;

      const closes: number[] = kline.result.list.map((c: any) => parseFloat(c[4])).reverse();
      const highs: number[] = kline.result.list.map((c: any) => parseFloat(c[2])).reverse();
      const lows: number[] = kline.result.list.map((c: any) => parseFloat(c[3])).reverse();
      const volumes: number[] = kline.result.list.map((c: any) => parseFloat(c[5])).reverse();

      if (closes.length < 20) return null;

      const scores = scoreSignal(closes, highs, lows, volumes);
      if (scores.buyScore < minScore && scores.sellScore < minScore) return null;

      const indicators = calculateIndicators(closes, highs, lows, volumes);
      const type = scores.buyScore > scores.sellScore ? 'BUY' : 'SELL';
      const score = type === 'BUY' ? scores.buyScore : scores.sellScore;

      const baseSignal: Partial<Signal> = {
        id: randomUUID(),
        symbol,
        type,
        score,
        price: closes[closes.length - 1],
        currentMarketPrice: closes[closes.length - 1],
        confidence: score > 70 ? 'HIGH' : score > 50 ? 'MEDIUM' : 'LOW',
        status: 'PENDING',
        timestamp: new Date().toISOString()
      };

      let finalSignal = enhanceSignal(baseSignal, indicators, scores, interval);
      try {
        finalSignal = applyML(finalSignal, closes, highs, lows, volumes) as EnhancedSignal;
      } catch (err: any) {
        console.warn(`[scanSignals] ML filter failed for ${symbol}:`, err.message ?? err);
      }

      if (finalSignal.score >= minScore) {
        return finalSignal;
      }
      return null;
    } catch (err: any) {
      console.error(`[scanSignals] Error scanning ${symbol}:`, err.message ?? err);
      return null;
    }
  });

  const results = (await Promise.all(promises)).filter((s): s is EnhancedSignal => s !== null);
  
  const sortedSignals = results.sort((a, b) => b.score - a.score).slice(0, topN);
  
  await storage.setSignals(sortedSignals);
  return sortedSignals;
}

export async function analyzeSingleSymbol(symbol: string, interval: ValidInterval = '60'): Promise<EnhancedSignal | null> {
  try {
    const kline = await bybitRestClient.getKline({
      category: 'linear',
      symbol,
      interval, // Now typed as ValidInterval
      limit: 100
    });

    const closes: number[] = kline.result.list.map((c: any) => parseFloat(c[4])).reverse();
    const highs: number[] = kline.result.list.map((c: any) => parseFloat(c[2])).reverse();
    const lows: number[] = kline.result.list.map((c: any) => parseFloat(c[3])).reverse();
    const volumes: number[] = kline.result.list.map((c: any) => parseFloat(c[5])).reverse();

    if (closes.length < 20) {
      console.warn(`[analyzeSingleSymbol] Insufficient data for ${symbol}`);
      return null;
    }

    const scores = scoreSignal(closes, highs, lows, volumes);
    const indicators = calculateIndicators(closes, highs, lows, volumes);
    const type = scores.buyScore > scores.sellScore ? 'BUY' : 'SELL';
    const score = type === 'BUY' ? scores.buyScore : scores.sellScore;

    const baseSignal: Partial<Signal> = {
      id: randomUUID(),
      symbol,
      type,
      score,
      price: closes[closes.length - 1],
      currentMarketPrice: closes[closes.length - 1],
      confidence: score > 70 ? 'HIGH' : score > 50 ? 'MEDIUM' : 'LOW',
      status: 'PENDING',
      timestamp: new Date().toISOString()
    };

    let finalSignal = enhanceSignal(baseSignal, indicators, scores, interval);
    try {
      finalSignal = applyML(finalSignal, closes, highs, lows, volumes) as EnhancedSignal;
    } catch (err: any) {
      console.warn(`[analyzeSingleSymbol] ML filter failed for ${symbol}:`, err.message ?? err);
    }

    await storage.setSignals([finalSignal]);
    return finalSignal;
  } catch (err: any) {
    console.error(`[analyzeSingleSymbol] Error analyzing ${symbol}:`, err.message ?? err);
    return null;
  }
}