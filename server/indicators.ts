export interface IndicatorData {
  sma20: number[];
  sma50: number[];
  ema20: number[];
  rsi: number[];
  macd: { macd: number[]; signal: number[]; histogram: number[] };
  bollinger: { upper: number[]; middle: number[]; lower: number[] };
  atr: number[];
}

export interface EnhancedSignalScore {
  buyScore: number;
  sellScore: number;
  signals: string[];
}

export function SMA(data: number[], period: number): number[] {
  if (data.length < period) return new Array(data.length).fill(0);
  const sma: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(0);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const sum = slice.reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }
  return sma;
}

export function EMA(data: number[], period: number): number[] {
  if (data.length < period) return new Array(data.length).fill(0);
  const k = 2 / (period + 1);
  const ema: number[] = [data[0]]; // Start with first price
  for (let i = 1; i < data.length; i++) {
    const emaVal = data[i] * k + ema[ema.length - 1] * (1 - k);
    ema.push(emaVal);
  }
  return ema;
}

export function RSI(data: number[], period: number = 14): number[] {
  if (data.length < period + 1) return new Array(data.length).fill(50);
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  const rsi: number[] = [50];
  for (let i = period; i < gains.length; i++) {
    const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsiVal = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
    rsi.push(rsiVal);
  }
  while (rsi.length < data.length) {
    rsi.unshift(50);
  }
  return rsi;
}

export function MACD(data: number[], fast: number = 12, slow: number = 26, signalPeriod: number = 9) {
  if (data.length < slow) {
    return { macd: new Array(data.length).fill(0), signal: new Array(data.length).fill(0), histogram: new Array(data.length).fill(0) };
  }
  const emaFast = EMA(data, fast);
  const emaSlow = EMA(data, slow);
  const macdLine = emaFast.map((fast, i) => fast - emaSlow[i]);
  const signalLine = EMA(macdLine, signalPeriod);
  const histogram = macdLine.map((macd, i) => macd - signalLine[i]);
  return { macd: macdLine, signal: signalLine, histogram };
}

export function BollingerBands(data: number[], period: number = 20, multiplier: number = 2) {
  if (data.length < period) {
    return { upper: new Array(data.length).fill(0), middle: new Array(data.length).fill(0), lower: new Array(data.length).fill(0) };
  }
  const middle = SMA(data, period);
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(0);
      lower.push(0);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = middle[i];
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const stdDev = Math.sqrt(variance);
      upper.push(mean + multiplier * stdDev);
      lower.push(mean - multiplier * stdDev);
    }
  }
  return { upper, middle, lower };
}

export function ATR(high: number[], low: number[], close: number[], period: number = 14): number[] {
  if (high.length < period + 1 || high.length !== low.length || high.length !== close.length) {
    return new Array(high.length).fill(0);
  }
  const trs: number[] = [];
  for (let i = 1; i < high.length; i++) {
    const tr = Math.max(
      high[i] - low[i],
      Math.abs(high[i] - close[i - 1]),
      Math.abs(low[i] - close[i - 1])
    );
    trs.push(tr);
  }
  const atr: number[] = [0];
  for (let i = period; i < trs.length + 1; i++) {
    const atrVal = trs.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
    atr.push(atrVal);
  }
  while (atr.length < high.length) {
    atr.push(atr[atr.length - 1] || 0);
  }
  return atr;
}

export function calculateIndicators(closes: number[], highs: number[], lows: number[], volumes: number[]): IndicatorData {
  if (closes.length < 20) return {
    sma20: [], sma50: [], ema20: [], rsi: [], macd: { macd: [], signal: [], histogram: [] }, bollinger: { upper: [], middle: [], lower: [] }, atr: []
  };
  const sma20 = SMA(closes, 20);
  const sma50 = SMA(closes, 50);
  const ema20 = EMA(closes, 20);
  const rsi = RSI(closes, 14);
  const macd = MACD(closes);
  const bollinger = BollingerBands(closes);
  const atr = ATR(highs, lows, closes, 14);
  return { sma20, sma50, ema20, rsi, macd, bollinger, atr };
}

export function scoreSignal(closes: number[], highs: number[], lows: number[], volumes: number[]): EnhancedSignalScore {
  if (closes.length < 20) return { buyScore: 0, sellScore: 0, signals: [] };
  const indicators = calculateIndicators(closes, highs, lows, volumes);
  const price = closes[closes.length - 1];
  let buyScore = 0;
  let sellScore = 0;
  const signals: string[] = [];

  // RSI signals
  const rsi = indicators.rsi[indicators.rsi.length - 1] || 50;
  if (rsi < 30) {
    buyScore += 25;
    signals.push("RSI_OVERSOLD");
  } else if (rsi > 70) {
    sellScore += 25;
    signals.push("RSI_OVERBOUGHT");
  } else if (20 <= rsi && rsi <= 30) {
    buyScore += 10;
    signals.push("RSI_NEAR_OVERSOLD");
  } else if (70 <= rsi && rsi <= 80) {
    sellScore += 10;
    signals.push("RSI_NEAR_OVERBOUGHT");
  } else if (rsi < 20) {
    buyScore += 5;
    signals.push("RSI_EXTREME_OVERSOLD");
  } else if (rsi > 80) {
    sellScore += 5;
    signals.push("RSI_EXTREME_OVERBOUGHT");
  }

  // MACD signals
  const macd = indicators.macd.macd[indicators.macd.macd.length - 1] || 0;
  const macdSignal = indicators.macd.signal[indicators.macd.signal.length - 1] || 0;
  const macdHist = indicators.macd.histogram[indicators.macd.histogram.length - 1] || 0;
  if (macd > macdSignal && macdHist > 0) {
    buyScore += 20;
    signals.push("MACD_BULLISH");
  } else if (macd < macdSignal && macdHist < 0) {
    sellScore += 20;
    signals.push("MACD_BEARISH");
  }
  if (Math.abs(macdHist) > 0.01) {
    buyScore += 8;
    sellScore += 8;
    signals.push("MACD_STRONG");
  }

  // Bollinger Bands signals
  const bbUpper = indicators.bollinger.upper[indicators.bollinger.upper.length - 1] || 0;
  const bbLower = indicators.bollinger.lower[indicators.bollinger.lower.length - 1] || 0;
  if (price <= bbLower) {
    buyScore += 15;
    signals.push("BB_OVERSOLD");
  } else if (price >= bbUpper) {
    sellScore += 15;
    signals.push("BB_OVERBOUGHT");
  }

  // Volume analysis
  const avgVolume = volumes.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, volumes.length) || 1;
  const volumeRatio = volumes[volumes.length - 1] / avgVolume;
  if (volumeRatio > 2) {
    buyScore += 12;
    sellScore += 12;
    signals.push("VOLUME_VERY_HIGH");
  } else if (volumeRatio > 1.5) {
    buyScore += 6;
    sellScore += 6;
    signals.push("VOLUME_HIGH");
  }

  // Trend signals
  let trendScore = 0;
  if (indicators.sma20.length > 1 && indicators.sma50.length > 1) {
    if (indicators.sma20[indicators.sma20.length - 1] > indicators.sma50[indicators.sma50.length - 1]) {
      trendScore += 1;
      signals.push("SMA20_ABOVE_SMA50");
    }
    if (price > indicators.sma20[indicators.sma20.length - 1]) {
      trendScore += 1;
      signals.push("PRICE_ABOVE_SMA20");
    }
    if (indicators.sma20[indicators.sma20.length - 1] > indicators.sma20[indicators.sma20.length - 2]) {
      trendScore += 1;
      signals.push("SMA20_UPTREND");
    }
  }
  buyScore += trendScore * 3;
  sellScore += trendScore * 3;
  if (trendScore >= 2) {
    buyScore += 15;
    signals.push("TREND_BULLISH");
  }

  // Volatility
  const atr = indicators.atr[indicators.atr.length - 1] || 0;
  const volatility = price > 0 ? (atr / price * 100) : 0;
  if (0.5 <= volatility && volatility <= 3) {
    buyScore += 5;
    sellScore += 5;
    signals.push("VOLATILITY_NORMAL");
  } else if (volatility > 5) {
    buyScore -= 10;
    sellScore -= 10;
    signals.push("VOLATILITY_HIGH");
  }

  return {
    buyScore: Math.min(Math.max(buyScore, 0), 100),
    sellScore: Math.min(Math.max(sellScore, 0), 100),
    signals
  };
}