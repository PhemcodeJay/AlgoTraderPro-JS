// automatedTrader.ts
import { scanSignals } from './bybitClient';
import { executeTrade } from './executeTrade';
import { storage, Signal, Position } from './storage';

export async function automatedTrader(mode: 'virtual' | 'real' = 'virtual') {
  try {
    const tradingConfig = await storage.getTradingConfig();
    const scanInterval = tradingConfig.scanInterval * 1000; // Convert seconds to ms

    console.info(`[AutomatedTrader] Starting automated trading in ${mode} mode...`);

    while (await storage.getAppStatus().then((s) => s.isAutomatedTradingEnabled)) {
      try {
        // Scan for new signals
        const signals: Signal[] = await scanSignals();
        console.info(`[AutomatedTrader] ${signals.length} signals scanned`);

        // Execute signals
        for (const signal of signals) {
          if (signal.status === 'PENDING') {
            const position: Position | null = await executeTrade(signal, mode);
            if (position) {
              console.info(`[AutomatedTrader] Trade executed for ${signal.symbol}`);
            }
          }
        }
      } catch (err) {
        console.error('[AutomatedTrader] Error in trading loop:', err);
      }

      // Wait until next scan
      await new Promise((resolve) => setTimeout(resolve, scanInterval));
    }

    console.info('[AutomatedTrader] Automated trading stopped.');
  } catch (err) {
    console.error('[AutomatedTrader] Fatal error:', err);
  }
}

export async function startAutomatedTrading(mode: 'virtual' | 'real' = 'virtual') {
  const status = await storage.getAppStatus();
  if (!status.isAutomatedTradingEnabled) {
    await storage.setAppStatus({ ...status, isAutomatedTradingEnabled: true });
    automatedTrader(mode); // Run loop
  }
}

export async function stopAutomatedTrading() {
  const status = await storage.getAppStatus();
  await storage.setAppStatus({ ...status, isAutomatedTradingEnabled: false });
}