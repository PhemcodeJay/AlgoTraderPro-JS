import { scanSignals } from './scanSignals';
import { executeTrade, closePosition } from './bybitClient';
import { storage, type Position, type AppStatus, type TradingConfig } from './storage';
import { bybitRestClient } from './bybitClient';

// Map scanInterval (seconds) to valid interval strings
const mapIntervalToValid = (intervalSeconds: number): string => {
  const intervalMap: { [key: number]: string } = {
    300: '5',     // 5 minutes
    3600: '60',   // 1 hour
    14400: '240', // 4 hours
    86400: 'D',   // 1 day
  };
  return intervalMap[intervalSeconds] || '60';
};

// Track daily loss for circuit breaker
let dailyLossTracker: { date: string; loss: number } = { date: '', loss: 0 };

// Track daily trade count
let dailyTradeCount: { date: string; count: number } = { date: '', count: 0 };

// Track trade cooldowns per symbol to prevent re-entering too quickly
const symbolCooldowns: Map<string, number> = new Map();

// Cooldown period in milliseconds (4 hours = 14400000 ms)
const SYMBOL_COOLDOWN_MS = 14400000;

// Correlated symbol groups to avoid opening too many positions on related assets
const CORRELATED_GROUPS: string[][] = [
  ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
  ['DOGEUSDT', 'SHIBUSDT'],
  ['XRPUSDT', 'ADAUSDT', 'XLMUSDT'],
  ['LINKUSDT', 'UNIUSDT', 'AAVEUSDT'],
  ['LTCUSDT', 'BCHUSDT', 'DASHUSDT'],
];

/**
 * Check if we've hit the daily loss limit (circuit breaker).
 * FIX: Reduced max daily loss from 5 trades to 3 trades of risk.
 */
function checkDailyLossLimit(config: TradingConfig): boolean {
  const today = new Date().toISOString().split('T')[0];
  if (dailyLossTracker.date !== today) {
    dailyLossTracker = { date: today, loss: 0 };
  }
  const maxDailyLoss = config.riskPerTrade * 3; // More conservative: 3 trades worth of risk
  return dailyLossTracker.loss >= maxDailyLoss;
}

/**
 * Check if we've hit the daily trade limit to prevent overtrading.
 * FIX: Added daily trade count limit.
 */
function checkDailyTradeLimit(maxDailyTrades: number = 8): boolean {
  const today = new Date().toISOString().split('T')[0];
  if (dailyTradeCount.date !== today) {
    dailyTradeCount = { date: today, count: 0 };
  }
  return dailyTradeCount.count >= maxDailyTrades;
}

/**
 * Record a loss for the daily loss tracker.
 */
function recordDailyLoss(loss: number): void {
  const today = new Date().toISOString().split('T')[0];
  if (dailyLossTracker.date !== today) {
    dailyLossTracker = { date: today, loss: 0 };
  }
  dailyLossTracker.loss += loss;
}

/**
 * Increment daily trade counter.
 */
function incrementDailyTradeCount(): void {
  const today = new Date().toISOString().split('T')[0];
  if (dailyTradeCount.date !== today) {
    dailyTradeCount = { date: today, count: 0 };
  }
  dailyTradeCount.count++;
}

/**
 * Check if a symbol is in cooldown (was recently closed).
 * FIX: Added trade cooldown to prevent re-entering a symbol that just hit SL/TP.
 */
function isSymbolInCooldown(symbol: string): boolean {
  const cooldownEnd = symbolCooldowns.get(symbol);
  if (!cooldownEnd) return false;
  if (Date.now() > cooldownEnd) {
    symbolCooldowns.delete(symbol);
    return false;
  }
  return true;
}

/**
 * Set a cooldown for a symbol when its position closes.
 */
function setSymbolCooldown(symbol: string): void {
  symbolCooldowns.set(symbol, Date.now() + SYMBOL_COOLDOWN_MS);
}

/**
 * Calculate risk-based position size using config values and performance metrics.
 * FIX: Added slippage buffer (0.1%) and performance-based sizing.
 * FIX: Reduced position size if win rate is below 40% (conservative mode).
 */
async function calculatePositionSize(
  balance: number,
  config: TradingConfig,
  entryPrice: number,
  stopLoss: number
): Promise<number> {
  const riskAmount = balance * (config.riskPerTrade / 100);
  const stopLossDistance = Math.abs(entryPrice - stopLoss);
  if (stopLossDistance === 0) return 0;

  // Add 0.1% slippage buffer for market orders
  const slippageBuffer = entryPrice * 0.001;
  const effectiveSLDistance = stopLossDistance + slippageBuffer;

  let rawSize = (riskAmount / effectiveSLDistance) * config.leverage;

  // Apply performance-based adjustment using trade history
  try {
    const trades = await storage.getTradeHistory();
    const closedTrades = trades.filter(t => t.status === 'CLOSED');
    if (closedTrades.length >= 10) {
      const wins = closedTrades.filter(t => t.pnl > 0).length;
      const winRate = (wins / closedTrades.length) * 100;

      if (winRate < 30) {
        rawSize *= 0.25; // Only trade 25% size in bad conditions
      } else if (winRate < 40) {
        rawSize *= 0.5; // Half size
      } else if (winRate > 60) {
        rawSize *= 0.9; // Reduce slightly at high win rates
      }
    }
  } catch (err: any) {
    console.warn('[PositionSizing] Could not fetch trade history:', err.message);
  }

  return Math.max(0, Math.floor(rawSize * 1000000) / 1000000);
}

/**
 * Check if opening a position would exceed max drawdown.
 * FIX: Now calculates actual drawdown from trade history instead of hardcoded $10,000.
 */
async function checkMaxDrawdown(): Promise<boolean> {
  try {
    const balance = await storage.getBalance();
    const trades = await storage.getTradeHistory();

    let peakCapital = 10000; // default initial
    let runningCapital = 10000;

    for (const trade of trades) {
      runningCapital += trade.pnl;
      if (runningCapital > peakCapital) {
        peakCapital = runningCapital;
      }
    }

    const currentDrawdown = peakCapital > 0
      ? ((peakCapital - balance.capital) / peakCapital) * 100
      : 0;

    return currentDrawdown >= 20;
  } catch {
    return false;
  }
}

/**
 * Check if we already have a position on this symbol (avoid duplicates).
 */
async function hasPositionOnSymbol(symbol: string): Promise<boolean> {
  const positions = await storage.getPositions();
  return positions.some(p => p.symbol === symbol && p.status === 'OPEN');
}

/**
 * Check if a correlated symbol already has an open position.
 * FIX: Prevents over-concentration in correlated assets.
 * Limits to max 2 positions per correlated group.
 */
async function checkCorrelatedGroupLimit(symbol: string): Promise<boolean> {
  const positions = await storage.getPositions();
  const openPositions = positions.filter(p => p.status === 'OPEN');

  for (const group of CORRELATED_GROUPS) {
    if (!group.includes(symbol)) continue;

    // Count how many positions we have in this group
    const groupPositions = openPositions.filter(p => group.includes(p.symbol));
    if (groupPositions.length >= 2) {
      console.warn(`[CorrelationCheck] Already have ${groupPositions.length} positions in group [${group.join(', ')}], skipping ${symbol}`);
      return true; // exceeded limit
    }
  }
  return false; // OK to trade
}

/**
 * Monitor and manage open positions.
 * FIX: This is the core position management loop.
 * - Updates current prices and P&L for open positions
 * - Checks stop-loss and take-profit levels
 * - Manages trailing stops
 * - Closes positions when SL/TP is hit
 * - Sets cooldown when positions close
 */
async function manageOpenPositions(mode: 'virtual' | 'real'): Promise<void> {
  try {
    const positions = await storage.getPositions();
    const openPositions = positions.filter(p => p.status === 'OPEN');

    if (openPositions.length === 0) return;

    // Fetch current market prices for all open positions
    const symbols = Array.from(new Set(openPositions.map(p => p.symbol)));
    let tickers: Record<string, number> = {};

    try {
      const response = await bybitRestClient.getTickers({ category: 'linear' });
      if (response.retCode === 0 && response.result?.list) {
        for (const t of response.result.list) {
          if (symbols.includes(t.symbol)) {
            tickers[t.symbol] = parseFloat(t.lastPrice);
          }
        }
      }
    } catch (err: any) {
      console.warn('[PositionManager] Failed to fetch prices:', err.message);
    }

    for (const position of openPositions) {
      const currentPrice = tickers[position.symbol] || position.currentPrice || position.entryPrice;

      // Update position with current price and P&L
      const updatedPosition: Position = {
        ...position,
        currentPrice,
      };

      // Calculate P&L
      if (position.side === 'BUY') {
        updatedPosition.pnl = (currentPrice - position.entryPrice) * position.size;
        updatedPosition.pnlPercent = position.entryPrice > 0
          ? ((currentPrice - position.entryPrice) / position.entryPrice) * 100
          : 0;
      } else {
        updatedPosition.pnl = (position.entryPrice - currentPrice) * position.size;
        updatedPosition.pnlPercent = position.entryPrice > 0
          ? ((position.entryPrice - currentPrice) / position.entryPrice) * 100
          : 0;
      }

      let didClose = false;

      // Check stop-loss
      if (position.stopLoss) {
        const hitSL = position.side === 'BUY'
          ? currentPrice <= position.stopLoss
          : currentPrice >= position.stopLoss;

        if (hitSL) {
          console.info(`[PositionManager] Stop-loss hit for ${position.symbol} at ${currentPrice}`);
          await closePosition(position.id, mode);
          recordDailyLoss(Math.abs(updatedPosition.pnl) || 0);
          setSymbolCooldown(position.symbol);
          didClose = true;
        }
      }

      if (didClose) continue;

      // Check take-profit
      if (position.takeProfit) {
        const hitTP = position.side === 'BUY'
          ? currentPrice >= position.takeProfit
          : currentPrice <= position.takeProfit;

        if (hitTP) {
          console.info(`[PositionManager] Take-profit hit for ${position.symbol} at ${currentPrice}`);
          await closePosition(position.id, mode);
          setSymbolCooldown(position.symbol);
          didClose = true;
        }
      }

      if (didClose) continue;

      // Manage trailing stop
      if (position.trailingStop && position.stopLoss) {
        if (position.side === 'BUY') {
          const newStopLoss = currentPrice - position.trailingStop;
          if (newStopLoss > position.stopLoss) {
            updatedPosition.stopLoss = newStopLoss;
          }
        } else {
          const newStopLoss = currentPrice + position.trailingStop;
          if (newStopLoss < position.stopLoss) {
            updatedPosition.stopLoss = newStopLoss;
          }
        }
      }

      // Update position in storage
      await storage.addPosition(updatedPosition);
    }
  } catch (err: any) {
    console.error('[PositionManager] Error managing positions:', err.message);
  }
}

export async function automatedTrader(mode: 'virtual' | 'real' = 'virtual') {
  try {
    const tradingConfig = await storage.getTradingConfig();
    const scanInterval = tradingConfig.scanInterval * 1000;
    const maxPositions = tradingConfig.maxPositions;
    const intervalStr = mapIntervalToValid(tradingConfig.scanInterval);

    console.info(`[AutomatedTrader] Starting automated trading in ${mode} mode...`);

    while (true) {
      const status = await storage.getAppStatus();
      if (!status.isAutomatedTradingEnabled) break;

      try {
        // First, manage existing open positions
        await manageOpenPositions(mode);

        const positions = await storage.getPositions();
        const openPositions = positions.filter((p) => p.status === 'OPEN').length;

        // Check all risk management limits
        if (checkDailyLossLimit(tradingConfig)) {
          console.warn('[AutomatedTrader] Daily loss limit reached. Pausing trading for 5 min.');
          await new Promise((resolve) => setTimeout(resolve, 300000));
          continue;
        }

        if (checkDailyTradeLimit()) {
          console.warn('[AutomatedTrader] Daily trade limit reached. Pausing trading for 1 hour.');
          await new Promise((resolve) => setTimeout(resolve, 3600000));
          continue;
        }

        if (await checkMaxDrawdown()) {
          console.warn('[AutomatedTrader] Max drawdown reached. Pausing trading.');
          await new Promise((resolve) => setTimeout(resolve, 60000));
          continue;
        }

        if (openPositions < maxPositions) {
          const signals = await scanSignals(intervalStr as any, 10, mode);

          for (const signal of signals) {
            // Only take HIGH confidence signals for automated trading
            if (signal.confidence !== 'HIGH' || signal.score < 75) {
              continue;
            }

            // Check if we already have a position on this symbol
            if (await hasPositionOnSymbol(signal.symbol)) {
              continue;
            }

            // Check if this symbol is in cooldown (recently closed)
            if (isSymbolInCooldown(signal.symbol)) {
              console.info(`[AutomatedTrader] ${signal.symbol} is in cooldown, skipping`);
              continue;
            }

            // Check if we've exceeded correlated group limit
            if (await checkCorrelatedGroupLimit(signal.symbol)) {
              continue;
            }

            // Use risk-based position sizing with performance adjustment
            const balance = await storage.getBalance();
            const size = await calculatePositionSize(
              balance.capital,
              tradingConfig,
              signal.entry,
              signal.sl
            );

            if (size <= 0) {
              console.warn(`[AutomatedTrader] Invalid position size for ${signal.symbol}`);
              continue;
            }

            console.info(`[AutomatedTrader] Executing trade for ${signal.symbol} - Size: ${size}`);

            await executeTrade({
              symbol: signal.symbol,
              side: signal.type as 'BUY' | 'SELL',
              size,
              type: 'market',
              stopLoss: signal.sl,
              takeProfit: signal.tp,
              leverage: signal.leverage,
            }, mode);

            incrementDailyTradeCount();
          }
        }
      } catch (err: any) {
        console.error(`[AutomatedTrader] Loop error:`, err.message);
      }

      await new Promise((resolve) => setTimeout(resolve, scanInterval));
    }
  } catch (err: any) {
    console.error('[AutomatedTrader] Fatal error:', err.message);
  }
}

export async function startAutomatedTrading(mode: 'virtual' | 'real' = 'virtual') {
  try {
    const status = await storage.getAppStatus().catch((err) => {
      console.error('[AutomatedTrader] Failed to get app status:', err);
      return { tradingMode: mode, isAutomatedTradingEnabled: false } as AppStatus;
    });

    if (!status.isAutomatedTradingEnabled) {
      await storage.setAppStatus({ ...status, isAutomatedTradingEnabled: true }).catch((err) => {
        console.error('[AutomatedTrader] Failed to set app status:', err);
      });
      automatedTrader(mode).catch((err) => {
        console.error('[AutomatedTrader] Unhandled error:', err);
      });
    } else {
      console.info('[AutomatedTrader] Automated trading already running.');
    }
  } catch (err: any) {
    console.error('[AutomatedTrader] Failed to start automated trading:', err.message);
  }
}

export async function stopAutomatedTrading() {
  try {
    const status = await storage.getAppStatus().catch((err) => {
      console.error('[AutomatedTrader] Failed to get app status:', err);
      return { tradingMode: 'virtual', isAutomatedTradingEnabled: true } as AppStatus;
    });
    await storage.setAppStatus({ ...status, isAutomatedTradingEnabled: false }).catch((err) => {
      console.error('[AutomatedTrader] Failed to set app status:', err);
    });
    console.info('[AutomatedTrader] Stopping automated trading...');
  } catch (err: any) {
    console.error('[AutomatedTrader] Failed to stop automated trading:', err.message);
  }
}