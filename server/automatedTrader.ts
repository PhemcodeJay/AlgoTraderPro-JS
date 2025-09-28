import { scanSignals } from './bybitClient';
import { executeTrade } from './executeTrade';
import { storage, Signal, Position } from './storage';

// Main automated trading loop
export async function automatedTrader(mode: 'virtual' | 'real' = 'virtual') {
  try {
    const tradingConfig = await storage.getTradingConfig();
    const scanInterval = tradingConfig.scanInterval * 1000; // convert seconds to ms

    console.info(`[AutomatedTrader] Starting automated trading in ${mode} mode...`);

    // Infinite loop
    while (await storage.getAppStatus().then(s => s.isAutomatedTradingEnabled)) {
      try {
        // 1. Scan for new signals
        const signals: Signal[] = await scanSignals();
        console.info(`[AutomatedTrader] ${signals.length} signals scanned`);

        // 2. Execute signals
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

      // 3. Wait until next scan
      await new Promise((resolve) => setTimeout(resolve, scanInterval));
    }

    console.info('[AutomatedTrader] Automated trading stopped.');

  } catch (err) {
    console.error('[AutomatedTrader] Fatal error:', err);
  }
}

// Helper to start automated trading
export async function startAutomatedTrading(mode: 'virtual' | 'real' = 'virtual') {
  const status = await storage.getAppStatus();
  if (!status.isAutomatedTradingEnabled) {
    status.isAutomatedTradingEnabled = true;
    await storage.setAppStatus(status);
    automatedTrader(mode); // run loop
  }
}

// Helper to stop automated trading
export async function stopAutomatedTrading() {
  const status = await storage.getAppStatus();
  status.isAutomatedTradingEnabled = false;
  await storage.setAppStatus(status);
}
