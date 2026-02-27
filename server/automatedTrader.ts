import { scanSignals } from './scanSignals';
import { executeTrade } from './bybitClient';
import { storage, Signal, Position, AppStatus } from './storage';
import { randomUUID } from 'crypto';
import { MLFilter } from './ml';

const { applyML } = new MLFilter();

// Map scanInterval (seconds) to valid interval strings
const mapIntervalToValid = (intervalSeconds: number): string => {
  const intervalMap: { [key: number]: string } = {
    300: '5', // 5 minutes
    3600: '60', // 1 hour
    14400: '240', // 4 hours
    86400: 'D', // 1 day
  };
  return intervalMap[intervalSeconds] || '60';
};

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
        const positions = await storage.getPositions();
        const openPositions = positions.filter((p) => p.status === 'OPEN').length;
        
        if (openPositions < maxPositions) {
          const signals = await scanSignals(intervalStr as any, 10, mode);
          
          for (const signal of signals) {
            if (signal.confidence === 'HIGH' && signal.score >= 75) {
              console.info(`[AutomatedTrader] Executing trade for ${signal.symbol}`);
              await executeTrade({
                symbol: signal.symbol,
                side: signal.type as 'BUY' | 'SELL',
                size: 0.1, // Fixed small size for safety
                type: 'market',
                stopLoss: signal.sl,
                takeProfit: signal.tp
              }, mode);
            }
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