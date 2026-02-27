import { storage, MarketData } from './storage';
import { bybitRestClient } from './bybitClient';
import { scoreSignal, EnhancedSignalScore, IndicatorData } from './indicators';
import { EnhancedSignal } from './scanSignals';

export class MLFilter {
  /**
   * Apply ML weighting to a single signal
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

    // ML weighting based on indicators and signals
    let mlScore = 0.9; // Placeholder ML model output
    const indicators = signal.indicators;
    const signals = signal.signals || [];

    // Adjust ML score based on key indicators and signals
    const rsi = indicators.rsi[indicators.rsi.length - 1] || 50;
    const macdHist = indicators.macd.histogram[indicators.macd.histogram.length - 1] || 0;
    const volatility = signal.indicators.atr[signal.indicators.atr.length - 1] / signal.price * 100 || 0;

    if (signals.includes('RSI_OVERSOLD') || signals.includes('BB_OVERSOLD')) {
      mlScore += 0.1;
    } else if (signals.includes('RSI_OVERBOUGHT') || signals.includes('BB_OVERBOUGHT')) {
      mlScore -= 0.1;
    }

    if (signals.includes('MACD_BULLISH') && macdHist > 0.01) {
      mlScore += 0.05;
    } else if (signals.includes('MACD_BEARISH') && macdHist < -0.01) {
      mlScore -= 0.05;
    }

    if (signals.includes('TREND_BULLISH') && signal.type === 'BUY') {
      mlScore += 0.1;
    }

    if (volatility > 5) {
      mlScore -= 0.15; // Penalize high volatility
    } else if (volatility < 1) {
      mlScore += 0.05; // Favor low volatility
    }

    // Ensure ML score is between 0 and 1
    mlScore = Math.min(Math.max(mlScore, 0), 1);

    // Combine base score and ML score (50% each)
    const finalScore = 0.5 * baseScore + 0.5 * mlScore * 100;

    // Assign confidence based on final score
    let confidence: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (finalScore > 70) confidence = 'HIGH';
    else if (finalScore > 40) confidence = 'MEDIUM';

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