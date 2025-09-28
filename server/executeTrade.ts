import { storage, Signal, Position, Balance } from './storage';
import { bybitRestClient } from './bybitClient';
import { randomUUID } from 'crypto';

// Execute a trade based on a signal
export async function executeTrade(signal: Signal, mode: 'virtual' | 'real' = 'virtual'): Promise<Position | null> {
  try {
    // Fetch current balance
    const balance: Balance = await storage.getBalance();
    if (balance.available <= 0) {
      console.warn(`[executeTrade] Insufficient balance to execute trade for ${signal.symbol}`);
      return null;
    }

    // Determine position size (risk-based)
    const tradingConfig = await storage.getTradingConfig();
    const riskAmount = (tradingConfig.riskPerTrade / 100) * balance.available;
    const size = Math.max(1, (riskAmount / signal.price) * tradingConfig.leverage);

    // Create Position object
    const position: Position = {
      id: randomUUID(),
      symbol: signal.symbol,
      side: signal.type,
      size,
      entryPrice: signal.price,
      pnl: 0,
      pnlPercent: 0,
      status: 'OPEN',
      openTime: new Date().toISOString(),
    };

    if (mode === 'virtual') {
      await storage.addPosition(position);

    } else {
      // Real trade: submit order to Bybit
      const orderResponse = await bybitRestClient.submitOrder({
        category: 'linear',
        symbol: signal.symbol,
        side: signal.type === 'BUY' ? 'Buy' : 'Sell',
        orderType: 'Market',
        qty: size.toString(),
      });

      if (!orderResponse.result || orderResponse.result.orderStatus !== 'Filled') {
        console.error(`[executeTrade] Real trade failed for ${signal.symbol}`);
        return null;
      }

      await storage.addPosition(position);
    }

    // Update the executed signal in storage
    const allSignals = await storage.getSignals();
    const updatedSignals = allSignals.map((s) =>
      s.id === signal.id ? { ...s, status: 'EXECUTED', executedPrice: position.entryPrice } : s
    );
    await storage.setSignals(updatedSignals);

    console.info(`[executeTrade] Trade executed for ${signal.symbol} (${mode})`);
    return position;

  } catch (err) {
    console.error(`[executeTrade] Error executing trade for ${signal.symbol}:`, err);
    return null;
  }
}
