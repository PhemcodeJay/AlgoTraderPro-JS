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
        interval: '15',
        limit: 50,
      });

      const closes = kline.result.list.map((c: any) => parseFloat(c[4])).reverse();
      const highs = kline.result.list.map((c: any) => parseFloat(c[2])).reverse();
      const lows = kline.result.list.map((c: any) => parseFloat(c[3])).reverse();

      if (closes.length < 20) continue;

      // --- Use full indicators to get enhanced scores ---
      const enhancedScores: EnhancedSignalScore = scoreSignal(closes, highs, lows);

      // --- Determine preliminary type ---
      let type: 'BUY' | 'SELL' | null = null;
      if (enhancedScores.buyScore > enhancedScores.sellScore) type = 'BUY';
      else if (enhancedScores.sellScore > enhancedScores.buyScore) type = 'SELL';

      if (!type) continue;

      // --- Create base signal object ---
      let baseSignal: Signal = {
        id: randomUUID(),
        symbol,
        type,
        score: type === 'BUY' ? enhancedScores.buyScore : enhancedScores.sellScore,
        price: closes[closes.length - 1],
        confidence: 'MEDIUM',
        status: 'PENDING',
        timestamp: new Date().toISOString(),
      };

      // --- Apply ML weighting (50% ML / 50% indicator score) ---
      const finalSignal = applyML(baseSignal, closes, highs, lows);

      signals.push(finalSignal);

    } catch (err) {
      console.error(`[scanSignals] Error scanning ${symbol}:`, err);
    }
  }

  // Save to storage
  await storage.setSignals(signals);
  return signals;
}
