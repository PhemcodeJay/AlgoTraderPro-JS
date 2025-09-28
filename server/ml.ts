import { storage, Signal, MarketData } from './storage';
import { scoreSignal, EnhancedSignalScore } from './indicators';

/**
 * Apply ML weighting to a single signal
 */
export function applyML(
  signal: Signal,
  closes: number[],
  highs: number[],
  lows: number[]
): Signal {
  const scores: EnhancedSignalScore = scoreSignal(closes, highs, lows);

  // Base score depends on signal type
  const baseScore = signal.type === 'BUY' ? scores.buyScore : scores.sellScore;

  // Placeholder ML model output (50% weight)
  const mlOutput = 0.9;

  const finalScore = 0.5 * baseScore + 0.5 * mlOutput * 100;

  // Assign confidence based on final score
  let confidence: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (finalScore > 70) confidence = 'HIGH';
  else if (finalScore > 40) confidence = 'MEDIUM';

  return {
    ...signal,
    score: finalScore,
    confidence,
    executedPrice: signal.executedPrice ?? undefined, // Fix TypeScript error
  };
}

/**
 * Process all pending signals using ML
 */
export async function processSignals(): Promise<Signal[]> {
  const signals: Signal[] = await storage.getSignals();
  const marketData: MarketData[] = await storage.getMarketData();

  const processed: Signal[] = [];

  for (const signal of signals) {
    if (signal.status !== 'PENDING') continue;

    const symbolData = marketData.find((m) => m.symbol === signal.symbol);
    if (!symbolData) continue;

    // Generate placeholder arrays for closes, highs, lows (50 candles)
    const closes: number[] = Array(50).fill(symbolData.price);
    const highs: number[] = Array(50).fill(symbolData.price * 1.01);
    const lows: number[] = Array(50).fill(symbolData.price * 0.99);

    const updatedSignal = applyML(signal, closes, highs, lows);
    processed.push(updatedSignal);
  }

  // Save updated signals back to storage
  await storage.setSignals(processed);
  return processed;
}
