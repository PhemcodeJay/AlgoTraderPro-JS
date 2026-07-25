import { storage, type MarketData } from './storage';
import { bybitRestClient } from './bybitClient';
import { scoreSignal, type EnhancedSignalScore, type IndicatorData } from './indicators';
import { type EnhancedSignal } from './scanSignals';

export class MLFilter {
  /**
   * Apply ML weighting to a single signal.
   *
   * FIX: The original implementation scored every signal between 65-90 regardless of quality,
   * because mlScore started at 0.5 and could only go up, plus baseScore was always ≥ 40.
   * This caused the final score to always pass thresholds, creating false positives.
   *
   * Now the ML score penalizes weak signals and only boosts truly strong ones.
   */
  applyML(
    signal: EnhancedSignal,
    closes: number[],
    highs: number[],
    lows: number[],
    volumes: number[]
  ): EnhancedSignal {
    const scores: EnhancedSignalScore = scoreSignal(closes, highs, lows, volumes);

    // Base score depends on signal type
    const baseScore = signal.type === 'BUY' ? scores.buyScore : scores.sellScore;

    // --- Genuine ML weighting based on indicator confluence ---
    let mlScore = 0.5; // Start neutral
    const indicators = signal.indicators;
    const signals = signal.signals || [];

    // RSI confirmation
    const rsi = indicators.rsi[indicators.rsi.length - 1] || 50;
    if (signal.type === 'BUY' && rsi < 30) {
      mlScore += 0.15;
    } else if (signal.type === 'SELL' && rsi > 70) {
      mlScore += 0.15;
    }

    // MACD histogram confirmation
    const macdHist = indicators.macd.histogram[indicators.macd.histogram.length - 1] || 0;
    if (signal.type === 'BUY' && macdHist > 0.01) {
      mlScore += 0.1;
    } else if (signal.type === 'SELL' && macdHist < -0.01) {
      mlScore += 0.1;
    }

    // Trend confirmation — use actual signal names from scoreSignal
    const isBullTrend = signals.includes('SMA20_ABOVE_SMA50') && signals.includes('PRICE_ABOVE_SMA20');
    const isBearTrend = signals.includes('SMA20_BELOW_SMA50') && signals.includes('PRICE_BELOW_SMA20');
    if (signal.type === 'BUY' && isBullTrend) {
      mlScore += 0.15;
    } else if (signal.type === 'SELL' && isBearTrend) {
      mlScore += 0.15;
    }

    // Bollinger Band confirmation
    const bbUpper = indicators.bollinger.upper[indicators.bollinger.upper.length - 1] || 0;
    const bbLower = indicators.bollinger.lower[indicators.bollinger.lower.length - 1] || 0;
    const price = signal.price;
    if (signal.type === 'BUY' && price <= bbLower && bbLower > 0) {
      mlScore += 0.1;
    } else if (signal.type === 'SELL' && price >= bbUpper && bbUpper > 0) {
      mlScore += 0.1;
    }

    // Volatility adjustment
    const volatility = price > 0 ? (indicators.atr[indicators.atr.length - 1] / price * 100) : 0;
    if (volatility > 5) {
      mlScore -= 0.15; // Penalize high volatility
    } else if (volatility < 1) {
      mlScore += 0.05; // Favor low volatility
    }

    // Volume confirmation
    const hasHighVolume = signals.includes('VOLUME_VERY_HIGH_BULL') || signals.includes('VOLUME_VERY_HIGH_BEAR') ||
                          signals.includes('VOLUME_HIGH_BULL') || signals.includes('VOLUME_HIGH_BEAR');
    if (hasHighVolume) {
      mlScore += 0.05;
    }

    // Ensure ML score is between 0 and 1
    mlScore = Math.min(Math.max(mlScore, 0), 1);

    // FIX: Use a more discriminant weighting that spreads scores properly
    // Previously: 0.6 * baseScore + 0.4 * mlScore * 100
    // This compressed all scores to 65-90 range because mlScore * 100 = 50-100
    // and baseScore was always 40-90 for valid signals
    //
    // Now: Use multiplicative rather than additive to create wider spread
    // Score = baseScore * (0.5 + mlScore * 0.5)
    // A neutral mlScore of 0.5 means baseScore * 0.75 (25% reduction)
    // A strong mlScore of 0.9 means baseScore * 0.95 (5% reduction)
    // A weak mlScore of 0.2 means baseScore * 0.60 (40% reduction)
    const finalScore = baseScore * (0.5 + mlScore * 0.5);

    // Assign confidence based on final score
    let confidence: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (finalScore > 70) confidence = 'HIGH';
    else if (finalScore > 45) confidence = 'MEDIUM';

    return {
      ...signal,
      score: finalScore,
      confidence,
      executedPrice: signal.executedPrice ?? undefined
    };
  }

  /**
   * Filter multiple signals using ML
   */
  async filterSignals(signals: EnhancedSignal[]): Promise<EnhancedSignal[]> {
    const filtered: EnhancedSignal[] = [];
    const marketData: MarketData[] = await storage.getMarketData();

    for (const signal of signals) {
      if (signal.status !== 'PENDING') continue;

      try {
        const kline = await bybitRestClient.getKline({
          category: 'linear',
          symbol: signal.symbol,
          interval: signal.interval as '1' | '3' | '5' | '15' | '30' | '60' | '120' | '240' | '360' | '720' | 'D' | 'W' | 'M',
          limit: 100
        });

        const closes: number[] = kline.result.list.map((c: any) => parseFloat(c[4])).reverse();
        const highs: number[] = kline.result.list.map((c: any) => parseFloat(c[2])).reverse();
        const lows: number[] = kline.result.list.map((c: any) => parseFloat(c[3])).reverse();
        const volumes: number[] = kline.result.list.map((c: any) => parseFloat(c[5])).reverse();

        if (closes.length < 20) {
          console.warn(`[MLFilter] Insufficient data for ${signal.symbol}`);
          continue;
        }

        const updatedSignal = this.applyML(signal, closes, highs, lows, volumes);
        if (updatedSignal.score >= 40) { // Minimum score threshold
          filtered.push(updatedSignal);
        }
      } catch (err: any) {
        console.error(`[MLFilter] Error processing ${signal.symbol}:`, err.message ?? err);
      }
    }

    await storage.setSignals(filtered);
    return filtered;
  }
}

/**
 * Process all pending signals using ML
 */
export async function processSignals(): Promise<EnhancedSignal[]> {
  const signals: EnhancedSignal[] = await storage.getSignals() as EnhancedSignal[];
  const mlFilter = new MLFilter();
  return mlFilter.filterSignals(signals);
}