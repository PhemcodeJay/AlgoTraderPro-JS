import { scanSignals } from './scanSignals';
import { executeTrade } from './executeTrade';
import { processSignals } from './ml';
import { storage, Signal, Position } from './storage';

export async function automatedTrader(mode: 'virtual' | 'real' = 'virtual') {
  try {
    const tradingConfig = await storage.getTradingConfig();
    const scanInterval = tradingConfig.scanInterval * 1000; // seconds → ms
    const maxPositions = tradingConfig.maxPositions;

    console.info(`[AutomatedTrader] Starting automated trading in ${mode} mode...`);

    while (true) {
      const status = await storage.getAppStatus();
      if (!status.isAutomatedTradingEnabled) break;

      try {
        // Check current open positions
        const positions = await storage.getPositions();
        const openPositions = positions.filter((p) => p.status === 'OPEN').length;
        if (openPositions >= maxPositions) {
          console.info(`[AutomatedTrader] Max positions (${maxPositions}) reached, skipping scan`);
          await new Promise((resolve) => setTimeout(resolve, scanInterval));
          continue;
        }

        // Scan and process signals
        const signals = await scanSignals(tradingConfig.scanInterval.toString() as any, 10, mode);
        console.info(`[AutomatedTrader] ${signals.length} signals scanned`);

        // Process signals with ML filtering
        const processedSignals = await processSignals();
        console.info(`[AutomatedTrader] ${processedSignals.length} signals after ML processing`);

        for (const signal of processedSignals) {
          if (signal.status !== 'PENDING') continue;

          const position = await executeTrade(signal, mode);
          if (position) {
            console.info(`[AutomatedTrader] Trade executed for ${signal.symbol} - Entry: ${position.entryPrice}, Size: ${position.size}`);
          } else {
            console.warn(`[AutomatedTrader] Trade execution failed for ${signal.symbol}`);
          }
        }
      } catch (err: any) {
        console.error(`[AutomatedTrader] Error in trading loop:`, err.message ?? err);
      }

      await new Promise((resolve) => setTimeout(resolve, scanInterval));
    }

    console.info('[AutomatedTrader] Automated trading stopped.');
  } catch (err: any) {
    console.error('[AutomatedTrader] Fatal error:', err.message ?? err);
  }
}

export async function startAutomatedTrading(mode: 'virtual' | 'real' = 'virtual') {
  const status = await storage.getAppStatus();
  if (!status.isAutomatedTradingEnabled) {
    await storage.setAppStatus({ ...status, isAutomatedTradingEnabled: true });
    automatedTrader(mode).catch((err) => {
      console.error('[AutomatedTrader] Unhandled error:', err);
    });
  } else {
    console.info('[AutomatedTrader] Automated trading already running.');
  }
}

export async function stopAutomatedTrading() {
  const status = await storage.getAppStatus();
  await storage.setAppStatus({ ...status, isAutomatedTradingEnabled: false });
  console.info('[AutomatedTrader] Stopping automated trading...');
}