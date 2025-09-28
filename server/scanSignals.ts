// scanSignals.ts
import { storage, Signal, MarketData } from './storage';
import { bybitRestClient } from './bybitClient';
import { randomUUID } from 'crypto';
import { scoreSignal, EnhancedSignalScore } from './indicators';
import { applyML } from './ml';

export async function scanSignals(): Promise<Signal[]> {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'];
  const signals: Signal[] = [];

  for (const symbol of symbols) {
    try {
      // Fetch last 50 candles
      const kline = await bybitRestClient.getKline({
        category: 'linear',
        symbol,
        interval: '15', // 15-minute candles
        limit: 50,
      });

      // Extract OHLC arrays
      const closes: number[] = kline.result.list.map((c: any) => parseFloat(c[4])).reverse();
      const highs: number[] = kline.result.list.map((c: any) => parseFloat(c[2])).reverse();
      const lows: number[] = kline.result.list.map((c: any) => parseFloat(c[3])).reverse();

      if (closes.length < 20) continue;

      // --- Compute indicator scores ---
      const enhancedScores: EnhancedSignalScore = scoreSignal(closes, highs, lows);

      // --- Determine preliminary type ---
      let type: 'BUY' | 'SELL' | null = null;
      if (enhancedScores.buyScore > enhancedScores.sellScore) type = 'BUY';
      else if (enhancedScores.sellScore > enhancedScores.buyScore) type = 'SELL';

      if (!type) continue;

      // --- Create base signal ---
      const baseSignal: Signal = {
        id: randomUUID(),
        symbol,
        type,
        score: type === 'BUY' ? enhancedScores.buyScore : enhancedScores.sellScore,
        price: closes[closes.length - 1],
        confidence: 'MEDIUM',
        status: 'PENDING',
        timestamp: new Date().toISOString(),
      };

      // --- Apply ML weighting ---
      const finalSignal: Signal = applyML(baseSignal, closes, highs, lows);

      signals.push(finalSignal);
    } catch (err: any) {
      console.error(`[scanSignals] Error scanning ${symbol}:`, err.message ?? err);
    }
  }

  // --- Save signals to storage ---
  await storage.setSignals(signals);
  return signals;
}
