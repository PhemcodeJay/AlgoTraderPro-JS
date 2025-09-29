import { scanSignals } from './bybitClient';
import { executeTrade } from './bybitClient';
import { processSignals } from './ml';
import { storage, Signal, Position, AppStatus } from './storage';
import { KlineIntervalV3 } from 'bybit-api';
import { randomUUID } from 'crypto'; // Ensure import is present

// Map scanInterval (seconds) to valid KlineIntervalV3 values
const mapIntervalToKline = (intervalSeconds: number): KlineIntervalV3 => {
  const intervalMap: { [key: number]: KlineIntervalV3 } = {
    60: '1', // 1 minute
    300: '5', // 5 minutes
    900: '15', // 15 minutes
    3600: '60', // 1 hour
    14400: '240', // 4 hours
    86400: 'D', // 1 day
  };
  return intervalMap[intervalSeconds] || '15'; // Default to 15 minutes
};

export async function automatedTrader(mode: 'virtual' | 'real' = 'virtual') {
  try {
    const tradingConfig = await storage.getTradingConfig().catch((err) => {
      console.error('[AutomatedTrader] Failed to get trading config:', err);
      return {
        maxPositions: 5,
        riskPerTrade: 2.0,
        leverage: 10,
        stopLossPercent: 5.0,
        takeProfitPercent: 15.0,
        scanInterval: 300,
      };
    });
    const scanInterval = tradingConfig.scanInterval * 1000; // seconds → ms
    const maxPositions = tradingConfig.maxPositions;
    const klineInterval = mapIntervalToKline(tradingConfig.scanInterval);

    console.info(`[AutomatedTrader] Starting automated trading in ${mode} mode...`);

    while (true) {
      const status = await storage.getAppStatus().catch((err) => {
        console.error('[AutomatedTrader] Failed to get app status:', err);
        return { tradingMode: mode, isAutomatedTradingEnabled: true } as AppStatus;
      });

      if (!status.isAutomatedTradingEnabled) {
        console.info('[AutomatedTrader] Automated trading disabled, stopping loop.');
        break;
      }

      try {
        // Check current open positions
        const positions = await storage.getPositions().catch((err) => {
          console.error('[AutomatedTrader] Failed to get positions:', err);
          return [] as Position[];
        });
        const openPositions = positions.filter((p) => p.status === 'OPEN').length;
        if (openPositions >= maxPositions) {
          console.info(`[AutomatedTrader] Max positions (${maxPositions}) reached, skipping scan`);
          await new Promise((resolve) => setTimeout(resolve, scanInterval));
          continue;
        }

        // Scan and process signals
        const signals = await scanSignals(klineInterval, 10).catch((err) => {
          console.error('[AutomatedTrader] scanSignals failed:', err);
          return [] as Signal[];
        });
        console.info(`[AutomatedTrader] ${signals.length} signals scanned`);

        // Process signals with ML filtering
        let processedSignals: Signal[] = [];
        try {
          processedSignals = await processSignals();
          console.info(`[AutomatedTrader] ${processedSignals.length} signals after ML processing`);
        } catch (err: any) {
          console.error('[AutomatedTrader] processSignals failed:', err.message);
          processedSignals = signals; // Fallback to unprocessed signals
        }

        for (const signal of processedSignals) {
          if (signal.status !== 'PENDING') continue;

          try {
            console.info(`[AutomatedTrader] Processing signal ${signal.id} for ${signal.symbol}`);
            // Construct trade object compatible with bybitClient.ts executeTrade
            const trade = {
              symbol: signal.symbol,
              side: signal.type,
              size: signal.margin_usdt * signal.leverage, // Placeholder; adjust as needed
              type: 'market' as 'market' | 'limit',
              price: signal.price,
              stopLoss: signal.stopLoss,
              takeProfit: signal.takeProfit,
            };

            const position = await executeTrade(trade);
            if (position) {
              // Update position in storage
              const newPosition: Position = {
                id: randomUUID(), // Ensure crypto.randomUUID is available
                symbol: signal.symbol,
                side: signal.type,
                size: trade.size,
                leverage: signal.leverage,
                entryPrice: signal.price,
                currentPrice: signal.currentMarketPrice,
                pnl: 0,
                pnlPercent: 0,
                status: 'OPEN',
                openTime: new Date().toISOString(),
                stopLoss: signal.stopLoss,
                takeProfit: signal.takeProfit,
                liquidationPrice: signal.liquidationPrice,
                trailingStop: signal.trailingStop,
              };
              await storage.addPosition(newPosition).catch((err) => {
                console.error('[AutomatedTrader] Failed to add position:', err);
              });
              console.info(
                `[AutomatedTrader] Trade executed for ${signal.symbol} - Entry: ${newPosition.entryPrice}, Size: ${newPosition.size}`
              );
            } else {
              console.warn(`[AutomatedTrader] Trade execution failed for ${signal.symbol}`);
            }
          } catch (err: any) {
            console.error(`[AutomatedTrader] Trade execution failed for ${signal.symbol}:`, err.message);
          }
        }
      } catch (err: any) {
        console.error(`[AutomatedTrader] Error in trading loop:`, err.message);
        if (err.message.includes('API key invalid') || err.message.includes('Network error')) {
          console.error('[AutomatedTrader] Critical error, stopping trading');
          await stopAutomatedTrading();
          break;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, scanInterval));
    }

    console.info('[AutomatedTrader] Automated trading stopped.');
  } catch (err: any) {
    console.error('[AutomatedTrader] Fatal error:', err.message);
    throw err; // Propagate to startAutomatedTrading
  }
}

export async function startAutomatedTrading(mode: 'virtual' | 'real' = 'virtual') {
  try {
    const status = await storage.getAppStatus().catch((err) => {
      console.error('[AutomatedTrader] Failed to get app status:', err);
      return { tradingMode: mode, isAutomatedTradingEnabled: false } as AppStatus; // Fix: Explicitly cast to AppStatus
    });

    if (!status.isAutomatedTradingEnabled) {
      await storage.setAppStatus({ ...status, isAutomatedTradingEnabled: true }).catch((err) => {
        console.error('[AutomatedTrader] Failed to set app status:', err);
      });
      // Run automatedTrader in the background
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
      return { tradingMode: 'virtual', isAutomatedTradingEnabled: true } as AppStatus; // Fix: Explicitly cast to AppStatus
    });
    await storage.setAppStatus({ ...status, isAutomatedTradingEnabled: false }).catch((err) => {
      console.error('[AutomatedTrader] Failed to set app status:', err);
    });
    console.info('[AutomatedTrader] Stopping automated trading...');
  } catch (err: any) {
    console.error('[AutomatedTrader] Failed to stop automated trading:', err.message);
  }
}