// indicators.ts
export function SMA(data: number[], period: number): number {
  if (data.length < period) return 0;
  const slice = data.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

export function EMA(data: number[], period: number): number {
  if (data.length < period) return 0;
  const k = 2 / (period + 1);
  let ema = SMA(data.slice(0, period), period);
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

export function RSI(data: number[], period: number): number {
  if (data.length < period + 1) return 0;
  let gains = 0;
  let losses = 0;
  for (let i = data.length - period; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  const rs = losses === 0 ? 100 : gains / losses;
  return 100 - 100 / (1 + rs);
}

export function MACD(data: number[], fast = 12, slow = 26, signalPeriod = 9) {
  const emaFast = EMA(data, fast);
  const emaSlow = EMA(data, slow);
  const macdLine = emaFast - emaSlow;
  const signalLine = EMA([...data.slice(-signalPeriod), macdLine], signalPeriod);
  const histogram = macdLine - signalLine;
  return { macdLine, signalLine, histogram };
}

export function BollingerBands(data: number[], period = 20, multiplier = 2) {
  if (data.length < period) return { upper: 0, middle: 0, lower: 0 };
  const slice = data.slice(-period);
  const middle = SMA(slice, period);
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    upper: middle + multiplier * stdDev,
    middle,
    lower: middle - multiplier * stdDev,
  };
}

export function ATR(high: number[], low: number[], close: number[], period = 14) {
  if (high.length < period + 1 || low.length < period + 1 || close.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < close.length; i++) {
    const tr = Math.max(
      high[i] - low[i],
      Math.abs(high[i] - close[i - 1]),
      Math.abs(low[i] - close[i - 1])
    );
    trs.push(tr);
  }
  return SMA(trs.slice(-period), period);
}

// Enhanced signal scoring
export interface EnhancedSignalScore {
  buyScore: number;
  sellScore: number;
}

/**
 * Calculate score for a signal using multiple indicators
 */
export function scoreSignal(closes: number[], highs: number[], lows: number[]): EnhancedSignalScore {
  if (closes.length < 20) return { buyScore: 0, sellScore: 0 };
  const price = closes[closes.length - 1];

  // --- Moving averages ---
  const shortMA = SMA(closes, 5);
  const longMA = SMA(closes, 20);
  const emaShort = EMA(closes, 12);
  const emaLong = EMA(closes, 26);

  // --- RSI ---
  const rsi = RSI(closes, 14);

  // --- MACD ---
  const macd = MACD(closes);
  const macdTrend = macd.histogram > 0 ? 1 : -1;

  // --- Bollinger Bands ---
  const bb = BollingerBands(closes, 20);

  // --- ATR ---
  const atr = ATR(highs, lows, closes, 14);

  // --- Score calculation ---
  let buyScore = 0;
  let sellScore = 0;

  // MA & EMA trend
  if (shortMA > longMA) buyScore += 20;
  else sellScore += 20;

  if (emaShort > emaLong) buyScore += 15;
  else sellScore += 15;

  // RSI
  if (rsi < 30) buyScore += 15;
  else if (rsi > 70) sellScore += 15;

  // MACD
  if (macdTrend > 0) buyScore += 15;
  else sellScore += 15;

  // Bollinger Bands
  if (price < bb.lower) buyScore += 10;
  else if (price > bb.upper) sellScore += 10;

  // ATR for volatility
  const atrScore = Math.min(atr / price, 0.1) * 100;
  buyScore += atrScore;
  sellScore += atrScore;

  // Clip to 0-100
  buyScore = Math.min(Math.max(buyScore, 0), 100);
  sellScore = Math.min(Math.max(sellScore, 0), 100);

  return { buyScore, sellScore };
}
